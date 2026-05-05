---
description: Review staged or uncommitted changes before a PR — summarize what changed, flag risks, and suggest a PR title and description.
allowed-tools: ["Bash"]
---

## review-pr skill

**Step 1:** Get the diff against the base branch.

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

**Step 2:** Summarize what changed in plain language:
- What is the intent of these changes?
- Which files are affected and why?

**Step 3:** Flag any risks:
- Breaking changes or removed public API
- Missing tests for changed logic
- Hardcoded values, secrets, or debug leftovers
- Large files changed with no clear reason

**Step 4:** Output a ready-to-use PR description:

```
## Summary
- <bullet 1>
- <bullet 2>

## Risk
<none | specific concern>

## Test plan
- [ ] <what to verify manually>
```

Be direct. Skip praise. Flag real issues only.
