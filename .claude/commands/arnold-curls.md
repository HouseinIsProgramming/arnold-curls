# Arnold Curls

GraphQL API flow runner with multi-set support.

## Commands

```bash
bun run arnold init <name>              # Create empty set
bun run arnold init <name> --from <f>   # Create from existing JSON

bun run arnold run <name>               # Run next pending step
bun run arnold run <name> --full        # Run ALL steps, stop on error

bun run arnold status <name>            # Show set status
bun run arnold list                     # List all sets
bun run arnold reset <name>             # Clear state for set
bun run arnold reset --all              # Clear ALL state
```

## File Structure

```
.arnold/
├── sets/<name>.json   # Set definitions (committed)
├── state.json         # Execution state (gitignored)
└── .env               # Secrets (gitignored)
```

## Set Definition Schema

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
      "query": "mutation { login(user: \"admin\") { token success } }",
      "extractToContext": { "token": "data.login.token" },
      "expected": { "data": { "login": { "success": true } } }
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

## Context Variables

Use `${varName}` in queries, variables, or headers. Values extracted via `extractToContext` are available in subsequent steps.

## Environment Variables

Create `.arnold/.env` for secrets (gitignored):

```
API_KEY=your-api-key
AUTH_TOKEN=bearer-token
```
