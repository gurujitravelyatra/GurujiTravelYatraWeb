---
name: orchestrator-dag
description: "DAG executor, wave detection, and dependency management for the ORCHESTRATOR. Reference doc, not a standalone agent."
---

# Orchestrator: DAG Executor & Wave Detection

> Loaded by: [orchestrator.md](orchestrator.md) — do not activate directly.

## Wave Detection (Post-ADO Fetch) — WAVE-CHECK

Runs automatically after ado-feature-briefing or ado-issue-intake in FEATURE and ISSUE pipelines.

### When It Runs

- **FEATURE pipeline:** After ado-feature-briefing fetches the feature card (step 1 -> step 1b)
- **ISSUE pipeline:** After ado-issue-intake fetches the issue (step 1 -> step 1b)

### Behavior

1. **Fetch relations** of the current work item using the work item tracker API. Inspect `relations` field.

2. **Identify related actionable items** — follow these relation types:

   | Link Type | Meaning | Direction |
   |-----------|---------|-----------|
   | Parent -> Child (hierarchy forward) | Parent -> Child | Fetch children |
   | Child -> Parent (hierarchy reverse) | Child -> Parent | Fetch parent + siblings |
   | Predecessor -> Successor (dependency forward) | Predecessor -> Successor | Fetch successors |
   | Successor -> Predecessor (dependency reverse) | Successor -> Predecessor | Fetch predecessors |
   | Related | Related (no order) | Fetch related items |

   Filters:
   - **Include** states: `New`, `Active`, `Approved`
   - **Exclude** states: `Resolved`, `Closed`, `Removed`
   - **Exclude** types not in: Feature, User Story, Product Backlog Item, Bug, Issue, Task

3. **Build the dependency DAG:**
   - Directed edges: `parent -> child`, `predecessor -> successor`
   - Detect cycles -> STOP and ASK
   - Topological sort -> assign execution waves
   - The **current work item** is always included

4. **Present the wave plan:**

   **No related items:**
   ```
   WAVE-CHECK: No related actionable work items found.
   Proceeding with single-item pipeline for #<ID>.
   ```

   **Related items found:**
   ```
   WAVE-CHECK — Related Work Items Detected
   ====================================================
   #<ID> has <N> related actionable work items.
   Organized into <W> execution wave(s).

   WAVE 1 — no dependencies (parallel):
   | # | ID | Type    | Title         | Pipeline | Relation to #<ID> |
   |---|--------|---------|---------------|----------|--------------------|
   ...

   How to proceed?
   - `all`    -> Dispatch all items (DAG executor)
   - `single` -> Continue with only #<ID>
   - `select <IDs>` -> Pick specific items
   - `stop`   -> Abort pipeline
   ```

5. **Handle user choice:**
   - **`all`** -> Enter DAG executor mode (see below)
   - **`single`** -> Continue current pipeline normally
   - **`select <IDs>`** -> Re-filter, re-compute DAG, re-present plan, then dispatch
   - **`stop`** -> Abort

## DAG Executor (Wave Dispatch)

When the user chooses `all` or `select`, the ORCHESTRATOR enters DAG executor mode. Waves remain as a display/priority concept, but execution is **per-dependency**: an item starts as soon as its specific predecessors complete and a slot is available.

### Item States

| State | Meaning |
|-------|---------|
| `blocked` | Has unfinished predecessors — cannot run |
| `ready` | All predecessors complete — in the priority queue |
| `running` | Executing in a worktree (occupies 1 of 5 slots) |
| `done` | Pipeline completed successfully |
| `failed` | Pipeline failed |
| `blocked-by-failure` | A predecessor failed — will not run |

### State Transitions

```
blocked -> ready                (last predecessor finishes)
ready -> running                (slot available, popped from queue)
running -> done                 (success)
running -> failed               (failure)
blocked -> blocked-by-failure   (a predecessor failed — transitive)
blocked-by-failure -> blocked   (user issues `retry` on failed predecessor)
```

### DAG Executor Loop

```
1. Seed: mark all items with no predecessors as `ready`
2. Fill: pop up to 5 `ready` items (wave-priority), mark `running`, spawn
3. Wait: wait for ANY running item to complete
4. On completion of item X:
   a. Mark X as `done` (or `failed`)
   b. For each successor S of X:
      - If ALL predecessors of S are `done` -> mark S as `ready`
   c. If a slot is free and queue is non-empty -> pop next, spawn
5. Repeat from step 3 until: queue empty AND no `running` items
```

### Priority Queue Ordering

1. **Wave number** (ascending) — Wave 1 before Wave 2
2. **Item ID** (ascending) — tie-breaker within same wave

### Slot Management

- **Max concurrency:** 5 simultaneous `running` items globally
- **Slot reclaim:** Immediately when item transitions to `done` or `failed`
- **Greedy fill:** Every time a slot frees, pop next from queue

### Failure Handling

When an item fails:
1. Free the slot
2. Mark all transitive successors as `blocked-by-failure`
3. Non-dependent items continue unaffected
4. Report to user

**User options:**

| Command | Behavior |
|---------|----------|
| `retry <ID>` | Reset failed item -> re-run. If succeeds -> successors unblock |
| `skip <ID>` | Treat as `done`. Successors branch from `main` instead |
| `abort` | Stop executor. Running items finish but successors NOT enqueued |
| `continue` | Ignore failure. Successors stay blocked. Other items keep running |

### Dispatch Details

<!-- Branch naming convention comes from project config -->
- **Branch naming:** `users/<username>/<item-id>-<kebab-case-title>`
<!-- PR title pattern comes from project config -->
- **PR title:** `AppName-(W<N>)-<ticketNumber>`
- **No predecessors:** Branch from current HEAD
- **Single predecessor:** Branch from predecessor's branch
- **Multiple predecessors:** Merge all predecessor branches
- **PR base:** No predecessors -> `main`. Single predecessor -> predecessor's branch. Multiple -> `main`.
- **Exception:** If predecessor was `skip`ped, successor branches from `main`

### Live Status Display

```
DAG STATUS — 4/6 complete
=========================
Running [3/5]: #1235(W1) #1239(W2) #1242(W2)
Queued  [1]:   #1250(W3)
Done    [4]:   #1234 #1236 #1237 #1238
Failed  [0]:   --
Blocked [1]:   #1251(W3) waiting on #1242
```

### Terminal Condition

DAG executor terminates when: queue empty AND no `running` items.

If `blocked-by-failure` items remain, produce final summary and prompt user.

## IDEATION DECOMPOSE

After the brainstorming spec is approved, the ORCHESTRATOR:
1. Reads the Feature Breakdown table from the design spec
2. Parses features, scopes, and dependency edges
3. Builds the dependency DAG (same algorithm as WAVE-CHECK)
4. Detects cycles -> STOP and ASK
5. Assigns wave numbers via topological sort
6. **Single-feature shortcut:** If exactly 1 feature -> skip, run per-feature pipeline directly
7. Presents the wave plan

**ADO-CREATE step (per feature):**
For each feature, create: child Feature + User Story + Tasks in the work item tracker. After all features, ORCHESTRATOR creates root parent Feature and links inter-feature dependencies.

Hierarchy: Root Feature > Child Features > User Stories > Tasks.

**Feature Breakdown format** (required in design spec):

```markdown
## Feature Breakdown

| ID | Feature | Scope | Depends On | Description |
|----|---------|-------|------------|-------------|
| F1 | Auth API endpoints | backend-only | -- | REST endpoints for login, logout, token refresh |
| F2 | Auth frontend forms | frontend-only | -- | Login/register forms with validation |
```

## AUTO vs STEP Mode

- **AUTO:** Present wave plan, wait for user choice, then DAG executor runs autonomously. Pauses only on failures.
- **STEP:** Present wave plan, wait for user choice, then pause before dispatching each item/group.
