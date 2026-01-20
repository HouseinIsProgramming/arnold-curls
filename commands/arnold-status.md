---
description: Show status of an Arnold GraphQL flow set
allowed-tools: Bash
arguments:
  - name: set-name
    description: Name of the set to check
    required: true
---

# Arnold Status

Check the status of a GraphQL flow set.

Run `npx arnold status $ARGUMENTS` and report the results.

Interpret the JSON output:
- `pending`: Steps not yet run
- `done`: Completed successfully
- `failed`: Validation failed
- `errors`: Runtime errors

Show a summary table of step statuses.
