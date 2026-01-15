# Multi-Set GraphQL Flow Runner Design

## Overview

Transform arnold-curls from single-flow to multi-set architecture with persistent execution state.

## File Structure

```
.arnold/
├── sets/
│   ├── auth-flow.json      # committed - set definition
│   └── user-crud.json      # committed - set definition
├── state.json              # gitignored - execution state
└── .env                    # gitignored - secrets
```

## Commands

```bash
arnold init <name>                    # Creates empty set
arnold init <name> --from <file>      # Creates from existing JSON

arnold run <name>                     # Run next pending step
arnold run <name> --full              # Run ALL steps, stop on first error

arnold status <name>                  # Show set status
arnold list                           # List all sets
arnold reset <name>                   # Clear state for set
arnold reset --all                    # Delete entire state.json
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
      "query": "mutation { login(user: \"admin\") { token } }",
      "variables": {},
      "extractToContext": { "token": "data.login.token" },
      "expected": { "data": { "login": { "token": "string" } } }
    }
  ]
}
```

## State Schema

`.arnold/state.json`:

```json
{
  "auth-flow": {
    "context": { "token": "abc123" },
    "steps": [
      { "status": "done", "duration": 234, "result": {...}, "error": null },
      { "status": "pending", "duration": null, "result": null, "error": null }
    ]
  }
}
```

## Output Formats

All output is JSON for agent consumption.

### run (single step)
```json
{"step":"Login","index":0,"status":"done","duration":234,"result":{...},"context":{...},"remaining":2}
```

### run --full (success)
```json
{"set":"auth-flow","status":"done","steps":[...],"duration":567}
```

### run --full (error)
```json
{"set":"auth-flow","status":"error","stoppedAt":1,"error":"...","completedSteps":[...]}
```

### status
```json
{"name":"auth-flow","baseUrl":"...","pending":2,"done":1,"failed":0,"steps":[...]}
```

### list
```json
{"sets":[{"name":"auth-flow","pending":2,"done":1},{"name":"user-crud","pending":3,"done":0}]}
```
