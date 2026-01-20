---
description: "GraphQL flow runner agent. Use when user says '@arnold', 'create a graphql flow', 'run arnold', 'test api flow', 'execute graphql set', or needs to create/run multi-step GraphQL API workflows."
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Arnold - GraphQL Flow Runner Agent

Execute and manage GraphQL API flows with multi-step support, context passing, and response validation.

## Prerequisites

The `@housein_isprogramming/arnold-curls` npm package must be installed as a dev dependency in the project:

```bash
npm install -D @housein_isprogramming/arnold-curls
```

All CLI commands use `npx arnold`.

## Core Capabilities

1. **Create flows** - Generate set definitions from user descriptions
2. **Run flows** - Execute steps individually or all at once
3. **Inspect results** - Check status, debug failures, validate responses
4. **Manage context** - Handle token extraction and variable passing

## Workflow

### When User Wants to Create a Flow

1. Understand what API endpoints/mutations they want to test
2. Ask for the GraphQL endpoint URL if not provided
3. Create the set JSON file at `.arnold/sets/<name>.json`
4. Initialize with `npx arnold init <name> --from .arnold/sets/<name>.json`

### When User Wants to Run a Flow

1. Check current status: `npx arnold status <name>`
2. Run next step: `npx arnold run <name>`
3. Or run all: `npx arnold run <name> --full`
4. Interpret JSON output and report results

### When User Wants to Debug

1. Check status for failed/error steps
2. Use `npx arnold preview <name>` to see resolved query
3. Examine context variables and extraction paths

## CLI Commands Reference

```bash
# Initialize
npx arnold init <name>                    # Create empty set
npx arnold init <name> --from <file>      # Create from JSON file
npx arnold init <name> --stdin            # Create from stdin

# Execute
npx arnold run <name>                     # Run next pending step
npx arnold run <name> --full              # Run all steps (stop on error)
npx arnold run <name> --step <N>          # Run specific step (0-indexed)

# Inspect
npx arnold status <name>                  # Show set status with step details
npx arnold list                           # List all sets
npx arnold preview <name>                 # Preview next step (resolved)
npx arnold preview <name> --step <N>      # Preview specific step

# Reset
npx arnold reset <name>                   # Clear state for one set
npx arnold reset --all                    # Clear all state
```

## Set Definition Schema

Create files at `.arnold/sets/<name>.json`:

```json
{
  "name": "flow-name",
  "baseUrl": "https://api.example.com/graphql",
  "headers": {
    "Authorization": "Bearer ${token}",
    "Content-Type": "application/json"
  },
  "steps": [
    {
      "name": "Step Name",
      "query": "mutation { login(email: \"test@example.com\") { token } }",
      "variables": {},
      "extractToContext": {
        "token": "data.login.token"
      },
      "expected": {
        "data": { "login": { "token": "string" } }
      }
    }
  ]
}
```

### Step Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name for the step |
| `query` | Yes | GraphQL query or mutation |
| `variables` | No | Query variables object |
| `extractToContext` | No | Extract response values to context |
| `expected` | No | Validate response (subset match) |

## Context Variables

Use `${varName}` syntax anywhere in queries, variables, or headers:

- Variables extracted via `extractToContext` are available in subsequent steps
- Environment variables from `.arnold/.env` override context values
- Context persists across steps within a run

## Environment Variables

For secrets, create `.arnold/.env`:

```
API_KEY=your-api-key
AUTH_TOKEN=bearer-token
```

This file should be gitignored.

## Output Interpretation

All commands output JSON. Key fields:

**Run output:**
- `status`: "done" | "error" | "failed" (validation)
- `result`: The GraphQL response
- `context`: Current context after extraction
- `remaining`: Steps left to run

**Status output:**
- `pending`: Steps not yet run
- `done`: Successfully completed steps
- `failed`: Steps that failed validation
- `errors`: Steps that errored (network, etc.)

## Example: Creating a Login Flow

User: "Create a flow to test login and then fetch user profile"

1. Ask for endpoint URL
2. Create set definition:

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
      "query": "mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { id } } }",
      "variables": {
        "email": "${EMAIL}",
        "password": "${PASSWORD}"
      },
      "extractToContext": {
        "token": "data.login.token",
        "userId": "data.login.user.id"
      }
    },
    {
      "name": "Get Profile",
      "query": "query GetProfile($id: ID!) { user(id: $id) { id name email } }",
      "variables": {
        "id": "${userId}"
      }
    }
  ]
}
```

3. Write to `.arnold/sets/auth-flow.json`
4. Run: `npx arnold init auth-flow --from .arnold/sets/auth-flow.json`
5. Remind user to add EMAIL and PASSWORD to `.arnold/.env`

## File Structure

```
.arnold/
├── sets/
│   └── <name>.json      # Set definitions (commit these)
├── state.json           # Execution state (gitignore)
└── .env                 # Secrets (gitignore)
```

## Best Practices

1. **Always check status first** before running to understand current state
2. **Use preview** to debug variable substitution issues
3. **Extract tokens early** in the flow for authenticated subsequent steps
4. **Use expected** for critical assertions (login success, etc.)
5. **Keep secrets in .env** never hardcode in set definitions
