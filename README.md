# arnold-curls

A Claude-first GraphQL API flow runner. Execute API calls step-by-step with context passing and response validation.

## Philosophy

Claude AI manipulates a `flow.json` file directly using its native Read/Write tools. This tool only does what Claude can't: execute HTTP requests.

**~150 lines of code. No CLI flags. No complex interfaces.**

## Installation

### With Bun (development)

```bash
git clone <repo-url>
cd arnold-curls
bun install
```

### Standalone executables (team sharing)

```bash
# Build binaries (no bun dependency needed to run)
bun run build

# Binaries created in bin/
./bin/run      # Run next step
./bin/status   # Check status
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
      "query": "mutation { login(user: \"admin\", pass: \"secret\") { token success } }",
      "extractToContext": { "token": "data.login.token" },
      "expected": { "data": { "login": { "success": true } } },
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
# With bun
bun src/run.ts      # Run next pending step
bun src/status.ts   # Check flow status

# Or with bundled executables
./bin/run
./bin/status
```

## Flow File Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Flow name for display |
| `baseUrl` | string | GraphQL endpoint URL |
| `headers` | object | HTTP headers (supports `${var}` substitution) |
| `context` | object | Shared state between steps |
| `steps` | array | List of steps to execute |

### Step Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Step name for display |
| `query` | string | GraphQL query/mutation |
| `variables` | object | Optional GraphQL variables |
| `extractToContext` | object | Extract values from response to context |
| `expected` | object | Validate response (subset match) |
| `status` | string | `pending`, `done`, `error`, or `failed` |

## Response Validation

Add `expected` to validate responses:

```json
{
  "name": "Login",
  "query": "mutation { login { success } }",
  "expected": { "data": { "login": { "success": true } } },
  "status": "pending"
}
```

- **Subset matching**: Response must contain expected values (extra fields OK)
- **On mismatch**: Status becomes `failed` with `validationError` explaining why
- **Context extraction still runs**: Data exists, just didn't match expectations

## Context Variables

Use `${varName}` in queries, variables, or headers:

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

After step 1 runs, `${token}` in headers is replaced with the extracted value.

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
  "steps": [
    { "index": 0, "name": "Login", "status": "done", "duration": 234 },
    { "index": 1, "name": "Get Data", "status": "pending" }
  ],
  "pending": 1,
  "done": 1,
  "failed": 0,
  "errors": 0
}
```

## Claude Code Integration

This repo includes `.claude/commands/arnold-curls.md` - the `/arnold-curls` skill works automatically when you clone this repo.

## Testing

```bash
bun test
```

## License

MIT
