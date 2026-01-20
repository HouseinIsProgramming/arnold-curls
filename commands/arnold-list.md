---
description: List all Arnold GraphQL flow sets
allowed-tools: Bash
---

# Arnold List

List all available GraphQL flow sets.

Run `npx arnold list` and display results as a table:

| Set Name | Pending | Done | Failed | Errors |
|----------|---------|------|--------|--------|

If no sets exist, inform the user they can create one with:
```bash
npx arnold init <name>
```
