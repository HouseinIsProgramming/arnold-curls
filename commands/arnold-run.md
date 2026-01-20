---
description: Run an Arnold GraphQL flow set
allowed-tools: Bash
arguments:
  - name: set-name
    description: Name of the set to run
    required: true
  - name: options
    description: Optional flags (--full to run all, --step N for specific step)
    required: false
---

# Arnold Run

Execute a GraphQL flow set.

Run `npx arnold run $ARGUMENTS` and report the results.

For each step executed, show:
- Step name and index
- Status (done/error/failed)
- Duration
- Key data from the result
- Any errors or validation failures

If running with `--full`, summarize all steps at the end.
