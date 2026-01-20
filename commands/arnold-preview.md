---
description: Preview an Arnold flow step with resolved variables
allowed-tools: Bash
arguments:
  - name: set-name
    description: Name of the set to preview
    required: true
  - name: options
    description: Optional --step N to preview specific step
    required: false
---

# Arnold Preview

Preview a step with all context variables resolved.

Run `npx arnold preview $ARGUMENTS` and display:
- The resolved GraphQL query
- Variables with substituted values
- Headers with substituted values

Useful for debugging variable substitution issues.
