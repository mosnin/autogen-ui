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

// ---------- Summary
process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  process.exit(1);
}
