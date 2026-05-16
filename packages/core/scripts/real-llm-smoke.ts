// Real-LLM smoke test — runs only when an API key is configured.
//
//   ANTHROPIC_API_KEY=sk-... pnpm --filter @autogen-ui/core smoke:llm
//   OPENAI_API_KEY=sk-... pnpm --filter @autogen-ui/core smoke:llm
//
// Exits 0 on success, 1 on failure, 2 if no key is set (so CI can treat it
// as "skipped" instead of "failed").

import { applyPatches } from "../src/patch";
import { createUIAgent, type LLMClient } from "../src/agent";
import { defaultCapabilities } from "../src/capabilities";
import { createAnthropicClient, createOpenAIClient } from "../src/clients";
import { assertValidPatches } from "../src/eval/harness";
import { emptyDashboard } from "../src/schema";

function getClient(): LLMClient | null {
  const model = process.env.AUTOGEN_UI_MODEL || undefined;
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY, model });
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY, model });
  }
  return null;
}

const client = getClient();
if (!client) {
  process.stdout.write(
    "skip: no ANTHROPIC_API_KEY or OPENAI_API_KEY set — real-LLM smoke skipped\n",
  );
  process.exit(2);
}

process.stdout.write(`# real-LLM smoke against ${client.name}\n`);

const agent = createUIAgent({ client, capabilities: defaultCapabilities, maxRepairAttempts: 2 });

let pass = 0;
let fail = 0;
function test(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    process.stdout.write(`  ok  ${name}\n`);
  } else {
    fail++;
    process.stdout.write(`  FAIL  ${name}${detail ? "\n        " + detail : ""}\n`);
  }
}

try {
  // 1. Build a dashboard from scratch.
  process.stdout.write("\n## build from scratch\n");
  const r1 = await agent.run({
    messages: [
      {
        role: "user",
        content:
          "Build me a small revenue dashboard with an MRR stat, a churn stat, and a bar chart of monthly signups for the last 6 months. Use realistic sample numbers.",
      },
    ],
    dashboard: null,
  });
  test("response has at least 1 patch", r1.patches.length > 0);
  test("patches validate", assertValidPatches(r1) === null);
  const d1 = applyPatches(emptyDashboard(), r1.patches);
  test("root has children", (d1.root.children?.length ?? 0) > 0);
  test(
    "no target warnings on fresh build",
    !r1.warnings || r1.warnings.length === 0,
    r1.warnings?.join("; "),
  );

  // 2. Follow-up edit using returned ids.
  process.stdout.write("\n## follow-up edit\n");
  const r2 = await agent.run({
    messages: [
      { role: "user", content: "build a small revenue dashboard" },
      {
        role: "assistant",
        content: r1.message ?? "(built)",
      },
      {
        role: "user",
        content: "Make the MRR stat span the full width and recolor its background to primary.",
      },
    ],
    dashboard: d1,
  });
  test("follow-up returned patches", r2.patches.length > 0);
  test("follow-up validates", assertValidPatches(r2) === null);
  test(
    "follow-up has no hallucinated id warnings",
    !r2.warnings || r2.warnings.length === 0,
    r2.warnings?.join("; "),
  );

  // 3. Question-only turn — model should answer with empty patches.
  process.stdout.write("\n## question-only turn\n");
  const r3 = await agent.run({
    messages: [{ role: "user", content: "What components do you have available?" }],
    dashboard: null,
  });
  test("answer comes back as message", typeof r3.message === "string" && r3.message.length > 0);
  test("no patches for a question", r3.patches.length === 0);

  process.stdout.write(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
} catch (err) {
  process.stdout.write(`\nFAIL: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
