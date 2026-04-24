---
name: code-review
description: Review changes for bugs, regressions, missing tests, and maintainability risks.
---

# Code Review

Use this skill when asked to review a patch, pull request, or local diff.

## Review stance

- Lead with findings ordered by severity.
- Ground every finding in a concrete file and line.
- Prioritize behavioral bugs, data loss, security issues, regressions, and missing tests.
- Keep summaries secondary to findings.
- Say clearly when no issues are found and name any residual risk.

## Finding quality

- Explain the failure mode, not just the disliked pattern.
- Mention the triggering condition.
- Keep suggested fixes scoped to the reviewed change.
- Avoid broad refactors unless they are needed to correct the issue.
