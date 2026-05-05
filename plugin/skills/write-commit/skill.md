---
description: Write a conventional commit message from staged changes — focused on why, not what.
allowed-tools: ["Bash"]
---

## write-commit skill

**Step 1:** Read what's staged.

```bash
git diff --cached --stat
git diff --cached
```

**Step 2:** Determine the commit type:
- `feat` — new capability added
- `fix` — bug corrected
- `chore` — tooling, deps, config (no production logic change)
- `refactor` — restructured without behavior change
- `docs` — documentation only
- `test` — tests only

**Step 3:** Write the commit message.

Rules:
- Subject line: `<type>: <what changed and why>` — max 72 chars
- No period at the end
- Body only if the why is non-obvious — one short paragraph
- Never describe what the diff already shows

**Step 4:** Output the final message ready to copy, wrapped in a code block.

Do not run `git commit`. Let the developer confirm and run it.
