import type { Flow } from "./types";
import { FLOW_FILE, ARNOLD_FILE } from "./types";

async function loadArnoldEnv(): Promise<Record<string, string>> {
  const file = Bun.file(ARNOLD_FILE);
  if (!(await file.exists())) {
    return {};
  }

  const content = await file.text();
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      env[key] = value;
    }
  }

  return env;
}

async function main() {
  const file = Bun.file(FLOW_FILE);
  if (!(await file.exists())) {
    console.log(JSON.stringify({ error: "No flow.json found. Create one first." }));
    process.exit(1);
  }

  const flow: Flow = await file.json();

  // Load .arnold env vars (override context)
  const arnoldEnv = await loadArnoldEnv();
  flow.context = { ...flow.context, ...arnoldEnv };

  const stepIndex = flow.steps.findIndex(s => s.status === "pending");
  if (stepIndex === -1) {
    console.log(JSON.stringify({ error: "No pending steps to run." }));
    process.exit(0);
  }

  const step = flow.steps[stepIndex];

  const query = substituteContext(step.query, flow.context);
  const variables = step.variables
    ? JSON.parse(substituteContext(JSON.stringify(step.variables), flow.context))
    : undefined;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (flow.headers) {
    for (const [k, v] of Object.entries(flow.headers)) {
      headers[k] = substituteContext(v, flow.context);
    }
  }

  const start = Date.now();
  try {
    const res = await fetch(flow.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    const duration = Date.now() - start;

    if (data.errors) {
      step.status = "error";
      step.error = JSON.stringify(data.errors);
      step.result = data;
    } else {
      step.result = data;

      // Validate expected if present
      if (step.expected) {
        const validation = validateExpected(step.expected, data);
        if (!validation.valid) {
          step.status = "failed";
          step.validationError = validation.error;
        } else {
          step.status = "done";
        }
      } else {
        step.status = "done";
      }

      // Extract to context even on failure (data exists)
      if (step.extractToContext) {
        for (const [key, path] of Object.entries(step.extractToContext)) {
          flow.context[key] = getPath(data, path);
        }
      }
    }
    step.duration = duration;

  } catch (err) {
    step.status = "error";
    step.error = err instanceof Error ? err.message : String(err);
    step.duration = Date.now() - start;
  }

  await Bun.write(FLOW_FILE, JSON.stringify(flow, null, 2));

  console.log(JSON.stringify({
    step: step.name,
    status: step.status,
    duration: step.duration,
    result: step.result,
    error: step.error,
    validationError: step.validationError,
    context: flow.context,
    remaining: flow.steps.filter(s => s.status === "pending").length,
  }, null, 2));
}

function substituteContext(str: string, context: Record<string, unknown>): string {
  return str.replace(/\$\{(\w+)\}/g, (_, key) => String(context[key] ?? ""));
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function validateExpected(
  expected: unknown,
  actual: unknown,
  path = ""
): { valid: boolean; error?: string } {
  // Primitive comparison
  if (typeof expected !== "object" || expected === null) {
    if (expected !== actual) {
      return {
        valid: false,
        error: `Expected ${path || "value"} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      };
    }
    return { valid: true };
  }

  // Actual must also be an object
  if (typeof actual !== "object" || actual === null) {
    return {
      valid: false,
      error: `Expected ${path || "value"} to be an object, got ${JSON.stringify(actual)}`,
    };
  }

  // Check each expected key exists and matches in actual
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = (actual as Record<string, unknown>)[key];
    const newPath = path ? `${path}.${key}` : key;

    const result = validateExpected(expectedValue, actualValue, newPath);
    if (!result.valid) return result;
  }

  return { valid: true };
}

main();
