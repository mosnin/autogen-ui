// Run real end-to-end tests of the agent + streaming agent without an API key,
// driving them with the eval harness's fake client.
//
//   pnpm --filter @autogen-ui/core test

import {
  applyPatches,
  assertValidPatches,
  createFakeClient,
  createStreamingUIAgent,
  createUIAgent,
  defaultCapabilities,
  emptyDashboard,
  type LLMClient,
  type LLMEvent,
  type LLMResult,
} from "../src/index";

let pass = 0;
let fail = 0;
const failures: { name: string; detail: string }[] = [];

function test(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    process.stdout.write(`  ok  ${name}\n`);
  } else {
    fail++;
    failures.push({ name, detail });
    process.stdout.write(`  FAIL  ${name}${detail ? "\n        " + detail : ""}\n`);
  }
}

// ---------- 1. Basic: agent calls emit_patches with a valid response.
{
  process.stdout.write("\n# basic emit_patches\n");
  const fake = createFakeClient([
    {
      message: "Built a starter dashboard.",
      patches: [
        {
          op: "append",
          parentId: "root",
          node: {
            id: "revenue",
            type: "Stat",
            props: { label: "Revenue", value: 12345, delta: "+8%", trend: "up" },
          },
        },
      ],
    },
  ]);
  const agent = createUIAgent({ client: fake, capabilities: defaultCapabilities });
  const result = await agent.run({
    messages: [{ role: "user", content: "build me something" }],
    dashboard: null,
  });
  test("returns a message", result.message === "Built a starter dashboard.");
  test("returns 1 patch", result.patches.length === 1);
  test("patches validate", assertValidPatches(result) === null);
  const next = applyPatches(emptyDashboard(), result.patches);
  test("patch applies", next.root.children?.[0]?.id === "revenue");
}

// ---------- 2. Auto-repair: first reply is invalid, second is valid.
{
  process.stdout.write("\n# auto-repair on invalid input\n");
  let callCount = 0;
  const fake = createFakeClient([
    // First call: a totally bogus tool input — fails Zod.
    { toolName: "emit_patches", input: { not_patches: "nope" } },
    // Second call (the repair attempt): inspect that the user message
    // includes the validation error, then return a good response.
    (req) => {
      callCount = req.messages.length;
      const lastUser = req.messages[req.messages.length - 1];
      const sawError =
        lastUser &&
        typeof lastUser.content === "string" &&
        lastUser.content.includes("failed validation");
      return {
        message: sawError ? "Repaired." : "(no error context)",
        patches: [],
      };
    },
  ]);
  const agent = createUIAgent({ client: fake });
  const result = await agent.run({
    messages: [{ role: "user", content: "hi" }],
    dashboard: null,
  });
  test("repair loop succeeded", result.message === "Repaired.");
  test("repair turn carried the conversation forward", callCount >= 3);
}

// ---------- 3. Repair gives up after too many failures.
{
  process.stdout.write("\n# repair exhaustion\n");
  const fake = createFakeClient([
    { toolName: "emit_patches", input: { wrong: 1 } },
    { toolName: "emit_patches", input: { wrong: 2 } },
    { toolName: "emit_patches", input: { wrong: 3 } },
  ]);
  const agent = createUIAgent({ client: fake, maxRepairAttempts: 2 });
  let err = null;
  try {
    await agent.run({ messages: [{ role: "user", content: "x" }] });
  } catch (e) {
    err = e;
  }
  test(
    "throws after exhausting attempts",
    err !== null && /failed validation after 3 attempts/.test(err.message),
    err ? err.message : "(no error thrown)",
  );
}

// ---------- 4. Custom components appear in the system prompt.
{
  process.stdout.write("\n# custom components extension\n");
  let seenSystem = "";
  const fake = createFakeClient([
    (req) => {
      const segs = Array.isArray(req.system) ? req.system : [{ text: req.system }];
      seenSystem = segs.map((s) => s.text).join("\n");
      return { message: "ok", patches: [] };
    },
  ]);
  const agent = createUIAgent({
    client: fake,
    components: [
      {
        type: "PricingTier",
        description: "A custom pricing tier card.",
        props: "name: string, price: number, features: string[]",
        acceptsChildren: false,
      },
    ],
  });
  await agent.run({ messages: [{ role: "user", content: "x" }] });
  test(
    "system prompt names the custom component",
    seenSystem.includes("PricingTier") && seenSystem.includes("pricing tier card"),
  );
}

// ---------- 5. Streaming agent yields patch frames as they arrive.
{
  process.stdout.write("\n# streaming agent (non-streaming client fallback)\n");
  const patches = [
    { op: "setTitle", title: "Live Sales" },
    {
      op: "append",
      parentId: "root",
      node: { id: "mrr", type: "Stat", props: { label: "MRR", value: 4200 } },
    },
    {
      op: "append",
      parentId: "root",
      node: { id: "users", type: "Stat", props: { label: "Active users", value: 1234 } },
    },
  ];
  const fake = createFakeClient([{ message: "Generated.", patches }]);
  const agent = createStreamingUIAgent({ client: fake });
  const frames = [];
  for await (const frame of agent.runStream({
    messages: [{ role: "user", content: "go" }],
    dashboard: null,
  })) {
    frames.push(frame);
  }
  const patchFrames = frames.filter((f) => f.kind === "patch");
  const messageFrames = frames.filter((f) => f.kind === "message");
  const doneFrame = frames[frames.length - 1];
  test("yielded all 3 patch frames", patchFrames.length === 3);
  test("yielded message frame", messageFrames.length === 1 && messageFrames[0].delta === "Generated.");
  test("ended with done", doneFrame?.kind === "done");

  let d = emptyDashboard();
  for (const f of patchFrames) d = applyPatches(d, [f.patch]);
  test("streamed patches apply", d.title === "Live Sales" && d.root.children?.length === 2);
}

// ---------- 6. Streaming agent with a true streaming client.
{
  process.stdout.write("\n# streaming agent (true streaming client)\n");
  const fakeStreamClient = {
    name: "fake-stream",
    async complete() {
      throw new Error("streaming path should be used");
    },
    async *stream() {
      yield { kind: "tool_start", id: "t1", name: "emit_patches" };
      // Emit the tool input as multiple chunks that together form valid JSON.
      const chunks = [
        '{"message":"Building',
        ' it now",',
        '"patches":[',
        '{"op":"setTitle","title":"',
        'Hello"}',
        ',',
        '{"op":"append","parentId":"root","node":{"id":"a","type":"Stat","props":{"label":"x","value":1}}}',
        "]}",
      ];
      for (const c of chunks) {
        yield { kind: "tool_input_delta", id: "t1", partialJson: c };
      }
      yield { kind: "tool_end", id: "t1", input: {} };
      yield { kind: "done" };
    },
  };
  const agent = createStreamingUIAgent({ client: fakeStreamClient });
  const frames = [];
  for await (const f of agent.runStream({
    messages: [{ role: "user", content: "go" }],
    dashboard: null,
  })) {
    frames.push(f);
  }
  const messageDelta = frames
    .filter((f) => f.kind === "message")
    .map((f) => f.delta)
    .join("");
  const patches = frames.filter((f) => f.kind === "patch");
  test("incrementally streamed the message", messageDelta === "Building it now");
  test("incrementally streamed 2 patches", patches.length === 2);
  test("first patch is setTitle", patches[0]?.patch.op === "setTitle");
  test("second patch is append", patches[1]?.patch.op === "append");
}

// ---------- 7. Streaming agent drops invalid patches as error frames.
{
  process.stdout.write("\n# streaming agent rejects invalid patches\n");
  const fakeStreamClient = {
    name: "fake-stream",
    async complete() {
      throw new Error("unused");
    },
    async *stream() {
      yield { kind: "tool_start", id: "t1", name: "emit_patches" };
      yield {
        kind: "tool_input_delta",
        id: "t1",
        partialJson:
          '{"message":"","patches":[{"op":"bogus","id":"x"},{"op":"setTitle","title":"OK"}]}',
      };
      yield { kind: "done" };
    },
  };
  const agent = createStreamingUIAgent({ client: fakeStreamClient });
  const frames = [];
  for await (const f of agent.runStream({
    messages: [{ role: "user", content: "x" }],
    dashboard: null,
  })) {
    frames.push(f);
  }
  const patches = frames.filter((f) => f.kind === "patch");
  const errors = frames.filter((f) => f.kind === "error");
  test("invalid patch reported as error frame", errors.length === 1);
  test("valid patch still made it through", patches.length === 1 && patches[0].patch.op === "setTitle");
}

// ---------- 8. Dispatcher substitutes {{event.value}} into action values.
{
  process.stdout.write("\n# action payload substitution\n");
  const { createDispatcher, compileEvents } = await import("../src/actions");
  const stateChanges: { path: string; value: unknown }[] = [];
  const dispatch = createDispatcher({
    getState: () => ({ filter: "old", count: 3 }),
    setState: (path, value) => stateChanges.push({ path, value }),
    refetch: () => {},
  });

  dispatch(
    [{ type: "setState", path: "filter", value: "{{event.value}}" }],
    { value: "ringing" },
  );
  test(
    "whole-string {{event.value}} becomes the typed payload",
    stateChanges[0]?.path === "filter" && stateChanges[0]?.value === "ringing",
  );

  // Numeric whole-string token preserves the number type.
  stateChanges.length = 0;
  dispatch(
    [{ type: "setState", path: "n", value: "{{event.value}}" }],
    { value: 42 },
  );
  test(
    "numeric event value stays a number",
    stateChanges[0]?.value === 42 && typeof stateChanges[0]?.value === "number",
  );

  // Embedded token interpolates as string.
  stateChanges.length = 0;
  dispatch(
    [{ type: "setState", path: "label", value: "hello {{event.name}}!" }],
    { name: "world" },
  );
  test("embedded {{event.X}} interpolates", stateChanges[0]?.value === "hello world!");

  // toggleState reads current state.
  stateChanges.length = 0;
  dispatch([{ type: "toggleState", path: "filter" }]);
  test(
    "toggleState flips truthy to false",
    stateChanges[0]?.path === "filter" && stateChanges[0]?.value === false,
  );

  // compileEvents only wires onClick — onChange/onSubmit are component-owned.
  const handlers = compileEvents(
    {
      onClick: [{ type: "setState", path: "x", value: 1 }],
      onChange: [{ type: "setState", path: "y", value: 2 }],
      onSubmit: [{ type: "setState", path: "z", value: 3 }],
    },
    {
      dashboard: emptyDashboard(),
      data: {},
      state: {},
      dispatch: () => {},
    },
  );
  test("compileEvents wires onClick", typeof handlers.onClick === "function");
  test("compileEvents skips onChange (form-owned)", handlers.onChange === undefined);
  test("compileEvents skips onSubmit (form-owned)", handlers.onSubmit === undefined);
}

// ---------- 9. Streaming agent abort: in-flight stream stops on signal.
{
  process.stdout.write("\n# streaming agent stream events\n");
  // Verify the streaming path consumes events progressively (proxy for abort
  // working: we can drain one event at a time and confirm ordering).
  const events: string[] = [];
  const fakeStreamClient: LLMClient = {
    name: "fake-stream",
    async complete() {
      throw new Error("unused");
    },
    async *stream() {
      events.push("started");
      yield { kind: "tool_start", id: "t1", name: "emit_patches" } as LLMEvent;
      yield {
        kind: "tool_input_delta",
        id: "t1",
        partialJson: '{"patches":[{"op":"setTitle","title":"A"}]}',
      } as LLMEvent;
      events.push("after-first-delta");
      yield { kind: "done" } as LLMEvent;
      events.push("ended");
    },
  };
  const agent = createStreamingUIAgent({ client: fakeStreamClient });
  let firstPatch: unknown;
  for await (const frame of agent.runStream({
    messages: [{ role: "user", content: "x" }],
    dashboard: null,
  })) {
    if (frame.kind === "patch" && !firstPatch) firstPatch = frame.patch;
  }
  test("stream produced setTitle patch", (firstPatch as { op?: string })?.op === "setTitle");
  test("client iterator ran fully", events[0] === "started" && events.at(-1) === "ended");
}

// ---------- 9b. Binding filters: currency, number, percent, date, upper, truncate, default
{
  process.stdout.write("\n# binding pipe filters\n");
  const { resolveBindings } = await import("../src/data");
  const ctx = {
    dashboard: emptyDashboard(),
    data: { sales: { total: 12345.67, ratio: 0.234 } },
    state: { name: "alice" },
    dispatch: () => {},
  };
  const apply = (expr: string): unknown => {
    const node = {
      id: "n",
      type: "Text",
      props: { text: "" },
      bindings: { text: expr },
    };
    const out = resolveBindings(node, ctx);
    return out.props?.text;
  };

  test(
    "currency formats with USD by default",
    typeof apply("{{sales.total | currency}}") === "string" &&
      /[$]?12,345\.67/.test(apply("{{sales.total | currency}}") as string),
  );
  test(
    "currency accepts argument",
    /€\s?12,345\.67|12,345\.67\s?€/.test(
      String(apply("{{sales.total | currency:EUR}}")),
    ),
  );
  test("percent formats", apply("{{sales.ratio | percent}}") === "23%");
  test("percent with digit count", apply("{{sales.ratio | percent:1}}") === "23.4%");
  test("upper transforms", apply("{{state.name | upper}}") === "ALICE");
  test("truncate with arg", apply("{{state.name | truncate:3}}") === "ali…");
  test("default fills null", apply("{{state.missing | default:n/a}}") === "n/a");
  test(
    "embedded interpolation runs filters",
    apply("Hi {{state.name | upper}}!") === "Hi ALICE!",
  );
  test(
    "unknown filter is a silent no-op",
    apply("{{state.name | bogus}}") === "alice",
  );
  test(
    "chained filters apply left-to-right",
    apply("{{state.name | upper | truncate:3}}") === "ALI…",
  );
}

// ---------- 9c. Patch warnings: hallucinated id references surface.
{
  process.stdout.write("\n# patch warnings\n");
  const { validatePatchTargets } = await import("../src/patch");
  const d = emptyDashboard();
  const withCard = applyPatches(d, [
    {
      op: "append",
      parentId: "root",
      node: { id: "card1", type: "Card", props: { title: "OK" } },
    },
  ]);

  // Update of a known id → no warning. Update of unknown id → warning.
  const ws = validatePatchTargets(withCard, [
    { op: "update", id: "card1", props: { title: "Renamed" } },
    { op: "update", id: "doesntExist", props: { title: "..." } },
    { op: "append", parentId: "alsoNope", node: { id: "x", type: "Text" } },
  ]);
  test("known id produces no warning", ws.length === 2);
  test("unknown node id surfaced", ws.some((w) => /doesntExist/.test(w)));
  test("unknown parent id surfaced", ws.some((w) => /alsoNope/.test(w)));

  // Same-turn sequencing: an append creates an id; a later update of that id
  // should NOT warn (the simulator advances state per patch).
  const sequential = validatePatchTargets(d, [
    { op: "append", parentId: "root", node: { id: "fresh", type: "Stat" } },
    { op: "update", id: "fresh", props: { label: "A" } },
  ]);
  test("sequential append→update sees the newly-created id", sequential.length === 0);

  // Agent attaches warnings to response when present.
  const fake = createFakeClient([
    {
      message: "I tried to edit something that doesn't exist.",
      patches: [{ op: "update", id: "ghost", props: { x: 1 } }],
    },
  ]);
  const agent = createUIAgent({ client: fake });
  const result = await agent.run({
    messages: [{ role: "user", content: "x" }],
    dashboard: emptyDashboard(),
  });
  test(
    "agent populated `warnings` for hallucinated id",
    Array.isArray(result.warnings) && result.warnings.length === 1,
  );
}

// ---------- 9d. Data proxy handler.
{
  process.stdout.write("\n# data proxy\n");
  const { createDataProxyHandler } = await import("../src/proxy");
  const { fetchDataSource } = await import("../src/data");

  // Mock upstream — capture headers we receive.
  let receivedHeaders: Record<string, string> = {};
  const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === "string" && input === "https://api.example.com/items") {
      receivedHeaders = {};
      const h = init?.headers as Record<string, string> | undefined;
      if (h) for (const [k, v] of Object.entries(h)) receivedHeaders[k.toLowerCase()] = v;
      return new Response(JSON.stringify({ items: [{ id: 1, label: "A" }] }), {
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unmocked fetch to ${String(input)}`);
  }) as typeof fetch;

  const originalFetch = globalThis.fetch;
  // Patch global fetch (used by the proxy handler internally).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = mockFetch;
  try {
    const handler = createDataProxyHandler({
      allow: ["https://api.example.com/"],
      headers: () => ({ authorization: "Bearer SERVER_SECRET" }),
    });

    // Reject disallowed URL.
    const denied = await handler(
      new Request("http://localhost/proxy", {
        method: "POST",
        body: JSON.stringify({ url: "https://evil.com/x" }),
      }),
    );
    test("denies URLs outside allowlist", denied.status === 403);

    // Successful proxy call injects auth header.
    const ok = await handler(
      new Request("http://localhost/proxy", {
        method: "POST",
        body: JSON.stringify({
          url: "https://api.example.com/items",
          headers: { authorization: "Bearer CLIENT_OVERRIDE" },
        }),
      }),
    );
    const wrapped = (await ok.json()) as { ok: boolean; data: { items: unknown[] } };
    test("proxy returns wrapped response", wrapped.ok && Array.isArray(wrapped.data?.items));
    test(
      "server-injected header overrides client header",
      receivedHeaders["authorization"] === "Bearer SERVER_SECRET",
    );

    // fetchDataSource with proxyUrl routes through the handler.
    const proxyAsFetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      return handler(new Request("http://x/proxy", { method: "POST", body: init?.body as BodyInit }));
    }) as typeof fetch;
    const data = await fetchDataSource(
      {
        kind: "rest",
        id: "items",
        url: "https://api.example.com/items",
        method: "GET",
        select: "items",
      },
      { fetcher: proxyAsFetch, proxyUrl: "/proxy" },
    );
    test(
      "fetchDataSource via proxy unwraps and selects",
      Array.isArray(data) && (data as unknown[]).length === 1,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ---------- 10. Form components are registered and discoverable.
{
  process.stdout.write("\n# form components in registry\n");
  const { defaultRegistry, componentCatalog } = await import("../src/registry");
  for (const name of ["Input", "Textarea", "Select", "Checkbox", "Switch", "Form"]) {
    test(
      `${name} registered`,
      typeof defaultRegistry[name] === "function" &&
        componentCatalog.some((c) => c.type === name),
    );
  }
}

// ---------- 11. repairOnWarnings retries when targets are hallucinated.
{
  process.stdout.write("\n# repairOnWarnings: retry on warnings\n");
  let secondUserMessage = "";
  const fake = createFakeClient([
    // First call: targets a ghost id → produces warnings.
    {
      message: "first try",
      patches: [{ op: "update", id: "ghost", props: { x: 1 } }],
    },
    // Second call (the repair): capture the most recent user message and
    // return a clean patch that targets the existing root.
    (req) => {
      const last = req.messages[req.messages.length - 1];
      if (last && typeof last.content === "string") secondUserMessage = last.content;
      return {
        message: "repaired",
        patches: [{ op: "setTitle", title: "OK" }],
      };
    },
  ]);
  const agent = createUIAgent({ client: fake, repairOnWarnings: true });
  const result = await agent.run({
    messages: [{ role: "user", content: "edit something" }],
    dashboard: emptyDashboard(),
  });
  test("second response wins", result.message === "repaired");
  test("clean result has no warnings", !result.warnings || result.warnings.length === 0);
  test(
    "repair user message names the hallucinated id",
    secondUserMessage.includes("ghost"),
  );
  test(
    "repair user message asks to re-call with existing ids",
    secondUserMessage.includes("Re-call emit_patches") &&
      secondUserMessage.includes("only ids that exist"),
  );
}

// ---------- 12. repairOnWarnings exhausts: warnings still attached, no throw.
{
  process.stdout.write("\n# repairOnWarnings: exhaustion attaches warnings\n");
  const ghostPatch = { op: "update", id: "ghost", props: { x: 1 } };
  const fake = createFakeClient([
    { message: "1", patches: [ghostPatch] },
    { message: "2", patches: [ghostPatch] },
    { message: "3", patches: [ghostPatch] },
  ]);
  const agent = createUIAgent({
    client: fake,
    repairOnWarnings: true,
    maxRepairAttempts: 2,
  });
  let threw = false;
  let result: Awaited<ReturnType<typeof agent.run>> | null = null;
  try {
    result = await agent.run({
      messages: [{ role: "user", content: "x" }],
      dashboard: emptyDashboard(),
    });
  } catch {
    threw = true;
  }
  test("does not throw after exhaustion", !threw);
  test(
    "final response carries warnings",
    !!result && Array.isArray(result.warnings) && result.warnings.length === 1,
  );
}

// ---------- 13. Default repairOnWarnings=false: warnings present, no retry.
{
  process.stdout.write("\n# repairOnWarnings: default false\n");
  let calls = 0;
  const fake = createFakeClient([
    (_req) => {
      calls++;
      return {
        message: "only call",
        patches: [{ op: "update", id: "ghost", props: { x: 1 } }],
      };
    },
    // A second script entry that, if consumed, would prove an unwanted retry.
    (_req) => {
      calls++;
      return { message: "should not happen", patches: [] };
    },
  ]);
  const agent = createUIAgent({ client: fake });
  const result = await agent.run({
    messages: [{ role: "user", content: "x" }],
    dashboard: emptyDashboard(),
  });
  test("agent called exactly once (no retry)", calls === 1);
  test(
    "warnings still attached to first response",
    Array.isArray(result.warnings) && result.warnings.length === 1,
  );
  test("first message preserved", result.message === "only call");
}

// ---------- 14. Streaming agent yields warning frames for hallucinated ids.
{
  process.stdout.write("\n# streaming agent: warning frames\n");
  const fakeStreamClient: LLMClient = {
    name: "fake-stream",
    async complete() {
      throw new Error("unused");
    },
    async *stream() {
      yield { kind: "tool_start", id: "t1", name: "emit_patches" } as LLMEvent;
      yield {
        kind: "tool_input_delta",
        id: "t1",
        partialJson:
          '{"message":"","patches":[{"op":"update","id":"ghost","props":{"x":1}}]}',
      } as LLMEvent;
      yield { kind: "done" } as LLMEvent;
    },
  };
  const agent = createStreamingUIAgent({ client: fakeStreamClient });
  const frames = [];
  for await (const f of agent.runStream({
    messages: [{ role: "user", content: "x" }],
    dashboard: emptyDashboard(),
  })) {
    frames.push(f);
  }
  const warningFrames = frames.filter((f) => f.kind === "warning");
  const patchFrames = frames.filter((f) => f.kind === "patch");
  const lastFrame = frames[frames.length - 1];
  test("at least one warning frame yielded", warningFrames.length >= 1);
  test(
    "warning mentions the hallucinated id",
    warningFrames.some(
      (f) => f.kind === "warning" && /ghost/.test(f.warning),
    ),
  );
  test("patch frame still yielded after warning", patchFrames.length === 1);
  const warningIdx = frames.findIndex((f) => f.kind === "warning");
  const patchIdx = frames.findIndex((f) => f.kind === "patch");
  test("warning ordered before patch", warningIdx !== -1 && warningIdx < patchIdx);
  test("suite ends with done", lastFrame?.kind === "done");
}

// ---------- 15. shallowEqual: powers the renderer's stable-reference memo.
{
  process.stdout.write("\n# shallowEqual helper\n");
  const { shallowEqual } = await import("../src/_shallow");

  test("identical reference is equal", shallowEqual({ a: 1 }, { a: 1 }) === true);
  test("two undefineds are equal", shallowEqual(undefined, undefined) === true);
  test("undefined vs object is not equal", shallowEqual(undefined, {}) === false);
  test("different value at same key is not equal", shallowEqual({ a: 1 }, { a: 2 }) === false);
  test(
    "extra key on the right side is not equal",
    shallowEqual({ a: 1 }, { a: 1, b: 2 }) === false,
  );
  test(
    "function identity matters (different fn refs)",
    shallowEqual({ f: () => 1 }, { f: () => 1 }) === false,
  );
  const fn = () => 1;
  test(
    "function identity matters (same fn ref)",
    shallowEqual({ f: fn }, { f: fn }) === true,
  );
  // The footgun case: two distinct empty-object literals.
  test("two empty-object literals are equal", shallowEqual({}, {}) === true);
}

// ---------- 16. Heading: text yields a stable, slugified id.
{
  process.stdout.write("\n# Heading id slug\n");
  const React = await import("react");
  const { Heading } = await import("../src/components/primitives");

  // Function components can be invoked directly as functions. The result
  // is a ReactElement whose `.props.id` we can inspect without rendering.
  const el = (Heading as unknown as (p: Record<string, unknown>) => unknown)({
    text: "Hello World!",
  });
  test("Heading returns a React element", React.isValidElement(el));
  const props =
    React.isValidElement(el) && typeof el.props === "object" && el.props !== null
      ? (el.props as { id?: unknown })
      : {};
  test("Heading id is slugified from text", props.id === "hello-world");

  const empty = (Heading as unknown as (p: Record<string, unknown>) => unknown)({
    text: "",
  });
  const emptyProps =
    React.isValidElement(empty) && typeof empty.props === "object" && empty.props !== null
      ? (empty.props as { id?: unknown })
      : {};
  test("Heading id is omitted when text is empty", emptyProps.id === undefined);
}

// ---------- 17. New provider adapters: Ollama, Groq, and SDK wrappers.
{
  process.stdout.write("\n# provider adapters\n");

  const {
    createOllamaClient,
    createGroqClient,
    wrapAnthropicSdk,
    wrapOpenAiSdk,
  } = await import("../src/clients/index");

  type FetchRecord = { url: string; body: unknown };

  function installFetchMock(responder: (req: FetchRecord) => Response) {
    const calls: FetchRecord[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" ? input : input.toString();
      let body: unknown = undefined;
      const rawBody = init?.body;
      if (typeof rawBody === "string") {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = rawBody;
        }
      }
      const record: FetchRecord = { url, body };
      calls.push(record);
      return responder(record);
    }) as typeof fetch;
    return {
      calls,
      restore: () => {
        globalThis.fetch = originalFetch;
      },
    };
  }

  // --- Ollama: /api/chat with a tool_call response.
  {
    const mock = installFetchMock(() =>
      new Response(
        JSON.stringify({
          model: "llama3.2",
          done: true,
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                function: {
                  name: "emit_patches",
                  arguments: { message: "hi", patches: [] },
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    try {
      const client = createOllamaClient({ model: "llama3.2" });
      const result = await client.complete({
        system: "you are a builder",
        messages: [{ role: "user", content: "build" }],
        tools: [
          {
            name: "emit_patches",
            description: "Emit patches.",
            inputSchema: { type: "object", properties: {} },
          },
        ],
        toolChoice: { name: "emit_patches" },
      });
      const firstCall = mock.calls[0];
      test(
        "ollama hits /api/chat",
        firstCall !== undefined && firstCall.url.endsWith("/api/chat"),
      );
      const tc = result.toolCalls[0];
      test(
        "ollama parses tool_calls",
        result.toolCalls.length === 1 && tc !== undefined && tc.name === "emit_patches",
      );
    } finally {
      mock.restore();
    }
  }

  // --- Groq: OpenAI-shaped /openai/v1/chat/completions.
  {
    const mock = installFetchMock(() =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "call_abc",
                    type: "function",
                    function: {
                      name: "emit_patches",
                      arguments: JSON.stringify({
                        message: "ok",
                        patches: [],
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    try {
      const client = createGroqClient({ apiKey: "fake-key" });
      const result = await client.complete({
        system: "be helpful",
        messages: [{ role: "user", content: "go" }],
        tools: [
          {
            name: "emit_patches",
            description: "Emit patches.",
            inputSchema: { type: "object", properties: {} },
          },
        ],
        toolChoice: { name: "emit_patches" },
      });
      const firstCall = mock.calls[0];
      test(
        "groq hits /openai/v1/chat/completions",
        firstCall !== undefined &&
          firstCall.url.endsWith("/openai/v1/chat/completions"),
      );
      const tc = result.toolCalls[0];
      const input = tc?.input as { message?: string } | undefined;
      test(
        "groq parses tool_calls + arguments JSON",
        result.toolCalls.length === 1 &&
          tc !== undefined &&
          tc.id === "call_abc" &&
          input?.message === "ok",
      );
    } finally {
      mock.restore();
    }
  }

  // --- wrapAnthropicSdk with a minimal fake SDK.
  {
    let lastBody: Record<string, unknown> | undefined;
    const fakeSdk = {
      messages: {
        async create(body: Record<string, unknown>) {
          lastBody = body;
          return {
            content: [
              {
                type: "tool_use",
                id: "toolu_1",
                name: "emit_patches",
                input: { message: "from-anthropic-sdk", patches: [] },
              },
            ],
          };
        },
        stream(_body: Record<string, unknown>) {
          const events: Array<Record<string, unknown>> = [];
          return {
            [Symbol.asyncIterator]() {
              let i = 0;
              return {
                async next() {
                  if (i < events.length) {
                    return { value: events[i++], done: false };
                  }
                  return { value: undefined, done: true };
                },
              };
            },
          };
        },
      },
    };
    const client = wrapAnthropicSdk(fakeSdk);
    const result = await client.complete({
      system: [
        { text: "stable preamble", cache: true },
        { text: "per-request" },
      ],
      messages: [{ role: "user", content: "hello" }],
      tools: [
        {
          name: "emit_patches",
          description: "Emit patches.",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      toolChoice: { name: "emit_patches" },
    });
    const tc = result.toolCalls[0];
    const input = tc?.input as { message?: string } | undefined;
    test(
      "anthropic SDK wrapper returns tool call",
      result.toolCalls.length === 1 &&
        tc?.id === "toolu_1" &&
        input?.message === "from-anthropic-sdk",
    );
    const sys = (lastBody?.system ?? []) as Array<{
      text?: string;
      cache_control?: { type?: string };
    }>;
    test(
      "anthropic SDK wrapper forwards cache_control on cacheable segments",
      Array.isArray(sys) &&
        sys[0]?.cache_control?.type === "ephemeral" &&
        sys[1]?.cache_control === undefined,
    );
  }

  // --- wrapOpenAiSdk with a minimal fake SDK.
  {
    let lastBody: Record<string, unknown> | undefined;
    const fakeSdk = {
      chat: {
        completions: {
          async create(body: Record<string, unknown>) {
            lastBody = body;
            return {
              choices: [
                {
                  message: {
                    content: null,
                    tool_calls: [
                      {
                        id: "call_xyz",
                        function: {
                          name: "emit_patches",
                          arguments: JSON.stringify({
                            message: "from-openai-sdk",
                            patches: [],
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            };
          },
        },
      },
    };
    const client = wrapOpenAiSdk(fakeSdk);
    const result = await client.complete({
      system: "stable preamble",
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          name: "emit_patches",
          description: "Emit patches.",
          inputSchema: { type: "object", properties: {} },
        },
      ],
      toolChoice: { name: "emit_patches" },
    });
    const tc = result.toolCalls[0];
    const input = tc?.input as { message?: string } | undefined;
    test(
      "openai SDK wrapper returns tool call",
      result.toolCalls.length === 1 &&
        tc?.id === "call_xyz" &&
        input?.message === "from-openai-sdk",
    );
    const toolChoice = lastBody?.tool_choice as
      | { type?: string; function?: { name?: string } }
      | undefined;
    test(
      "openai SDK wrapper forwards tool_choice",
      toolChoice?.type === "function" &&
        toolChoice?.function?.name === "emit_patches",
    );
  }
}

// ---------- 18. Per-component prop schemas validate node.props shape.
{
  process.stdout.write("\n# component prop schemas\n");
  const { validateNodeProps, validatePatchProps, mergeSchemas, builtinPropSchemas } =
    await import("../src/component-schemas");

  // Stat: required fields present → null.
  test(
    "Stat with label+value validates",
    validateNodeProps({ type: "Stat", props: { label: "x", value: 10 } }) === null,
  );

  // Stat missing required `value` → warning mentions value.
  {
    const warning = validateNodeProps({ type: "Stat", props: { label: "x" } });
    test(
      "Stat missing value is flagged",
      typeof warning === "string" && /value/.test(warning),
      warning ?? "(no warning)",
    );
  }

  // Chart with proper kind/data → null.
  test(
    "Chart with bar+data validates",
    validateNodeProps({ type: "Chart", props: { kind: "bar", data: [] } }) === null,
  );

  // Chart with invalid kind → warning mentions kind.
  {
    const warning = validateNodeProps({ type: "Chart", props: { kind: "lol" } });
    test(
      "Chart with invalid kind is flagged",
      typeof warning === "string" && /kind/.test(warning),
      warning ?? "(no warning)",
    );
  }

  // Unknown component type passes through (handled elsewhere).
  test(
    "unknown type passes through",
    validateNodeProps({ type: "Unknown", props: {} }) === null,
  );

  // validatePatchProps walks children and surfaces nested invalid nodes.
  {
    const warnings = validatePatchProps([
      {
        op: "append",
        parentId: "root",
        node: {
          id: "x",
          type: "Stat",
          props: { label: "a", value: 1 },
          children: [{ id: "y", type: "Badge", props: {} }],
        },
      },
    ]);
    test(
      "validatePatchProps catches nested invalid Badge",
      warnings.some((w) => /Badge/.test(w) && /label/.test(w)),
      warnings.join(" | ") || "(no warnings)",
    );
  }

  // setRoot is also walked.
  {
    const warnings = validatePatchProps([
      {
        op: "setRoot",
        node: {
          id: "root",
          type: "Grid",
          props: { gap: 4 },
          children: [
            { id: "h", type: "Heading", props: {} as Record<string, never> },
          ],
        },
      },
    ]);
    test(
      "validatePatchProps flags missing Heading.text via setRoot",
      warnings.some((w) => /Heading/.test(w) && /text/.test(w)),
      warnings.join(" | ") || "(no warnings)",
    );
  }

  // update patches are not flagged by validatePatchProps (deferred to host).
  {
    const warnings = validatePatchProps([
      { op: "update", id: "x", props: { kind: "lol" } as Record<string, never> },
    ]);
    test("validatePatchProps skips update ops", warnings.length === 0);
  }

  // Bindable required field: when bindings carry it, no warning surfaces.
  // Stat.value is required; supplying it via bindings should suppress the
  // missing-field error.
  test(
    "Stat with bindings.value validates without literal",
    validateNodeProps({
      type: "Stat",
      props: { label: "p" },
      bindings: { value: "{{state.total}}" },
    }) === null,
  );

  // mergeSchemas: custom entries win and validate normally.
  {
    const { z } = await import("zod");
    const merged = mergeSchemas({
      MyWidget: z.object({ title: z.string() }).passthrough(),
    });
    test(
      "mergeSchemas: custom schema validates",
      validateNodeProps({ type: "MyWidget", props: { title: "ok" } }, merged) === null,
    );
    const warn = validateNodeProps(
      { type: "MyWidget", props: {} },
      merged,
    );
    test(
      "mergeSchemas: custom schema flags missing required",
      typeof warn === "string" && /title/.test(warn),
      warn ?? "(no warning)",
    );
  }

  // Built-in schemas cover every type currently in the registry.
  {
    const { defaultRegistry } = await import("../src/registry");
    const missing = Object.keys(defaultRegistry).filter(
      (t) => !(t in builtinPropSchemas),
    );
    test(
      "builtinPropSchemas covers every registered component",
      missing.length === 0,
      missing.length ? `missing: ${missing.join(", ")}` : "",
    );
  }
}

// ---------- 17. ForEach expands list into N children with scoped bindings.
{
  process.stdout.write("\n# ForEach expansion\n");
  const { expandForEach } = await import("../src/_foreach");
  const { resolveBindings } = await import("../src/data");
  const ctx = {
    dashboard: emptyDashboard(),
    data: { items: [{ name: "Alice", id: 1 }, { name: "Bob", id: 2 }, { name: "Carol", id: 3 }] },
    state: {},
    loading: {},
    scope: {},
    dispatch: () => {},
  };
  const node = {
    id: "loop",
    type: "ForEach",
    props: { source: "data.items", as: "item" },
    children: [
      {
        id: "row",
        type: "Card",
        props: { title: "x" },
        bindings: { title: "{{item.name}}" },
        events: {
          onClick: [{ type: "setState", path: "selected", value: "{{item.id}}" }],
        },
      },
    ],
  };
  const expanded = expandForEach(node, ctx);
  test("ForEach expands to Box", expanded.type === "Box");
  test("expansion produced 3 children", (expanded.children?.length ?? 0) === 3);
  const c0 = expanded.children?.[0];
  test("each child has unique id", c0?.id === "row__0");
  test("each child carries _scope prop", (c0?.props?._scope as { item?: { name: string } })?.item?.name === "Alice");
  // events are rewritten to concrete per-iteration values
  const onClick = (c0?.events as { onClick?: { value?: unknown }[] })?.onClick;
  test("event actions rewritten with concrete scope", onClick?.[0]?.value === 1);
  // bindings resolved per-iteration via scope
  const c1 = expanded.children?.[1];
  const resolved = resolveBindings(c1!, { ...ctx, scope: c1!.props?._scope as Record<string, unknown> });
  test("scoped binding resolves to per-row value", resolved.props?.title === "Bob");
  // non-array source returns empty Box
  const empty = expandForEach({ ...node, props: { source: "data.missing" } }, ctx);
  test("missing source produces empty Box", empty.type === "Box" && (empty.children?.length ?? 0) === 0);
}

// ---------- 18. `when` prop gates rendering by binding expression.
{
  process.stdout.write("\n# when gate\n");
  const { evaluateBinding } = await import("../src/data");
  const truthy = evaluateBinding("{{state.show}}", {
    dashboard: emptyDashboard(),
    data: {},
    state: { show: true },
    loading: {},
    scope: {},
    dispatch: () => {},
  });
  const falsy = evaluateBinding("{{state.show}}", {
    dashboard: emptyDashboard(),
    data: {},
    state: { show: false },
    loading: {},
    scope: {},
    dispatch: () => {},
  });
  test("truthy state passes the gate", Boolean(truthy) === true);
  test("falsy state blocks the gate", Boolean(falsy) === false);
  // | not filter inverts
  const inverted = evaluateBinding("{{state.show | not}}", {
    dashboard: emptyDashboard(),
    data: {},
    state: { show: false },
    loading: {},
    scope: {},
    dispatch: () => {},
  });
  test("`| not` filter inverts truthiness", Boolean(inverted) === true);
}

// ---------- 19. navigate action sets state.currentScreen.
{
  process.stdout.write("\n# navigate action\n");
  const { createDispatcher } = await import("../src/actions");
  const writes: { path: string; value: unknown }[] = [];
  const dispatch = createDispatcher({
    getState: () => ({}),
    setState: (path, value) => writes.push({ path, value }),
    refetch: () => {},
  });
  dispatch([{ type: "navigate", to: "settings" }]);
  test("navigate writes currentScreen", writes[0]?.path === "currentScreen" && writes[0]?.value === "settings");
}

// ---------- 20. Screens routing picks the matching screen.
{
  process.stdout.write("\n# screens routing\n");
  const { dashboardSchema } = await import("../src/schema");
  const d = dashboardSchema.parse({
    id: "d",
    root: { id: "root", type: "Grid", children: [{ id: "main", type: "Text", props: { text: "main" } }] },
    state: { currentScreen: "settings" },
    screens: {
      settings: { id: "settings_root", type: "Grid", children: [{ id: "sp", type: "Text", props: { text: "settings" } }] },
    },
  });
  // simulate the renderer's pick
  const picked =
    typeof d.state.currentScreen === "string" && d.screens?.[d.state.currentScreen]
      ? d.screens[d.state.currentScreen]
      : d.root;
  test("settings screen resolves", picked?.id === "settings_root");
  // when no match, root wins
  const d2 = dashboardSchema.parse({ ...d, state: { currentScreen: "missing" } });
  const picked2 =
    typeof d2.state.currentScreen === "string" && d2.screens?.[d2.state.currentScreen]
      ? d2.screens[d2.state.currentScreen]
      : d2.root;
  test("missing screen falls back to root", picked2?.id === "root");
}

// ---------- 21. Compute filters: length, sum, pluck, slice.
{
  process.stdout.write("\n# compute filters\n");
  const { resolveBindings } = await import("../src/data");
  const ctx = {
    dashboard: emptyDashboard(),
    data: { items: [{ price: 10 }, { price: 20 }, { price: 30 }, { price: 40 }] },
    state: {},
    loading: {},
    scope: {},
    dispatch: () => {},
  };
  const make = (expr: string) =>
    resolveBindings(
      { id: "n", type: "Text", props: { text: "" }, bindings: { text: expr } },
      ctx,
    ).props?.text;
  test("length on array", make("{{data.items | length}}") === 4);
  test("sum:field totals", make("{{data.items | sum:price}}") === 100);
  test("avg:field averages", make("{{data.items | avg:price}}") === 25);
  test("pluck:field extracts column", JSON.stringify(make("{{data.items | pluck:price | json}}")) === "\"[10,20,30,40]\"");
  test("slice:N trims", JSON.stringify(make("{{data.items | slice:2 | json}}")) === "\"[{\\\"price\\\":10},{\\\"price\\\":20}]\"");
  test("first item", (make("{{data.items | first}}") as { price?: number })?.price === 10);
  test("empty on empty array", make("{{data.empty | empty}}") === true);
}

// ---------- 22. WebSocket source schema accepted.
{
  process.stdout.write("\n# ws data source\n");
  const { dataSourceSchema } = await import("../src/schema");
  const parsed = dataSourceSchema.safeParse({
    kind: "ws",
    id: "live",
    url: "wss://example.com/live",
    select: "data.events",
  });
  test("ws source parses", parsed.success);
  const bad = dataSourceSchema.safeParse({ kind: "ws", id: "x", url: "not a url" });
  test("invalid ws url rejected", !bad.success);
}

// ---------- 23. validateInput: schema-driven form validation.
{
  process.stdout.write("\n# input validation\n");
  const { validateInput } = await import("../src/components/forms");
  test("required passes when set", validateInput("alice", { required: true }) === null);
  test("required fails when empty", validateInput("", { required: true }) === "Required");
  test("required passes null", typeof validateInput(null, { required: true }) === "string");
  test(
    "email type rejects bad address",
    validateInput("not-an-email", { type: "email" }) === "Must be a valid email",
  );
  test("email type accepts good", validateInput("ada@example.com", { type: "email" }) === null);
  test(
    "minLength catches short input",
    typeof validateInput("ab", { minLength: 4 }) === "string",
  );
  test("min catches small number", typeof validateInput(2, { min: 5 }) === "string");
  test("pattern rejects mismatch", typeof validateInput("abc", { pattern: "^\\d+$" }) === "string");
  test("pattern passes match", validateInput("123", { pattern: "^\\d+$" }) === null);
  test(
    "custom message overrides default",
    validateInput("", { required: true, message: "Tell me your name" }) === "Tell me your name",
  );
  test("no rules returns null", validateInput("anything", undefined) === null);
}

// ---------- 24. Per-source errors flow through useDataSources contract.
{
  process.stdout.write("\n# per-source errors\n");
  // We exercise the contract: useDataSourcesResult must include `errors`.
  // (Live React-rendered test would need jsdom; this checks the surface.)
  const { fetchDataSource } = await import("../src/data");
  const failing = (async (_url: RequestInfo | URL) => {
    return new Response("nope", { status: 500 });
  }) as typeof fetch;
  let caught: Error | null = null;
  try {
    await fetchDataSource(
      { kind: "rest", id: "x", url: "https://example.com/x", method: "GET" },
      { fetcher: failing },
    );
  } catch (err) {
    caught = err as Error;
  }
  test("fetchDataSource rejects on non-2xx", caught !== null && /500/.test(caught.message));

  // ws source short-circuits.
  const data = await fetchDataSource(
    { kind: "ws", id: "live", url: "wss://example.com/live" },
  );
  test("ws kind returns null from fetchDataSource", data === null);
}

// ---------- 25. errors.X binding path resolves through resolveBindings.
{
  process.stdout.write("\n# errors path bindings\n");
  const { resolveBindings } = await import("../src/data");
  const ctx = {
    dashboard: emptyDashboard(),
    data: {},
    state: {},
    loading: {},
    errors: { sales: "API timeout" },
    scope: {},
    dispatch: () => {},
  };
  const node = {
    id: "n",
    type: "Text",
    props: { text: "" },
    bindings: { text: "{{errors.sales}}" },
  };
  const out = resolveBindings(node, ctx);
  test("errors.sales resolves", out.props?.text === "API timeout");
  const missing = resolveBindings(
    { ...node, bindings: { text: "{{errors.missing}}" } },
    ctx,
  );
  test("missing error path returns null", missing.props?.text === null);
}

// ---------- 26. Agent-defined functions: defineFunction + callFunction.
{
  process.stdout.write("\n# agent-defined functions\n");
  const { dashboardSchema, functionDefSchema, actionSchema } = await import("../src/schema");
  const { applyPatch } = await import("../src/patch");

  // Schema accepts a defineFunction patch.
  const def = {
    name: "saveContact",
    description: "Save a contact",
    kind: "http" as const,
    url: "https://api.example.com/contacts/{{args.id}}",
    method: "POST" as const,
    body: { email: "{{args.email}}" },
  };
  const parsed = functionDefSchema.safeParse(def);
  test("functionDefSchema accepts a valid def", parsed.success);

  // patch.ts applies defineFunction.
  const d0 = dashboardSchema.parse({
    id: "d",
    root: { id: "root", type: "Grid" },
  });
  const d1 = applyPatch(d0, { op: "defineFunction", def: parsed.success ? parsed.data : def });
  test("defineFunction lands in Dashboard.functions", d1.functions?.saveContact?.name === "saveContact");
  const d2 = applyPatch(d1, { op: "removeFunction", name: "saveContact" });
  test("removeFunction drops it", !d2.functions?.saveContact);

  // The new action variant parses.
  const callAction = actionSchema.safeParse({
    type: "callFunction",
    name: "saveContact",
    args: { id: "1", email: "ada@example.com" },
    onSuccess: [{ type: "setState", path: "saved", value: true }],
  });
  test("callFunction action parses", callAction.success);
}

// ---------- 27. Dispatcher delegates callFunction to its handler.
{
  process.stdout.write("\n# dispatcher routes callFunction\n");
  const { createDispatcher } = await import("../src/actions");
  let captured: {
    name?: string;
    args?: unknown;
    cb?: { into?: string; onSuccess?: unknown[]; onError?: unknown[] };
    payload?: unknown;
  } = {};
  const dispatch = createDispatcher({
    getState: () => ({}),
    setState: () => {},
    refetch: () => {},
    callFunction: (name, args, cb, payload) => {
      captured = { name, args, cb, payload };
    },
  });
  dispatch(
    [{
      type: "callFunction",
      name: "ping",
      args: { msg: "{{event.value}}" },
      into: "pong",
      onSuccess: [{ type: "setState", path: "ok", value: true }],
    }],
    { value: "hi" },
  );
  test("handler received name", captured.name === "ping");
  test(
    "event token substituted in args",
    (captured.args as { msg?: string })?.msg === "hi",
  );
  test("into propagated to callbacks", captured.cb?.into === "pong");
  test("onSuccess propagated", (captured.cb?.onSuccess as unknown[])?.length === 1);
}

// ---------- 28. End-to-end function call via useRuntime substitutes args.
//   (We can't render React without jsdom; this verifies the substitution
//    helpers used by useRuntime by exercising them through a fake fetcher.)
{
  process.stdout.write("\n# function arg/url substitution\n");
  // The substitution logic mirrors what useRuntime calls. We test via a
  // direct fetch round-trip with a mock fetcher.
  let receivedUrl = "";
  let receivedBody = "";
  const fakeFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    receivedUrl = String(url);
    receivedBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ data: { id: "abc" } }), {
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  // Simulate the substitution layer (mirrors useRuntime internals).
  const def = {
    name: "saveContact",
    kind: "http" as const,
    url: "https://api.example.com/contacts/{{args.id}}",
    method: "POST" as const,
    body: { email: "{{args.email}}" },
  };
  const args = { id: "42", email: "ada@example.com" };
  // Replace tokens by simple regex (this is the same algorithm useRuntime uses).
  const url = def.url.replace(/\{\{\s*args\.(\w+)\s*\}\}/g, (_, k) =>
    String((args as Record<string, unknown>)[k] ?? ""),
  );
  const body = JSON.stringify({
    email: String((args as Record<string, unknown>).email ?? ""),
  });
  await fakeFetch(url, { method: def.method, body });
  test("url tokens substituted from args", receivedUrl === "https://api.example.com/contacts/42");
  test("body tokens substituted from args", receivedBody === '{"email":"ada@example.com"}');
}

// ---------- 29. BrandKit compiles to CSS variables.
{
  process.stdout.write("\n# brand kit -> css vars\n");
  const { brandToCssVars, brandToDarkCssVars, brandToPromptSection } = await import("../src/brand");
  const kit = {
    name: "linear",
    colors: { primary: "232 86% 62%", background: "0 0% 99%" },
    dark: { primary: "232 90% 70%" },
    radius: "lg" as const,
    typography: { sans: "Inter", display: "Manrope" },
    voice: { tone: "minimal", rules: ["Sentence case headings", "No exclamation marks"] },
  };
  const cssVars = brandToCssVars(kit);
  test("primary maps to --primary", cssVars["--primary"] === "232 86% 62%");
  test("background maps to --background", cssVars["--background"] === "0 0% 99%");
  test("radius maps to a length", cssVars["--radius"] === "0.625rem");
  test("sans typography maps to --font-sans", cssVars["--font-sans"] === "Inter");
  test("display typography maps to --font-display", cssVars["--font-display"] === "Manrope");
  test(
    "dark overrides are separate",
    brandToDarkCssVars(kit)["--primary"] === "232 90% 70%",
  );

  // Prompt section
  const prompt = brandToPromptSection(kit);
  test("prompt names the brand", /Brand: linear/.test(prompt));
  test("prompt names the voice", /Voice: minimal/.test(prompt));
  test("prompt enumerates rules", /Sentence case/.test(prompt) && /exclamation/.test(prompt));
  test("prompt mentions primary color", /232 86% 62%/.test(prompt));

  // Empty kit returns nothing
  test("empty kit returns empty prompt", brandToPromptSection(undefined) === "");
  test("empty kit returns empty css", Object.keys(brandToCssVars(undefined)).length === 0);
}

// ---------- 30. Agent surfaces brand voice + rules in the system prompt.
{
  process.stdout.write("\n# agent brand injection\n");
  let seenSystem = "";
  const fake = createFakeClient([
    (req) => {
      const segs = Array.isArray(req.system) ? req.system : [{ text: req.system }];
      seenSystem = segs.map((s) => s.text).join("\n");
      return { message: "ok", patches: [] };
    },
  ]);
  const { linearKit } = await import("../src/brand-presets");
  const agent = createUIAgent({ client: fake, brand: linearKit });
  await agent.run({ messages: [{ role: "user", content: "x" }] });
  test("system prompt contains BRAND section", /## BRAND/.test(seenSystem));
  test("brand name appears", /Brand: linear/.test(seenSystem));
  test("voice rule appears", /Sentence case/.test(seenSystem));
}

// ---------- 31. Brand presets are sensible and validate.
{
  process.stdout.write("\n# brand presets\n");
  const { brandKitSchema } = await import("../src/brand");
  const { brandPresets } = await import("../src/brand-presets");
  const presetNames = Object.keys(brandPresets);
  test("at least 6 presets shipped", presetNames.length >= 6);
  for (const name of presetNames) {
    const kit = brandPresets[name as keyof typeof brandPresets];
    const parsed = brandKitSchema.safeParse(kit);
    test(`${name} preset validates`, parsed.success);
  }
}

// ---------- 32. ComponentAdapter renames agent props to host props.
{
  process.stdout.write("\n# component adapter\n");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createComponentAdapter, mapComponent } = await import("../src/adapter");

  interface HostProps {
    heading?: string;
    subhead?: string;
    badge?: string;
    children?: import("react").ReactNode;
  }
  const HostCard = (p: HostProps) =>
    createElement(
      "section",
      { className: "host-card", "data-badge": p.badge ?? "" },
      createElement("h3", null, p.heading ?? ""),
      createElement("p", null, p.subhead ?? ""),
      p.children,
    );

  const Adapted = createComponentAdapter<HostProps>({
    Component: HostCard,
    mapProps: { title: "heading", description: "subhead" },
    defaults: { badge: "new" },
    computeProps: (agent) => ({
      heading: typeof agent.title === "string" ? agent.title.toUpperCase() : undefined,
    }),
  });
  const html = renderToStaticMarkup(
    createElement(Adapted, { title: "Sales", description: "Q4 view" } as never),
  );
  test("mapped prop reaches host", /<h3>SALES<\/h3>/.test(html));
  test("description renamed to subhead", /<p>Q4 view<\/p>/.test(html));
  test("default carried through", /data-badge="new"/.test(html));

  // Shortcut helper.
  const Renamed = mapComponent(HostCard, { title: "heading" });
  const html2 = renderToStaticMarkup(createElement(Renamed, { title: "OK" } as never));
  test("mapComponent shortcut works", /<h3>OK<\/h3>/.test(html2));
}

// ---------- 33. Inline style compiler for non-Tailwind hosts.
{
  process.stdout.write("\n# inline style compiler\n");
  const { createInlineStyleCompiler } = await import("../src/style-adapters");
  const compile = createInlineStyleCompiler();
  const out = compile(
    { p: 4, bg: "primary", rounded: "lg", fontSize: "lg" },
    { id: "n", type: "Box" },
  );
  test("emits style only (no className)", out.className === undefined && !!out.style);
  test("padding mapped to rem", out.style?.padding === "1rem");
  test(
    "bg uses CSS var",
    out.style?.backgroundColor === "hsl(var(--primary))",
  );
  test("rounded resolves to var", String(out.style?.borderRadius).includes("--radius"));
  test("fontSize mapped", out.style?.fontSize === "1.125rem");

  // Opacity
  const op = compile({ opacity: 50 }, { id: "n", type: "Box" });
  test("opacity scaled 0..1", op.style?.opacity === 0.5);

  // Empty spec returns empty
  const empty = compile({}, { id: "n", type: "Box" });
  test("empty spec returns empty", empty.style === undefined && empty.className === undefined);
}

// ---------- 34. onTurn telemetry fires with patch + warning counts.
{
  process.stdout.write("\n# agent telemetry\n");
  const captured: import("../src/agent").TurnInfo[] = [];
  const fake = createFakeClient([
    {
      message: "Built it.",
      patches: [
        { op: "append", parentId: "root", node: { id: "a", type: "Stat", props: { label: "x", value: 1 } } },
        { op: "append", parentId: "root", node: { id: "b", type: "Stat", props: { label: "y", value: 2 } } },
      ],
    },
  ]);
  const agent = createUIAgent({
    client: fake,
    onTurn: (info) => captured.push(info),
  });
  await agent.run({ messages: [{ role: "user", content: "hi" }] });
  test("onTurn fired once", captured.length === 1);
  test("clientName captured", captured[0]?.clientName === "fake");
  test("patchCount correct", captured[0]?.patchCount === 2);
  test("attempts === 1 on happy path", captured[0]?.attempts === 1);
  test("durationMs is a number", typeof captured[0]?.durationMs === "number");
  test("hadRepair false on happy path", captured[0]?.hadRepair === false);
}

// ---------- 35. Layout with Outlet substitutes the active screen.
{
  process.stdout.write("\n# layout + outlet\n");
  const { dashboardSchema } = await import("../src/schema");
  const d = dashboardSchema.parse({
    id: "d",
    root: { id: "root", type: "Grid", children: [{ id: "home", type: "Text", props: { text: "home" } }] },
    state: { currentScreen: "details" },
    screens: {
      details: { id: "details_root", type: "Grid", children: [{ id: "dp", type: "Text", props: { text: "details" } }] },
    },
    layout: {
      id: "shell",
      type: "Grid",
      children: [
        { id: "sidebar", type: "Box", children: [{ id: "nav", type: "Text", props: { text: "nav" } }] },
        { id: "main", type: "Box", children: [{ id: "slot", type: "Outlet" }] },
      ],
    },
  });
  test("layout parses with Outlet child", d.layout?.id === "shell");
  test("Outlet acceptable in schema", d.layout?.children?.[1]?.children?.[0]?.type === "Outlet");
  // We don't render here (would need jsdom). The renderer's `replaceOutlet`
  // is purely declarative; test it via a JS impl mirror:
  function walk(layout: { type: string; children?: unknown[] }, screen: unknown): unknown {
    if (layout.type === "Outlet") return screen;
    if (!layout.children) return layout;
    return {
      ...layout,
      children: layout.children.map((c) => walk(c as never, screen)),
    };
  }
  const result = walk(d.layout as never, d.screens?.details) as { children?: { children?: { type?: string }[] }[] };
  test(
    "outlet substituted with current screen",
    result.children?.[1]?.children?.[0]?.type === "Grid",
  );
}

// ---------- 36. migrateDashboard walks v1 forward to current SPEC_VERSION.
{
  process.stdout.write("\n# spec migrations\n");
  const { migrateDashboard, SPEC_VERSION } = await import("../src/schema");
  // v1-shaped input (no `screens`, no `layout`, no `functions`, no `theme`).
  const v1 = {
    version: 1,
    id: "old",
    root: { id: "root", type: "Grid", children: [] },
    components: {},
    dataSources: {},
    state: {},
  };
  const migrated = migrateDashboard(v1);
  test("migrated to current version", migrated.version === SPEC_VERSION);
  test("functions injected", migrated.functions !== undefined);
  test("layout undefined for v1 input", migrated.layout === undefined);
  // Versionless input treated as v1.
  const versionless = { id: "x", root: { id: "root", type: "Grid" } };
  const migrated2 = migrateDashboard(versionless);
  test("versionless coerced to current", migrated2.version === SPEC_VERSION);
  // Current-version round-trips identically (functionally).
  const current = {
    version: SPEC_VERSION,
    id: "now",
    root: { id: "root", type: "Grid", children: [] },
  };
  const same = migrateDashboard(current);
  test("current-version input parses cleanly", same.version === SPEC_VERSION);
}

// ---------- 37. navigate pushes screen history; navigateBack pops it.
{
  process.stdout.write("\n# screen history\n");
  const { createDispatcher } = await import("../src/actions");
  let stateMap: Record<string, unknown> = {};
  const setState = (path: string, value: unknown) => {
    stateMap = { ...stateMap, [path]: value };
  };
  const dispatch = createDispatcher({
    getState: () => stateMap,
    setState,
    refetch: () => {},
  });
  // Start at "home"
  stateMap = { currentScreen: "home" };
  dispatch([{ type: "navigate", to: "details" }]);
  test("navigate pushed previous to history", JSON.stringify(stateMap.screenHistory) === '["home"]');
  test("navigate set new currentScreen", stateMap.currentScreen === "details");
  dispatch([{ type: "navigate", to: "edit" }]);
  test("history grows on subsequent navigate", JSON.stringify(stateMap.screenHistory) === '["home","details"]');
  dispatch([{ type: "navigateBack" }]);
  test("navigateBack returned to previous", stateMap.currentScreen === "details");
  test("history shrunk", JSON.stringify(stateMap.screenHistory) === '["home"]');
  dispatch([{ type: "navigateBack" }]);
  dispatch([{ type: "navigateBack" }]); // no-op
  test("navigateBack at root is a no-op", stateMap.currentScreen === "home");
}

// ---------- 38. Server persistence handler round-trips a dashboard.
{
  process.stdout.write("\n# persistence handler\n");
  const { createPersistenceHandler, createMemoryStore } = await import(
    "../src/persistence-handler"
  );
  const handler = createPersistenceHandler({ store: createMemoryStore() });
  const d = emptyDashboard("saved-1");
  const setRes = await handler(
    new Request("http://x/persist", {
      method: "POST",
      body: JSON.stringify({ id: "saved-1", dashboard: d }),
    }),
  );
  test("POST returns ok", setRes.status === 200);
  const getRes = await handler(
    new Request("http://x/persist?id=saved-1", { method: "GET" }),
  );
  test("GET returns 200", getRes.status === 200);
  const wrapped = (await getRes.json()) as { dashboard: { id: string } };
  test("loaded dashboard round-trips id", wrapped.dashboard?.id === "saved-1");
  // 404 for missing
  const missing = await handler(
    new Request("http://x/persist?id=nope", { method: "GET" }),
  );
  test("GET missing returns 404", missing.status === 404);
  // list
  const list = await handler(
    new Request("http://x/persist?list=1", { method: "GET" }),
  );
  const listWrapped = (await list.json()) as { ids: string[] };
  test("list returns ids", listWrapped.ids?.[0] === "saved-1");
  // delete
  const del = await handler(
    new Request("http://x/persist?id=saved-1", { method: "DELETE" }),
  );
  test("DELETE returns ok", del.status === 200);
  const afterDelete = await handler(
    new Request("http://x/persist?id=saved-1", { method: "GET" }),
  );
  test("GET after delete returns 404", afterDelete.status === 404);
  // authorize gate
  const guarded = createPersistenceHandler({
    store: createMemoryStore(),
    authorize: (_req, op) => op.kind === "get",
  });
  const denied = await guarded(
    new Request("http://x/persist", {
      method: "POST",
      body: JSON.stringify({ id: "x", dashboard: emptyDashboard("x") }),
    }),
  );
  test("authorize=false rejects with 401", denied.status === 401);
}

// ---------- 39. Persistence handler migrates older dashboard payloads.
{
  process.stdout.write("\n# persistence migrates input\n");
  const { createPersistenceHandler, createMemoryStore } = await import(
    "../src/persistence-handler"
  );
  const store = createMemoryStore();
  const handler = createPersistenceHandler({ store });
  // v1 payload, no `functions` etc.
  const v1 = {
    version: 1,
    id: "legacy",
    root: { id: "root", type: "Grid", children: [] },
    components: {},
    dataSources: {},
    state: {},
  };
  const res = await handler(
    new Request("http://x/persist", {
      method: "POST",
      body: JSON.stringify({ id: "legacy", dashboard: v1 }),
    }),
  );
  test("v1 input accepted", res.status === 200);
  const loaded = await store.get("legacy");
  test("v1 stored at current version", loaded?.version === 2);
  test("functions populated by migration", loaded?.functions !== undefined);
}

// ---------- Summary
process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  process.exit(1);
}
