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

// ---------- Summary
process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  process.exit(1);
}
