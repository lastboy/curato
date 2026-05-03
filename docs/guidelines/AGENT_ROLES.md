# Curato Dev Agent Roles & Task Assignment

_Last updated: 2026-04-23_

## Purpose

This document defines the working roles used when developing **Curato itself**.

Curato is not a generic application platform. It is a **Claude Code environment manager** with two main layers:

- `plugin/` for conversational UX inside Claude Code
- `cli/` for actual execution, filesystem changes, scanning, and setup logic

Because of that, Curato roles should map to the kinds of work this repo actually contains:

- CLI command behavior
- scanner and patcher internals
- plugin command/agent prompt design
- `curato-setup.json` schema and team setup flows
- docs, migration guidance, and release consistency

---

## How To Use This

Pick the role that best matches the task's primary responsibility.

- Roles define **who owns the work**
- Skills/processes define **how the work is done**
- A single person or LLM can switch roles during a task, but the expected output should stay role-consistent

Example:

- Designing a new `curato setup` config capability: use **Config Architect**
- Implementing it in `cli/src/`: use **CLI Implementer**
- Updating `/setup-team` prompts and README after the change: use **Plugin & Docs Integrator**
- Checking everything still matches before release: use **Release Reviewer**

---

## Roles

### 1. Config Architect

| Property | Value |
|----------|-------|
| **Suggested model** | `opus` |
| **Primary scope** | `curato-setup.json` schema, migration strategy, behavior contracts, cross-file design decisions |
| **Owns** | Schema changes, merge semantics, user/project scope rules, env-var expansion rules, upgrade/migration decisions |
| **Avoids** | Large implementation changes unless needed to validate the design |
| **Typical outputs** | Design notes, schema changes, validation decisions, docs updates, release notes for behavior changes |

**When to use**

- Adding a new top-level key to `curato-setup.json`
- Changing how `include` / `exclude` skill filtering should work
- Deciding whether a command should mutate user scope, project scope, or both
- Defining how Curato should migrate older MCP-based installs

**Behavior**

- Starts with user-facing behavior, then maps it to code
- Looks for consistency across CLI, docs, plugin prompts, and examples
- Treats config changes as compatibility-sensitive
- Prefers additive evolution over breaking changes

---

### 2. CLI Implementer

| Property | Value |
|----------|-------|
| **Suggested model** | `sonnet` |
| **Primary scope** | `cli/src/cli`, `cli/src/scanner`, `cli/src/patcher`, `cli/src/utils`, `cli/src/types.ts` |
| **Owns** | Command behavior, scan output, mutation safety, path handling, backups, dry-run behavior, tests |
| **Avoids** | Redefining product behavior without first aligning with Config Architect or docs intent |
| **Typical outputs** | Code changes, tests, bug fixes, command additions, safer filesystem behavior |

**When to use**

- Implementing or fixing a CLI command
- Updating scan output or JSON output shape
- Fixing backup, merge, or registry mutation behavior
- Making Windows/macOS/Linux handling more robust

**Behavior**

- Keeps mutations explicit and reversible
- Preserves Curato's guarantees: backup before write, additive merges, dry-run support
- Verifies behavior with focused tests
- Optimizes for predictable local CLI usage and plugin-driven usage

---

### 3. Plugin & Docs Integrator

| Property | Value |
|----------|-------|
| **Suggested model** | `sonnet` |
| **Primary scope** | `plugin/`, `README.md`, `docs/architecture/*`, migration and usage docs |
| **Owns** | Slash-command prompts, agent prompts, examples, command docs, install/migration guidance |
| **Avoids** | Inventing CLI behavior that does not exist |
| **Typical outputs** | Updated markdown prompts, aligned examples, corrected docs, clearer UX copy |

**When to use**

- Updating `/doctor`, `/repair`, `/setup-team`, or `/scan`
- Fixing stale README examples after a CLI change
- Improving migration docs from MCP server to CLI
- Aligning plugin prompts with actual command behavior

**Behavior**

- Treats the plugin as a thin UX layer over the CLI
- Ensures every documented command actually exists
- Avoids promising repair flows the CLI cannot support
- Keeps instructions concrete and copy-pasteable

---

### 4. Scanner / Repair Specialist

| Property | Value |
|----------|-------|
| **Suggested model** | `opus` |
| **Primary scope** | Environment diagnosis and additive repair workflows |
| **Owns** | `scan`, `remove-mcp`, `register-mcp`, `clear-cache`, setup verification, failure triage |
| **Avoids** | Broad refactors unrelated to the diagnosed issue |
| **Typical outputs** | Root-cause analysis, repair steps, safer detection logic, improved repair flows |

**When to use**

- A user says "Curato isn't finding my setup"
- `scan` output is incomplete or misleading
- Repair prompts recommend the wrong commands
- A registry mismatch exists between VS Code and CLI

**Behavior**

- Reads the environment before mutating it
- Distinguishes detection bugs from documentation bugs
- Prefers minimal repairs over broad reinstall advice
- Verifies fixes by re-running scan or checking the mutated config

**Note**

This role is conceptually mirrored by Curato's plugin agents:

- `scanner-agent` for read-only environment analysis
- `repair-agent` for scan → confirm → apply flows
- `bootstrap-agent` for minimal project scaffolding

---

### 5. Release Reviewer

| Property | Value |
|----------|-------|
| **Suggested model** | `opus` |
| **Primary scope** | Final consistency review across code, docs, prompts, and tests |
| **Owns** | Regression detection, release readiness, user-visible consistency, migration safety |
| **Avoids** | Sneaking in opportunistic feature work during review |
| **Typical outputs** | Review findings, risk notes, test gaps, release blockers, follow-up checklist |

**When to use**

- Before publishing a new npm version
- After a large migration or refactor
- After changing command surfaces or config schema
- When reviewing whether docs and prompts still match the CLI

**Behavior**

- Starts from user-visible behavior, not internal intention
- Checks code paths, docs, plugin prompts, and examples together
- Prioritizes regressions, broken workflows, and mismatches
- Calls out release blockers clearly

---

## Task Mapping

| Task type | Recommended role | Suggested model |
|-----------|------------------|-----------------|
| Add/change `curato-setup.json` schema | Config Architect | `opus` |
| Implement a new CLI command | CLI Implementer | `sonnet` |
| Fix `scan --json` or output formatting | CLI Implementer | `sonnet` |
| Repair plugin command markdown after CLI changes | Plugin & Docs Integrator | `sonnet` |
| Update migration docs from MCP to CLI | Plugin & Docs Integrator | `sonnet` |
| Diagnose broken user environment flow | Scanner / Repair Specialist | `opus` |
| Review refactor for regressions | Release Reviewer | `opus` |
| Verify README examples still work | Release Reviewer | `opus` |

---

## Common Workflows

### New feature in team setup

```
Config Architect
  → defines intended user behavior and schema shape
CLI Implementer
  → implements validation, command behavior, tests
Plugin & Docs Integrator
  → updates /setup-team, README, examples
Release Reviewer
  → checks behavior, docs, and prompts all match
```

### Bug in environment repair

```
Scanner / Repair Specialist
  → reproduces and identifies the failure mode
CLI Implementer
  → fixes scanner/patcher/command behavior
Plugin & Docs Integrator
  → updates repair instructions if needed
Release Reviewer
  → confirms no stale workflow remains
```

### MCP-to-CLI migration cleanup

```
Release Reviewer
  → finds mismatches and regressions
CLI Implementer
  → fixes runtime behavior
Plugin & Docs Integrator
  → removes stale MCP-era guidance
Config Architect
  → resolves any compatibility decisions
```

---

## Curato-Specific Working Rules

These rules apply regardless of role:

1. Treat the CLI as the source of truth for behavior.
2. Treat plugin markdown as a UX layer, not an implementation layer.
3. Do not document commands that do not exist.
4. Any mutation path should preserve Curato's safety guarantees:
   - backup before write
   - additive merge behavior
   - explicit dry-run where applicable
5. Schema examples in docs must match validator behavior.
6. Migration guidance must match what users can actually run today.

## Model Notes

- These model assignments are for **Curato development work**, not end-user project workflows.
- They are defaults, not hard requirements.
- If a concrete plugin agent file defines a model for runtime behavior, that file is the source of truth for the shipped plugin behavior.
- Use the lighter model when the task is mostly implementation or markdown alignment; use the stronger model when the task is primarily design, diagnosis, or review.

---

## What Not To Copy From Other Projects

The following are signs this file has drifted away from Curato again:

- references to Docker, containers, deploy pipelines, or service health endpoints
- roles centered on backend/domain architecture unrelated to Claude Code setup
- role assignments based on tools Curato does not use
- examples that mention unrelated systems, adapters, or infrastructure layers

If a role description cannot be tied back to:

- `plugin/`
- `cli/`
- `curato-setup.json`
- environment scanning/repair
- documentation/release alignment

then it probably does not belong in Curato.
