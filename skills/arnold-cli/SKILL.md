---
name: arnold-cli
description: "This skill should be used when the user asks about 'arnold cli commands', 'graphql flow syntax', 'set definition schema', 'context extraction', 'arnold troubleshooting', or needs detailed reference for the arnold-curls GraphQL flow runner."
---

# Arnold CLI Reference

Detailed reference documentation for the arnold-curls GraphQL flow runner CLI.

## Purpose

Provide comprehensive documentation for creating, running, and debugging GraphQL API flows using the arnold CLI.

## When to Use

- Debugging flow execution issues
- Understanding set definition schema details
- Learning context extraction patterns
- Troubleshooting validation failures

## Quick Command Reference

| Command | Description |
|---------|-------------|
| `npx arnold init <name>` | Create empty set |
| `npx arnold init <name> --from <file>` | Create from JSON |
| `npx arnold run <name>` | Run next step |
| `npx arnold run <name> --full` | Run all steps |
| `npx arnold run <name> --step <N>` | Run specific step |
| `npx arnold status <name>` | Show status |
| `npx arnold preview <name>` | Preview resolved query |
| `npx arnold list` | List all sets |
| `npx arnold reset <name>` | Clear set state |
| `npx arnold reset --all` | Clear all state |

## Context Variable System

### Variable Syntax

Use `${varName}` in:
- Query strings
- Variables objects
- Headers

### Extraction Paths

The `extractToContext` field uses dot notation to extract nested values:

```json
{
  "extractToContext": {
    "token": "data.login.token",
    "userId": "data.login.user.id",
    "firstItem": "data.items.0.id"
  }
}
```

### Priority Order

1. `.arnold/.env` values (highest)
2. Extracted context values
3. Previously set context

## Validation System

The `expected` field performs subset matching:

```json
{
  "expected": {
    "data": {
      "createUser": {
        "success": true
      }
    }
  }
}
```

- Response must contain all expected fields
- Extra fields in response are allowed
- Type must match exactly
- Arrays checked element by element

## Additional Resources

### Reference Files

For detailed patterns and advanced usage:
- **`references/output-formats.md`** - Complete JSON output schemas
- **`references/patterns.md`** - Common flow patterns and examples
