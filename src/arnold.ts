#!/usr/bin/env node
import type { SetDefinition, SetState, GlobalState, StepState, StepDefinition } from "./types";
import { SETS_DIR, STATE_FILE, ENV_FILE } from "./types";
import { mkdir, readFile, writeFile, readdir, access } from "fs/promises";

// ============================================================================
// Utility functions
// ============================================================================

function out(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function err(message: string): never {
  out({ error: message });
  process.exit(1);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function ensureDirs(): Promise<void> {
  await mkdir(SETS_DIR, { recursive: true });
}

async function loadEnv(): Promise<Record<string, string>> {
  if (!(await exists(ENV_FILE))) return {};

  const content = await readFile(ENV_FILE, "utf-8");
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
    }
  }
  return env;
}

async function loadState(): Promise<GlobalState> {
  if (!(await exists(STATE_FILE))) return {};
  return JSON.parse(await readFile(STATE_FILE, "utf-8"));
}

async function saveState(state: GlobalState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function loadSet(name: string): Promise<SetDefinition> {
  const path = `${SETS_DIR}/${name}.json`;
  if (!(await exists(path))) err(`Set '${name}' not found`);
  return JSON.parse(await readFile(path, "utf-8"));
}

async function saveSet(name: string, set: SetDefinition): Promise<void> {
  await ensureDirs();
  await writeFile(`${SETS_DIR}/${name}.json`, JSON.stringify(set, null, 2));
}

function getOrCreateSetState(state: GlobalState, setKey: string, set: SetDefinition): SetState {
  if (!state[setKey]) {
    state[setKey] = {
      context: {},
      steps: set.steps.map(() => ({ status: "pending" })),
    };
  }
  // Ensure steps array matches definition length
  const setState = state[setKey];
  while (setState.steps.length < set.steps.length) {
    setState.steps.push({ status: "pending" });
  }
  return setState;
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
  if (typeof expected !== "object" || expected === null) {
    if (expected !== actual) {
      return {
        valid: false,
        error: `Expected ${path || "value"} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      };
    }
    return { valid: true };
  }

  if (typeof actual !== "object" || actual === null) {
    return {
      valid: false,
      error: `Expected ${path || "value"} to be an object, got ${JSON.stringify(actual)}`,
    };
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = (actual as Record<string, unknown>)[key];
    const newPath = path ? `${path}.${key}` : key;
    const result = validateExpected(expectedValue, actualValue, newPath);
    if (!result.valid) return result;
  }

  return { valid: true };
}

// ============================================================================
// Commands
// ============================================================================

async function cmdInit(name: string, fromFile?: string, fromStdin?: boolean): Promise<void> {
  await ensureDirs();

  const setPath = `${SETS_DIR}/${name}.json`;
  if (await exists(setPath)) err(`Set '${name}' already exists`);

  let set: SetDefinition;

  if (fromStdin) {
    const input = await readStdin();
    if (!input.trim()) err("No input received from stdin");

    let content: Record<string, unknown>;
    try {
      content = JSON.parse(input);
    } catch {
      err("Invalid JSON from stdin");
    }

    set = {
      name: content.name as string || name,
      baseUrl: content.baseUrl as string,
      headers: content.headers as Record<string, string> | undefined,
      steps: ((content.steps as Record<string, unknown>[]) || []).map((s) => ({
        name: s.name as string,
        query: s.query as string,
        variables: s.variables as Record<string, unknown> | undefined,
        extractToContext: s.extractToContext as Record<string, string> | undefined,
        expected: s.expected as Record<string, unknown> | undefined,
      })),
    };
  } else if (fromFile) {
    if (!(await exists(fromFile))) err(`Source file '${fromFile}' not found`);
    const content = JSON.parse(await readFile(fromFile, "utf-8"));
    // Strip any execution state if present (legacy format)
    set = {
      name: content.name || name,
      baseUrl: content.baseUrl,
      headers: content.headers,
      steps: content.steps.map((s: Record<string, unknown>) => ({
        name: s.name,
        query: s.query,
        variables: s.variables,
        extractToContext: s.extractToContext,
        expected: s.expected,
      })),
    };
  } else {
    set = {
      name,
      baseUrl: "http://localhost:3000/graphql",
      steps: [],
    };
  }

  await saveSet(name, set);
  out({ created: name, path: setPath });
}

async function cmdAddStep(
  setName: string,
  stepName: string,
  query: string,
  variables?: string,
  extractToContext?: string,
  expected?: string
): Promise<void> {
  const set = await loadSet(setName);

  const step: StepDefinition = {
    name: stepName,
    query,
  };

  if (variables) {
    try {
      step.variables = JSON.parse(variables);
    } catch {
      err(`Invalid JSON for --variables: ${variables}`);
    }
  }

  if (extractToContext) {
    try {
      step.extractToContext = JSON.parse(extractToContext);
    } catch {
      err(`Invalid JSON for --extract: ${extractToContext}`);
    }
  }

  if (expected) {
    try {
      step.expected = JSON.parse(expected);
    } catch {
      err(`Invalid JSON for --expected: ${expected}`);
    }
  }

  set.steps.push(step);
  await saveSet(setName, set);

  // Update state to include new pending step
  const state = await loadState();
  if (state[setName]) {
    state[setName].steps.push({ status: "pending" });
    await saveState(state);
  }

  out({
    added: stepName,
    set: setName,
    index: set.steps.length - 1,
    step,
  });
}

async function cmdRun(name: string, full: boolean, stepIndex?: number): Promise<void> {
  const set = await loadSet(name);
  const state = await loadState();
  const setState = getOrCreateSetState(state, name, set);
  const env = await loadEnv();

  const context = { ...setState.context, ...env };

  if (full) {
    await runFull(set, setState, context, state);
  } else {
    await runSingle(set, setState, context, state, stepIndex);
  }
}

async function runSingle(
  set: SetDefinition,
  setState: SetState,
  context: Record<string, unknown>,
  state: GlobalState,
  targetIndex?: number
): Promise<void> {
  let stepIndex: number;

  if (targetIndex !== undefined) {
    if (targetIndex < 0 || targetIndex >= set.steps.length) {
      err(`Step index ${targetIndex} out of range (0-${set.steps.length - 1})`);
    }
    stepIndex = targetIndex;
    // Reset this step to pending so it can be re-run
    setState.steps[stepIndex].status = "pending";
  } else {
    stepIndex = setState.steps.findIndex(s => s.status === "pending");
    if (stepIndex === -1) {
      out({ error: "No pending steps", set: set.name });
      process.exit(0);
    }
  }

  const stepDef = set.steps[stepIndex];
  const stepState = setState.steps[stepIndex];

  await executeStep(set, stepDef, stepState, context);
  setState.context = context;
  await saveState(state);

  out({
    step: stepDef.name,
    index: stepIndex,
    status: stepState.status,
    duration: stepState.duration,
    result: stepState.result,
    error: stepState.error,
    validationError: stepState.validationError,
    context,
    remaining: setState.steps.filter(s => s.status === "pending").length,
  });
}

async function runFull(
  set: SetDefinition,
  setState: SetState,
  context: Record<string, unknown>,
  state: GlobalState
): Promise<void> {
  const completedSteps: { name: string; index: number; status: string; duration?: number }[] = [];
  const totalStart = Date.now();

  for (let i = 0; i < set.steps.length; i++) {
    const stepDef = set.steps[i];
    const stepState = setState.steps[i];

    if (stepState.status !== "pending") {
      completedSteps.push({
        name: stepDef.name,
        index: i,
        status: stepState.status,
        duration: stepState.duration,
      });
      continue;
    }

    await executeStep(set, stepDef, stepState, context);
    setState.context = context;
    await saveState(state);

    completedSteps.push({
      name: stepDef.name,
      index: i,
      status: stepState.status,
      duration: stepState.duration,
    });

    if (stepState.status === "error" || stepState.status === "failed") {
      out({
        set: set.name,
        status: stepState.status,
        stoppedAt: i,
        error: stepState.error || stepState.validationError,
        completedSteps,
        duration: Date.now() - totalStart,
      });
      process.exit(1);
    }
  }

  out({
    set: set.name,
    status: "done",
    steps: completedSteps,
    duration: Date.now() - totalStart,
  });
}

async function executeStep(
  set: SetDefinition,
  stepDef: SetDefinition["steps"][0],
  stepState: StepState,
  context: Record<string, unknown>
): Promise<void> {
  const query = substituteContext(stepDef.query, context);
  const variables = stepDef.variables
    ? JSON.parse(substituteContext(JSON.stringify(stepDef.variables), context))
    : undefined;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (set.headers) {
    for (const [k, v] of Object.entries(set.headers)) {
      headers[k] = substituteContext(v, context);
    }
  }

  const start = Date.now();
  try {
    const res = await fetch(set.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    stepState.duration = Date.now() - start;

    if (data.errors) {
      stepState.status = "error";
      stepState.error = data.errors;  // Keep as object, not stringified
      stepState.result = data;
      return;
    }

    stepState.result = data;

    if (stepDef.expected) {
      const validation = validateExpected(stepDef.expected, data);
      if (!validation.valid) {
        stepState.status = "failed";
        stepState.validationError = validation.error;
      } else {
        stepState.status = "done";
      }
    } else {
      stepState.status = "done";
    }

    if (stepDef.extractToContext) {
      for (const [key, path] of Object.entries(stepDef.extractToContext)) {
        context[key] = getPath(data, path);
      }
    }
  } catch (e) {
    stepState.status = "error";
    stepState.error = e instanceof Error ? e.message : String(e);
    stepState.duration = Date.now() - start;
  }
}

async function cmdStatus(name: string): Promise<void> {
  const set = await loadSet(name);
  const state = await loadState();
  const setState = getOrCreateSetState(state, name, set);

  const steps = set.steps.map((s, i) => ({
    index: i,
    name: s.name,
    status: setState.steps[i]?.status ?? "pending",
    duration: setState.steps[i]?.duration,
    error: setState.steps[i]?.error,
    validationError: setState.steps[i]?.validationError,
  }));

  out({
    name: set.name,
    baseUrl: set.baseUrl,
    context: setState.context,
    steps,
    pending: steps.filter(s => s.status === "pending").length,
    done: steps.filter(s => s.status === "done").length,
    failed: steps.filter(s => s.status === "failed").length,
    errors: steps.filter(s => s.status === "error").length,
  });
}

async function cmdPreview(name: string, stepIndex?: number): Promise<void> {
  const set = await loadSet(name);
  const state = await loadState();
  const setState = getOrCreateSetState(state, name, set);
  const env = await loadEnv();

  const context = { ...setState.context, ...env };

  let targetIndex: number;
  if (stepIndex !== undefined) {
    if (stepIndex < 0 || stepIndex >= set.steps.length) {
      err(`Step index ${stepIndex} out of range (0-${set.steps.length - 1})`);
    }
    targetIndex = stepIndex;
  } else {
    targetIndex = setState.steps.findIndex(s => s.status === "pending");
    if (targetIndex === -1) {
      out({ error: "No pending steps to preview", set: set.name });
      process.exit(0);
    }
  }

  const stepDef = set.steps[targetIndex];

  const resolvedQuery = substituteContext(stepDef.query, context);
  const resolvedVariables = stepDef.variables
    ? JSON.parse(substituteContext(JSON.stringify(stepDef.variables), context))
    : undefined;

  const resolvedHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (set.headers) {
    for (const [k, v] of Object.entries(set.headers)) {
      resolvedHeaders[k] = substituteContext(v, context);
    }
  }

  out({
    preview: true,
    step: stepDef.name,
    index: targetIndex,
    status: setState.steps[targetIndex].status,
    url: set.baseUrl,
    headers: resolvedHeaders,
    body: {
      query: resolvedQuery,
      variables: resolvedVariables,
    },
    context,
  });
}

async function cmdList(): Promise<void> {
  await ensureDirs();
  const files = await readdir(SETS_DIR);
  const state = await loadState();

  const sets: { name: string; pending: number; done: number; failed: number; errors: number }[] = [];

  for (const file of files.filter(f => f.endsWith(".json"))) {
    const name = file.replace(".json", "");
    const set = await loadSet(name);
    const setState = getOrCreateSetState(state, name, set);

    sets.push({
      name,
      pending: setState.steps.filter(s => s.status === "pending").length,
      done: setState.steps.filter(s => s.status === "done").length,
      failed: setState.steps.filter(s => s.status === "failed").length,
      errors: setState.steps.filter(s => s.status === "error").length,
    });
  }

  out({ sets });
}

async function cmdReset(name?: string, all?: boolean): Promise<void> {
  if (all) {
    if (await exists(STATE_FILE)) {
      await writeFile(STATE_FILE, "{}");
    }
    out({ reset: "all" });
    return;
  }

  if (!name) err("Provide a set name or --all");

  const state = await loadState();
  if (state[name]) {
    delete state[name];
    await saveState(state);
  }
  out({ reset: name });
}

// ============================================================================
// CLI
// ============================================================================

function usage(): never {
  out({
    error: "Usage",
    commands: {
      "init <name>": "Create empty set",
      "init <name> --from <file>": "Create set from file",
      "init <name> --stdin": "Create set from stdin JSON",
      "add-step <name>": "Add step to set",
      "run <name>": "Run next pending step",
      "run <name> --step <N>": "Run specific step by index",
      "run <name> --full": "Run all steps (stop on error)",
      "status <name>": "Show set status",
      "preview <name>": "Preview next step with resolved variables",
      "preview <name> --step <N>": "Preview specific step",
      "list": "List all sets",
      "reset <name>": "Clear state for set",
      "reset --all": "Clear all state",
    },
  });
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const cmd = args[0];

  switch (cmd) {
    case "init": {
      const name = args[1];
      if (!name) usage();
      const fromIdx = args.indexOf("--from");
      const fromFile = fromIdx !== -1 ? args[fromIdx + 1] : undefined;
      const fromStdin = args.includes("--stdin");

      if (fromFile && fromStdin) {
        err("Cannot use both --from and --stdin");
      }

      await cmdInit(name, fromFile, fromStdin);
      break;
    }
    case "add-step": {
      const setName = args[1];
      if (!setName) usage();

      const nameIdx = args.indexOf("--name");
      const queryIdx = args.indexOf("--query");

      if (nameIdx === -1 || queryIdx === -1) {
        err("add-step requires --name and --query");
      }

      const stepName = args[nameIdx + 1];
      const query = args[queryIdx + 1];

      if (!stepName || !query) {
        err("add-step requires --name and --query values");
      }

      const varsIdx = args.indexOf("--variables");
      const extractIdx = args.indexOf("--extract");
      const expectedIdx = args.indexOf("--expected");

      const variables = varsIdx !== -1 ? args[varsIdx + 1] : undefined;
      const extractToContext = extractIdx !== -1 ? args[extractIdx + 1] : undefined;
      const expected = expectedIdx !== -1 ? args[expectedIdx + 1] : undefined;

      await cmdAddStep(setName, stepName, query, variables, extractToContext, expected);
      break;
    }
    case "run": {
      const name = args[1];
      if (!name) usage();
      const full = args.includes("--full");

      const stepIdx = args.indexOf("--step");
      const stepIndex = stepIdx !== -1 ? parseInt(args[stepIdx + 1], 10) : undefined;

      if (stepIndex !== undefined && isNaN(stepIndex)) {
        err("--step requires a numeric index");
      }

      await cmdRun(name, full, stepIndex);
      break;
    }
    case "status": {
      const name = args[1];
      if (!name) usage();
      await cmdStatus(name);
      break;
    }
    case "preview": {
      const name = args[1];
      if (!name) usage();

      const stepIdx = args.indexOf("--step");
      const stepIndex = stepIdx !== -1 ? parseInt(args[stepIdx + 1], 10) : undefined;

      if (stepIndex !== undefined && isNaN(stepIndex)) {
        err("--step requires a numeric index");
      }

      await cmdPreview(name, stepIndex);
      break;
    }
    case "list": {
      await cmdList();
      break;
    }
    case "reset": {
      const all = args.includes("--all");
      const name = all ? undefined : args[1];
      await cmdReset(name, all);
      break;
    }
    default:
      usage();
  }
}

main();
