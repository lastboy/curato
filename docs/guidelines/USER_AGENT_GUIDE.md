# User Agent Guide For Curato Installs

_Last updated: 2026-04-23_

## Purpose

This file is a **user-facing guidance block** for teams that install Curato and want a consistent way for Claude Code to choose working modes during day-to-day development.

This guide is intended to be copied into:

- project `CLAUDE.md`
- user `CLAUDE.md`
- `curato-setup.json` under `claudeMd.project.content` or `claudeMd.user.content`

Use it as a starting point, then adapt role names, review rules, and model choices to your team.

> For contributors to Curato itself, see `AGENT_ROLES.md` (inside the Curato repo). This guide focuses on **consumers** of Curato.

---

## Recommended Placement

Easiest path — let Curato install the guide for you:

```bash
curato install-agent-guide           # writes to project ./CLAUDE.md
curato install-agent-guide --user    # writes to ~/.claude/CLAUDE.md
curato install-agent-guide --dry-run # preview without writing
```

That command appends the section below into CLAUDE.md if it isn't already present (idempotent, backed up before any write).

If you prefer to manage it via `curato-setup.json`, add this block — note the content string must be valid JSON, so newlines are escaped as `\n`:

```json
{
  "version": 1,
  "claudeMd": {
    "project": {
      "mode": "append-if-missing-section",
      "section": "## Agent Roles",
      "content": "## Agent Roles\n\nUse these roles to match the task before starting work.\n\n### Architect\n- Suggested model: opus\n- Use for: design, planning, tradeoffs\n\n### Implementer\n- Suggested model: sonnet\n- Use for: feature work, bug fixes, tests\n\n### Reviewer\n- Suggested model: opus\n- Use for: code review, release checks\n"
    }
  }
}
```

For the full copy-paste source (below), use `curato install-agent-guide` rather than hand-escaping JSON.

---

## Copyable Guide

```md
## Agent Roles

Use these roles to match the task before starting work.

### Architect

- Suggested model: `opus`
- Use for: design decisions, planning, tradeoff analysis, scope definition
- Expected output: plan, approach, risks, boundaries
- Avoid: jumping straight into implementation when requirements are still unclear

### Implementer

- Suggested model: `sonnet`
- Use for: feature work, bug fixes, refactors, tests, focused code changes
- Expected output: working code, updated tests, concise implementation notes
- Avoid: making large architecture decisions without first checking the intended plan

### Reviewer

- Suggested model: `opus`
- Use for: code review, regression review, release-readiness checks, test-gap detection
- Expected output: findings first, then residual risks, then short summary
- Avoid: silently fixing issues during review unless explicitly asked

### Debugger

- Suggested model: `opus`
- Use for: failing tests, runtime issues, broken integrations, unclear behavior
- Expected output: root cause, evidence, reproduction steps, likely fix path
- Avoid: guessing or proposing fixes without tracing the actual failure

### Explorer

- Suggested model: `sonnet`
- Use for: codebase search, impact analysis, file discovery, "where is this defined?"
- Expected output: factual summary with file references
- Avoid: changing files during a discovery-only task

## Working Rules

1. Pick one primary role per task.
2. Start with Architect when the shape of the change is still unclear.
3. Use Implementer when the plan is clear and the task is mostly execution.
4. Use Reviewer after meaningful changes, especially before merge or release.
5. Use Debugger when something is failing and the cause is not obvious.
6. Use Explorer for research before coding when the affected surface area is unknown.
```

---

## Notes For Curato Users

- Keep this guide short enough to live comfortably in `CLAUDE.md`.
- Treat the model names as defaults, not hard constraints.
- Tailor the roles to your team; not every project needs all five.
- If your team already has stable workflows, use this as a scaffold rather than a replacement.

### Downsizing guidance

Not every project needs all five roles. Reasonable starting points:

- **Small team (1–3 people), tight scope**: Architect + Implementer + Reviewer. Skip Debugger and Explorer until you hit those specific pains.
- **Mid-size project (>10k LOC) or unfamiliar codebase**: add Explorer.
- **Systems with flaky integrations or runtime bugs**: add Debugger.
- **Single-developer side project**: collapsing to Architect + Implementer is fine — use Reviewer mode only before release.

Add a role only when you find yourself doing that kind of work repeatedly and the single-role approach is producing worse outcomes.
