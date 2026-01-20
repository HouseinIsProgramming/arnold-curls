# Arnold CLI Output Formats

Complete JSON output schemas for all arnold commands.

## Run Command Output

### Single Step (`npx arnold run <name>`)

**Success:**
```json
{
  "step": "Login",
  "index": 0,
  "status": "done",
  "duration": 234,
  "result": {
    "data": {
      "login": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "user": { "id": "123" }
      }
    }
  },
  "context": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "userId": "123"
  },
  "remaining": 2
}
```

**Network Error:**
```json
{
  "step": "Login",
  "index": 0,
  "status": "error",
  "error": "fetch failed: ECONNREFUSED",
  "duration": 52
}
```

**Validation Failed:**
```json
{
  "step": "Login",
  "index": 0,
  "status": "failed",
  "duration": 234,
  "result": {
    "data": {
      "login": { "success": false }
    }
  },
  "validationError": {
    "path": "data.login.success",
    "expected": true,
    "actual": false
  },
  "context": {}
}
```

**GraphQL Errors:**
```json
{
  "step": "Login",
  "index": 0,
  "status": "done",
  "duration": 156,
  "result": {
    "data": null,
    "errors": [
      {
        "message": "Invalid credentials",
        "path": ["login"],
        "extensions": {
          "code": "UNAUTHORIZED"
        }
      }
    ]
  },
  "context": {}
}
```

### Full Run (`npx arnold run <name> --full`)

**All Steps Succeed:**
```json
{
  "set": "auth-flow",
  "status": "done",
  "duration": 567,
  "steps": [
    {
      "step": "Login",
      "index": 0,
      "status": "done",
      "duration": 234,
      "result": { "data": { "login": { "token": "abc" } } }
    },
    {
      "step": "Get Profile",
      "index": 1,
      "status": "done",
      "duration": 189,
      "result": { "data": { "user": { "name": "John" } } }
    }
  ]
}
```

**Stopped on Error:**
```json
{
  "set": "auth-flow",
  "status": "error",
  "stoppedAt": 1,
  "error": "fetch failed: ECONNREFUSED",
  "duration": 289,
  "completedSteps": [
    {
      "step": "Login",
      "index": 0,
      "status": "done",
      "duration": 234
    }
  ]
}
```

## Status Command Output

```json
{
  "name": "auth-flow",
  "baseUrl": "https://api.example.com/graphql",
  "pending": 2,
  "done": 1,
  "failed": 0,
  "errors": 0,
  "steps": [
    {
      "index": 0,
      "name": "Login",
      "status": "done"
    },
    {
      "index": 1,
      "name": "Get Profile",
      "status": "pending"
    },
    {
      "index": 2,
      "name": "Update Profile",
      "status": "pending"
    }
  ]
}
```

## List Command Output

```json
{
  "sets": [
    {
      "name": "auth-flow",
      "pending": 2,
      "done": 1,
      "failed": 0,
      "errors": 0
    },
    {
      "name": "user-crud",
      "pending": 4,
      "done": 0,
      "failed": 0,
      "errors": 0
    }
  ]
}
```

## Preview Command Output

```json
{
  "step": "Get Profile",
  "index": 1,
  "query": "query GetProfile($id: ID!) { user(id: $id) { id name email } }",
  "variables": {
    "id": "123"
  },
  "headers": {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs...",
    "Content-Type": "application/json"
  }
}
```

## Error Codes

| Status | Meaning |
|--------|---------|
| `done` | Step completed successfully |
| `pending` | Step not yet executed |
| `error` | Network/runtime error occurred |
| `failed` | Validation against `expected` failed |
