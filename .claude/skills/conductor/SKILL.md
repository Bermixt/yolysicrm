---
name: conductor
description: Spec-driven development workflow. Use to start the next task, check track status, open or close a track, or run a phase checkpoint.
---

# Conductor — Spec-Driven Development Process

## What conductor/ is

`conductor/` is the project's **spec-driven development brain**. It replaces ad-hoc conversations with a structured, auditable process: every feature starts as a written specification, is broken into a phased plan, and is executed task-by-task with TDD, git checkpoints, and manual sign-off at every phase boundary.

The directory is never shipped — it lives alongside the code as a first-class project artifact that any AI agent or human developer can pick up and understand without prior context.

---

## Directory structure

```
conductor/
  product.md              # Product vision, target audience, key features
  product-guidelines.md   # UX/design principles and branding rules
  tech-stack.md           # Deliberate, documented technology choices
  workflow.md             # The full task + phase lifecycle (source of truth for HOW to work)
  tracks.md               # Registry of all tracks with done/todo status
  learnings.md            # Cross-track bug log and hard-won knowledge — see format below
  code_styleguides/       # Language-specific style guides (TypeScript, HTML/CSS…)
  tracks/
    <track_id>/
      index.md            # Pointers to spec, plan, metadata
      spec.md             # What to build and why (acceptance criteria, requirements)
      plan.md             # Phased breakdown with task checkboxes + commit SHAs
      metadata.json       # Canonical track metadata — see format below
```

---

## learnings.md — purpose, format and rules

`conductor/learnings.md` is a **persistent bug and constraint log** shared across all tracks. It captures issues discovered during implementation so that future tracks can avoid the same mistakes at the spec and plan stage.

### When to write a learning entry

Write an entry whenever:
- A runtime error reveals a platform constraint that was not known before (e.g. Convex limits).
- A bug is caused by a pattern used consistently across the codebase that needs to be changed everywhere.
- A fix requires undoing or reworking something that was already implemented.
- An assumption in the spec or plan turned out to be wrong.

Do NOT write an entry for:
- Simple bugs caused by typos or logic errors with no systemic implication.
- Issues already documented in `tech-stack.md` before the track started.

### Entry format

```markdown
### [LEARN-NNN] Short title

- **Track:** `track_id`
- **Discovered:** YYYY-MM-DD
- **Symptom:** Exact error message or observed bad behaviour
- **Root cause:** Why it happened — the underlying reason, not just the surface error
- **Fix:** What was changed to resolve it (files + approach)
- **Prevention:** Concrete rule to apply in future specs/plans to avoid recurrence
```

Entry IDs (`LEARN-NNN`) are sequential and never reused.

### How to use learnings when opening a new track

1. Read `conductor/learnings.md` before writing `spec.md`.
2. For each relevant entry, add a note in spec.md `## Technical Considerations` referencing the learning ID (e.g. "See LEARN-001 — batch size must be ≤ 2,000").
3. Add a corresponding task in `plan.md` if the prevention requires upfront code decisions.

### Relationship to tech-stack.md

- `learnings.md` is the **raw incident log** — one entry per issue, with full context and narrative.
- `tech-stack.md` is the **living reference** — distilled rules and patterns extracted from learnings, kept concise and actionable.
- When a learning produces a generalizable rule, add it to `tech-stack.md` as well. Cross-reference both.

---

## metadata.json — canonical format and rules

Every track folder **must** contain a `metadata.json` with exactly these fields:

```json
{
  "track_id": "<track_id>",
  "type": "feature",
  "status": "new",
  "created_at": "<ISO 8601 timestamp>",
  "updated_at": "<ISO 8601 timestamp>",
  "description": "<one-line description of what the track builds>"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `track_id` | string | Must match the folder name exactly (e.g. `csv_import_20260317`) |
| `type` | string | Always `"feature"` for now; reserved for future values (`"bugfix"`, `"refactor"`) |
| `status` | string | Lifecycle value: `"new"` → `"in_progress"` → `"done"` |
| `created_at` | ISO 8601 | Set once when the track is opened; never changed |
| `updated_at` | ISO 8601 | Update every time `status` changes |
| `description` | string | One sentence, no period. Matches the title in `tracks.md` |

**Rules:**
- `metadata.json` contains **only** these six fields — no phases, no task lists (those live in `plan.md`).
- Set `status: "new"` when opening the track, `"in_progress"` when the first task is marked `[~]`, `"done"` when the track is closed.
- `updated_at` must be refreshed whenever `status` changes.
- The file lives at `conductor/tracks/<track_id>/metadata.json` — never at the root of `conductor/`.

---

## Rationale — why this exists

| Problem | Solution |
|---------|----------|
| AI agents lose context between sessions | spec.md + plan.md are the persistent memory |
| Features get built without clear acceptance criteria | Every track starts with a spec; no code before the spec is written |
| It's hard to know what's done vs in-progress | plan.md tracks every task; metadata.json tracks track status |
| Commits are orphaned from intent | Git notes attach a detailed task summary to each commit |
| Phases can drift from the original design | Phase checkpoints require explicit user sign-off before continuing |
| Tech debt from undocumented decisions | tech-stack.md must be updated before any deviation is implemented |

---

## Track lifecycle

```
new → in_progress → done
```

A **track** is a self-contained feature or epic. It maps to a folder under `conductor/tracks/` and an entry in `conductor/tracks.md`.

### How to open a new track

1. Create `conductor/tracks/<track_id>/` with `index.md`, `spec.md`, `plan.md`, `metadata.json`.
2. Write `spec.md` first — requirements, acceptance criteria, technical considerations.
3. Write `plan.md` — phases and tasks derived from the spec.
4. Set `metadata.json` status to `"new"`.
5. Add an unchecked entry to `conductor/tracks.md`.
6. Commit: `conductor(plan): Open track <track_id>`.

### How to close a track

1. All tasks in `plan.md` are `[x]`.
2. Phase 5 (manual verification) is signed off.
3. Set `metadata.json` status to `"done"`.
4. Check the entry in `conductor/tracks.md`.
5. Commit: `conductor(plan): Close track <track_id>`.

---

## Task lifecycle inside plan.md

Each task checkbox follows this progression:

| Symbol | Meaning |
|--------|---------|
| `[ ]`  | Not started |
| `[~]`  | In progress (mark this before touching any code) |
| `[x] <7-char SHA>` | Done — SHA of the commit that implemented it |

**Never start coding without first changing `[ ]` to `[~]` in plan.md.**

---

## The standard task workflow (from workflow.md)

Execute tasks in sequential order, one at a time:

1. **Mark `[~]`** in plan.md and commit the plan change.
2. **Red phase** — write a failing test that encodes the acceptance criteria. Run it; confirm it fails. Do not proceed until it fails.
3. **Green phase** — write the minimum code to make the test pass. Run tests; confirm green.
4. **Refactor** — clean up without changing behaviour. Re-run tests.
5. **Coverage** — verify >80% coverage for new code (`npm test`).
6. **Tech-stack deviation?** Stop. Update `tech-stack.md` first. Then resume.
7. **Commit code** — conventional commit: `feat(scope): description`.
8. **Attach git note** — `git notes add -m "<task summary, files changed, why>" <sha>`.
9. **Mark `[x] <sha>`** in plan.md, commit: `conductor(plan): Mark task '<name>' as complete`.

---

## Phase completion & checkpointing protocol

Triggered automatically when the last task of a phase is done:

1. Announce phase completion.
2. Identify all files changed in the phase (`git diff --name-only <prev_checkpoint_sha> HEAD`).
3. For each code file, verify a test file exists — create one if missing.
4. Run the full test suite (`npm test`). Debug up to 2 times; stop and ask user if still failing.
5. Generate a manual verification plan (step-by-step, with expected outcomes) from `spec.md` + `product.md`.
6. **Wait for explicit user confirmation** ("yes" or feedback).
7. Create checkpoint commit: `conductor(checkpoint): Checkpoint end of Phase X`.
8. Attach a full verification report as a git note to the checkpoint commit.
9. Append `[checkpoint: <7-char-sha>]` to the phase heading in `plan.md`.
10. Commit plan update: `conductor(plan): Mark phase '<Phase Name>' as complete`.

---

## Key rules to follow when working in this project

- **spec.md is the contract.** If the spec and the code disagree, the spec wins until the user explicitly changes it.
- **plan.md is the source of truth for progress.** Never mark a task done unless the tests pass and the commit SHA is recorded.
- **tech-stack.md must be updated before any dependency or tooling change is implemented.**
- **One task at a time, in order.** Do not jump ahead or batch multiple tasks into one commit.
- **Phase checkpoints are mandatory.** Do not start Phase N+1 without a checkpoint commit and user sign-off on Phase N.
- **Git notes are the audit trail.** Every implementation commit and checkpoint commit gets a note.

---

## How to invoke this skill

Use `/conductor` when you want to:

- **Start the next task**: read the current track's `plan.md`, find the first `[ ]`, mark it `[~]`, and begin the TDD workflow.
- **Check current status**: read `conductor/tracks.md` and the active track's `plan.md` to report what is done, in-progress, and next.
- **Open a new track**: scaffold a new track folder from a feature description.
- **Close a track**: verify all tasks are done and update metadata + tracks.md.
- **Run a phase checkpoint**: execute the full checkpoint protocol for the just-completed phase.
