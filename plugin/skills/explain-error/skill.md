---
description: Explain an error message or stack trace — what went wrong, why, and the fastest path to fix it.
allowed-tools: ["Bash", "Read"]
---

## explain-error skill

When the user pastes an error, stack trace, or log output:

**Step 1:** Identify the error type and origin:
- What threw it (language runtime, library, OS, network)?
- Which line/file is the actual source vs. noise in the trace?

**Step 2:** Explain what it means in one sentence a developer can act on.
Skip generic descriptions. State the concrete cause if visible from the trace.

**Step 3:** Give the most likely fix first — no ranked list, no "it could be X or Y".
If the cause is genuinely ambiguous, ask one clarifying question before guessing.

**Step 4:** If a code change is needed, show it inline — not as a suggestion to "consider doing X".

Keep the response short. Developers reading errors want answers, not explanations of why errors exist.
