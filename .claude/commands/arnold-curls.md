# Arnold Curls Runner

Run GraphQL API flows step-by-step with validation.

## Commands

```bash
bun src/run.ts      # Run next pending step
bun src/status.ts   # Show flow status
```

Or if bundled:
```bash
./bin/run           # Run next pending step
./bin/status        # Show flow status
```

## Workflow

1. **Create flow.json** with your steps
2. **Run steps** one by one with `bun src/run.ts`
3. **Check results** and modify flow as needed
4. **Validate responses** using the `expected` field

## Flow Schema

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
      "query": "mutation { login { token success } }",
      "extractToContext": { "token": "data.login.token" },
      "expected": { "data": { "login": { "success": true } } },
      "status": "pending"
    }
  ]
}
```

## Step Fields

| Field | Description |
|-------|-------------|
| `name` | Step display name |
| `query` | GraphQL query/mutation |
| `variables` | Optional query variables |
| `extractToContext` | Extract values to context for later steps |
| `expected` | Validate response (subset match) |
| `status` | `pending`, `done`, `error`, or `failed` |

## Context Variables

Use `${varName}` in queries, variables, or headers:
- Login extracts `token` → `${token}` available in headers
- Create resource extracts `id` → `${id}` available in next steps

## Environment Variables (.arnold)

Create a `.arnold` file for secrets (not committed to git):

```
API_KEY=your-api-key
AUTH_TOKEN=bearer-token
```

`.arnold` values override `flow.context` values.
