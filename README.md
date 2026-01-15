# api-flow

A Claude-first GraphQL API flow runner. Execute API calls step-by-step with context passing between steps.

## Philosophy

Claude AI manipulates a `flow.json` file directly using its native Read/Write tools. This tool only does what Claude can't: execute HTTP requests.

**~100 lines of code. No CLI flags. No complex interfaces.**

## Installation

```bash
bun install
```

## Usage

### 1. Create a flow file

Create `flow.json` in your project root:

```json
{
  "name": "My API Flow",
  "baseUrl": "http://localhost:3000/graphql",
  "headers": {
    "Authorization": "Bearer ${token}"
  },
  "context": {},
  "steps": [
    {
      "name": "Login",
      "query": "mutation { login(user: \"admin\", pass: \"secret\") { token } }",
      "extractToContext": { "token": "data.login.token" },
      "status": "pending"
    },
    {
      "name": "Get Data",
      "query": "query { items { id name } }",
      "status": "pending"
    }
  ]
}
```

### 2. Run steps

```bash
bun run run      # Run next pending step
bun run status   # Check flow status
```

Or directly:

```bash
bun src/run.ts
bun src/status.ts
```

## Flow File Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Flow name for display |
| `baseUrl` | string | GraphQL endpoint URL |
| `headers` | object | Optional HTTP headers (supports `${var}` substitution) |
| `context` | object | Shared state between steps |
| `steps` | array | List of steps to execute |

### Step Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Step name for display |
| `query` | string | GraphQL query/mutation |
| `variables` | object | Optional GraphQL variables |
| `extractToContext` | object | Extract values from response to context |
| `status` | string | `"pending"`, `"done"`, or `"error"` |

## Context Variables

Use `${varName}` syntax to reference context values in:
- Queries
- Variables
- Headers

Example:
```json
{
  "headers": { "Authorization": "Bearer ${token}" },
  "steps": [
    {
      "name": "Login",
      "query": "mutation { login { token } }",
      "extractToContext": { "token": "data.login.token" },
      "status": "pending"
    },
    {
      "name": "Protected Query",
      "query": "query { secretData { value } }",
      "status": "pending"
    }
  ]
}
```

After step 1 runs, `${token}` in headers gets replaced with the extracted value.

## Output Format

### Run output

```json
{
  "step": "Login",
  "status": "done",
  "duration": 234,
  "result": { "data": { "login": { "token": "abc123" } } },
  "context": { "token": "abc123" },
  "remaining": 1
}
```

### Status output

```json
{
  "name": "My Flow",
  "baseUrl": "http://localhost:3000/graphql",
  "context": { "token": "abc123" },
  "steps": [
    { "index": 0, "name": "Login", "status": "done", "duration": 234 },
    { "index": 1, "name": "Get Data", "status": "pending" }
  ],
  "pending": 1,
  "done": 1,
  "errors": 0
}
```

## Claude Code Integration

Add to `.claude/commands/api-flow.md`:

```markdown
# API Flow

Run GraphQL flows step-by-step.

## Commands
- `bun src/run.ts` - Run next pending step
- `bun src/status.ts` - Show flow status

## Workflow
1. Write flow.json with steps
2. Run steps one by one
3. Check results, modify flow as needed
```

## Testing

```bash
bun test
```

## License

MIT
