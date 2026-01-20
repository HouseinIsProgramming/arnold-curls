# arnold-curls

GraphQL API flow runner with multi-set support. Execute flows step-by-step with context passing and response validation.

## Installation

### CLI (npm package)

```bash
npm install -D @housein_isprogramming/arnold-curls
```

Then use via npx:

```bash
npx arnold init my-api
npx arnold run my-api
npx arnold status my-api
```

### Claude Code Plugin

After installing the npm package, install the Claude Code plugin:

```bash
claude /plugin install node_modules/@housein_isprogramming/arnold-curls
```

Then use the `@arnold` agent in Claude:

```
@arnold create a flow to test user registration and login
@arnold run my-api --full
```

Or use the slash commands:

```
/arnold-list
/arnold-status my-api
/arnold-run my-api --full
```

## Quick Start

```bash
# Initialize a set
npx arnold init my-api

# Edit .arnold/sets/my-api.json with your steps
# Run steps one by one
npx arnold run my-api

# Or run all at once
npx arnold run my-api --full

# Check status
npx arnold status my-api
```

## Commands

```bash
npx arnold init <name>              # Create empty set
npx arnold init <name> --from <f>   # Create from existing JSON file
npx arnold init <name> --stdin      # Create from stdin

npx arnold run <name>               # Run next pending step
npx arnold run <name> --full        # Run ALL steps, stop on first error
npx arnold run <name> --step <N>    # Run specific step (0-indexed)

npx arnold preview <name>           # Preview next step (resolved variables)
npx arnold preview <name> --step <N> # Preview specific step

npx arnold status <name>            # Show set status
npx arnold list                     # List all sets
npx arnold reset <name>             # Clear execution state for set
npx arnold reset --all              # Clear ALL execution state
```

## File Structure

```
.arnold/
├── sets/
│   ├── auth-flow.json     # Set definition (committed)
│   └── user-crud.json     # Set definition (committed)
├── state.json             # Execution state (gitignored)
└── .env                   # Secrets (gitignored)
```

## Set Definition

`.arnold/sets/<name>.json`:

```json
{
  "name": "auth-flow",
  "baseUrl": "https://api.example.com/graphql",
  "headers": {
    "Authorization": "Bearer ${token}"
  },
  "steps": [
    {
      "name": "Login",
      "query": "mutation { login(user: \"admin\", pass: \"secret\") { token success } }",
      "extractToContext": { "token": "data.login.token" },
      "expected": { "data": { "login": { "success": true } } }
    },
    {
      "name": "Get Profile",
      "query": "query { me { id name } }"
    }
  ]
}
```

### Step Fields

| Field | Description |
|-------|-------------|
| `name` | Step display name |
| `query` | GraphQL query/mutation |
| `variables` | Optional query variables |
| `extractToContext` | Extract values to context for later steps |
| `expected` | Validate response (subset match) |

## Context Variables

Use `${varName}` in queries, variables, or headers:

```json
{
  "headers": { "Authorization": "Bearer ${token}" },
  "steps": [
    {
      "name": "Login",
      "query": "mutation { login { token } }",
      "extractToContext": { "token": "data.login.token" }
    },
    {
      "name": "Protected Query",
      "query": "query { secretData { value } }"
    }
  ]
}
```

## Environment Variables

Create `.arnold/.env` for secrets:

```
API_KEY=your-api-key
AUTH_TOKEN=bearer-token
# Comments supported
```

- `.env` values override context values
- Add to `.gitignore` (contains secrets)

## Output Format (JSON)

### run (single step)
```json
{
  "step": "Login",
  "index": 0,
  "status": "done",
  "duration": 234,
  "result": { "data": { "login": { "token": "abc" } } },
  "context": { "token": "abc" },
  "remaining": 1
}
```

### run --full (success)
```json
{
  "set": "auth-flow",
  "status": "done",
  "steps": [...],
  "duration": 567
}
```

### run --full (error)
```json
{
  "set": "auth-flow",
  "status": "error",
  "stoppedAt": 1,
  "error": "connection refused",
  "completedSteps": [...]
}
```

### status
```json
{
  "name": "auth-flow",
  "baseUrl": "...",
  "pending": 2,
  "done": 1,
  "failed": 0,
  "errors": 0,
  "steps": [...]
}
```

### list
```json
{
  "sets": [
    { "name": "auth-flow", "pending": 2, "done": 1, "failed": 0, "errors": 0 }
  ]
}
```

## Response Validation

Add `expected` for subset matching:

```json
{
  "name": "Login",
  "query": "mutation { login { success } }",
  "expected": { "data": { "login": { "success": true } } }
}
```

- Response must contain expected values (extra fields OK)
- On mismatch: status becomes `failed` with `validationError`
- Context extraction still runs (data exists)

## Testing

```bash
bun test
```

## License

MIT
