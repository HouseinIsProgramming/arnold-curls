# Agent-First Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make arnold-curls truly agent-native by adding imperative commands that eliminate JSON file manipulation.

**Architecture:** Add 4 new commands (`add-step`, `run --step`, `init --stdin`, `preview`) to the existing CLI. Each command follows the established pattern: parse args, execute logic, output JSON.

**Tech Stack:** TypeScript, Node.js fs/promises, no new dependencies.

---

## Task 1: Add `add-step` Command

**Files:**
- Modify: `src/arnold.ts:406-421` (usage function)
- Modify: `src/arnold.ts:423-464` (main switch)
- Modify: `src/arnold.ts:129-167` (add new command function after cmdInit)

**Step 1: Update usage() to include add-step**

In `src/arnold.ts`, find the usage function and add the new command:

```typescript
function usage(): never {
  out({
    error: "Usage",
    commands: {
      "init <name>": "Create empty set",
      "init <name> --from <file>": "Create set from file",
      "init <name> --stdin": "Create set from stdin JSON",
      "add-step <name>": "Add step to set",
      "run <name>": "Run next pending step",
      "run <name> --full": "Run all steps (stop on error)",
      "run <name> --step <N>": "Run specific step by index",
      "preview <name>": "Preview next step with resolved variables",
      "preview <name> --step <N>": "Preview specific step",
      "status <name>": "Show set status",
      "list": "List all sets",
      "reset <name>": "Clear state for set",
      "reset --all": "Clear all state",
    },
  });
  process.exit(1);
}
```

**Step 2: Implement cmdAddStep function**

Add after `cmdInit` function (~line 167):

```typescript
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
```

**Step 3: Add import for StepDefinition type**

Update the import at line 2:

```typescript
import type { SetDefinition, SetState, GlobalState, StepState, StepDefinition } from "./types";
```

**Step 4: Add case in main() switch**

Add after the "init" case:

```typescript
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
```

**Step 5: Build and test**

Run: `bun run build && node dist/arnold.js add-step`
Expected: Error message about missing --name and --query

**Step 6: Test with actual step**

Run:
```bash
node dist/arnold.js init test-add
node dist/arnold.js add-step test-add --name "Get Users" --query "query { users { id } }"
node dist/arnold.js status test-add
```
Expected: Step appears in status output

**Step 7: Commit**

```bash
git add src/arnold.ts
git commit -m "feat: add add-step command for agent-friendly step creation"
```

---

## Task 2: Add `run --step <N>` Option

**Files:**
- Modify: `src/arnold.ts:169-183` (cmdRun function)
- Modify: `src/arnold.ts:185-215` (runSingle function)
- Modify: `src/arnold.ts:438-443` (run case in main)

**Step 1: Update cmdRun signature**

```typescript
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
```

**Step 2: Update runSingle to accept stepIndex**

```typescript
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
```

**Step 3: Update main() run case**

```typescript
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
```

**Step 4: Build and test**

Run: `bun run build`

Test re-running specific step:
```bash
node dist/arnold.js status test-add
node dist/arnold.js run test-add --step 0
```
Expected: Step 0 runs (will fail due to no server, but should attempt)

**Step 5: Commit**

```bash
git add src/arnold.ts
git commit -m "feat: add run --step N option for re-running specific steps"
```

---

## Task 3: Add `init --stdin` Option

**Files:**
- Modify: `src/arnold.ts:133-167` (cmdInit function)
- Modify: `src/arnold.ts:430-437` (init case in main)

**Step 1: Add stdin reading utility**

Add after the `exists` function (~line 26):

```typescript
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
```

**Step 2: Update cmdInit to accept stdin flag**

```typescript
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
```

**Step 3: Update main() init case**

```typescript
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
```

**Step 4: Build and test**

Run: `bun run build`

Test stdin:
```bash
echo '{"name":"stdin-test","baseUrl":"http://localhost:3000/graphql","steps":[]}' | node dist/arnold.js init stdin-test --stdin
node dist/arnold.js status stdin-test
```
Expected: Set created successfully

**Step 5: Commit**

```bash
git add src/arnold.ts
git commit -m "feat: add init --stdin for programmatic flow creation"
```

---

## Task 4: Add `preview` Command

**Files:**
- Modify: `src/arnold.ts` (add cmdPreview function)
- Modify: `src/arnold.ts` (add case in main switch)

**Step 1: Implement cmdPreview function**

Add after `cmdStatus` function:

```typescript
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
```

**Step 2: Add case in main() switch**

Add after the "status" case:

```typescript
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
```

**Step 3: Build and test**

Run: `bun run build`

Test preview:
```bash
node dist/arnold.js preview test-add
node dist/arnold.js preview test-add --step 0
```
Expected: Shows resolved query with substituted variables

**Step 4: Commit**

```bash
git add src/arnold.ts
git commit -m "feat: add preview command to see resolved queries before execution"
```

---

## Task 5: Improve Error Output Structure

**Files:**
- Modify: `src/arnold.ts:300-305` (executeStep error handling)

**Step 1: Update error handling in executeStep**

Replace the GraphQL error handling block:

```typescript
    if (data.errors) {
      stepState.status = "error";
      stepState.error = data.errors;  // Keep as object, not stringified
      stepState.result = data;
      return;
    }
```

**Step 2: Update StepState type to allow object errors**

In `src/types.ts`, update StepState:

```typescript
export interface StepState {
  status: StepStatus;
  duration?: number;
  result?: unknown;
  error?: string | unknown[];  // Allow array for GraphQL errors
  validationError?: string;
}
```

**Step 3: Build and test**

Run: `bun run build`

The error output will now preserve GraphQL error structure instead of stringifying.

**Step 4: Commit**

```bash
git add src/arnold.ts src/types.ts
git commit -m "feat: preserve GraphQL errors as structured objects"
```

---

## Task 6: Clean Up and Final Build

**Step 1: Run full build**

```bash
bun run build
```

**Step 2: Test all new commands**

```bash
# Clean slate
rm -rf .arnold

# Test init
node dist/arnold.js init my-api

# Test add-step
node dist/arnold.js add-step my-api --name "Health Check" --query "query { health }"

# Test preview
node dist/arnold.js preview my-api

# Test stdin
echo '{"name":"pipe-test","baseUrl":"http://localhost/graphql","steps":[{"name":"Test","query":"{ test }"}]}' | node dist/arnold.js init pipe-test --stdin

# Test status
node dist/arnold.js status my-api
node dist/arnold.js list

# Clean up
rm -rf .arnold
```

**Step 3: Update README with new commands**

Document the new commands in README.md.

**Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: update README with new agent-friendly commands"
```

**Step 5: Bump version and publish**

```bash
npm version minor
npm publish
```
