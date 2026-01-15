import type { Flow } from "./types";
import { FLOW_FILE } from "./types";

async function main() {
  const file = Bun.file(FLOW_FILE);
  if (!(await file.exists())) {
    console.log(JSON.stringify({ error: "No flow.json found." }));
    process.exit(1);
  }

  const flow: Flow = await file.json();

  const summary = {
    name: flow.name,
    baseUrl: flow.baseUrl,
    context: flow.context,
    steps: flow.steps.map((s, i) => ({
      index: i,
      name: s.name,
      status: s.status,
      duration: s.duration,
      error: s.error,
      validationError: s.validationError,
    })),
    pending: flow.steps.filter(s => s.status === "pending").length,
    done: flow.steps.filter(s => s.status === "done").length,
    failed: flow.steps.filter(s => s.status === "failed").length,
    errors: flow.steps.filter(s => s.status === "error").length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
