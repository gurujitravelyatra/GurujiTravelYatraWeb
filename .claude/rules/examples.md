Usage Examples

Auto mode — feature from ADO (full pipeline, no interruptions):

Activate ORCHESTRATOR
Task: Implement feature card #1234 from ADO project 
Mode: AUTO

Activate ORCHESTRATOR
Task: Build the user story #5678 from Azure DevOps project 
Mode: AUTO
Scope: full-stack

Step mode — issue fix from ADO (confirm each step):

Activate ORCHESTRATOR
Task: Fix issue #4321 from ADO project 
Mode: STEP

Activate ORCHESTRATOR
Task: Resolve bug #8765 from Azure DevOps project 
Mode: STEP
Scope: frontend

Auto mode — UX redesign:

Activate ORCHESTRATOR
Task: Redesign the event detail screen. [screenshot]
Mode: AUTO

Direct activation (unchanged, backward-compatible):

Activate BACKEND
Activate FRONTEND

Verification
Activate ORCHESTRATOR in STEP mode with a sample task — verify it selects the right pipeline and proposes the correct first step
Activate a pipeline agent directly (e.g., Activate FRONTEND) — verify it works exactly as before (no regression)
Verify the "Caller Context" section is ignored during direct activation (no handoff block present = section is inert)



Activate ADO-CRAWLER
Project: 
Team: 
Filter: State: New
Mode: STEP
Only features from current sprint:


Activate ADO-CRAWLER
Project: 
Team: 
Filter: Type: Feature, Iteration: Sprint 42
Mode: AUTO
Only bugs tagged for automation:


Activate ADO-CRAWLER
Project: 
Team: 
Filter: Type: Bug, Tag: claude-ready
Mode: AUTO
Specific work item IDs:


Activate ADO-CRAWLER
Project: 
Team: 
Filter: IDs: 1234, 1235, 1240
Mode: AUTO


============ Brainstorm flow (IDEATION pipeline) ==========

The IDEATION pipeline now uses a decompose-then-dispatch model:
1. Brainstorming produces a design spec with a Feature Breakdown table
2. ORCHESTRATOR decomposes features into a dependency DAG with waves
3. Each feature gets its own ADO work item (via ado-create-work-items skill) and pipeline instance
4. Features are dispatched via the DAG executor (per-dependency triggering, not wave-barrier)

Activate ORCHESTRATOR
Task: I want to add an authentication system to the calendar app
Mode: AUTO
App: calendar

The orchestrator detects keywords like "ideation", "brainstorm", "new idea", "explore feature",
"design feature" and routes to the IDEATION pipeline.

What happens:
- Brainstorming skill runs interactively (with [critical-thinker + monorepo-architect] internally)
- User designs auth system → spec approved
- Spec includes Feature Breakdown: F1(API), F2(forms), F3(sessions), F4(routes), F5(E2E)
- DECOMPOSE: DAG built, waves assigned: W1=[F1,F2], W2=[F3,F4], W3=[F5]
- User confirms wave plan (all / select / revise / stop)
- ADO-CREATE: root Feature + 5 child Features + User Stories + Tasks created in ADO
- DAG EXECUTOR dispatches:
  t0: F1(backend-only) + F2(frontend-only) start in parallel
  t1: F1 done → F3 starts immediately (F2 still running — no wave barrier)
  t2: F2 + F3 done → F4 starts
  t3: F4 done → F5 starts
  t4: all complete → 5 PRs created

Step mode brainstorm (confirm each dispatch):

Activate ORCHESTRATOR
Task: Design and build a file sharing feature
Mode: STEP
App: 

Single-feature brainstorm (no decomposition needed):

Activate ORCHESTRATOR
Task: Brainstorm a dark mode toggle for the settings page
Mode: AUTO
App: 

When the Feature Breakdown has only 1 feature, DECOMPOSE/ADO-CREATE/DAG EXECUTOR
are skipped — the single feature runs its pipeline directly (same as old behavior).


============ DAG Executor — Wave Dispatch ==========

The DAG executor replaces the old wave-barrier model. Key differences:
- Items start as soon as their SPECIFIC predecessors complete (not entire wave)
- Wave numbers are used for display and priority (lower wave = higher priority for slots)
- Max 5 concurrent items globally (not per-wave)
- Failure only blocks transitive successors, not unrelated items

This applies to both:
- WAVE-CHECK dispatch (FEATURE/ISSUE pipelines with related ADO items)
- IDEATION DECOMPOSE dispatch (brainstormed features)

User choices when a wave plan is presented:
- `all`         → dispatch all items via DAG executor
- `single`      → only the current item (WAVE-CHECK only)
- `select <IDs>` → pick specific items, re-compute DAG
- `revise`      → edit Feature Breakdown and re-run DECOMPOSE (IDEATION only)
- `stop`        → abort

Failure handling during DAG execution:
- `retry <ID>`  → re-run the failed item
- `skip <ID>`   → treat as done, unblock successors (branch from main)
- `abort`       → stop executor, let running items finish
- `continue`    → ignore failure, deal with it later


=============Product flow============

Activate ORCHESTRATOR
Task: DOC-TO-ADO pipeline for app documentation
Mode: AUTO
Or directly:


Activate DOC-TO-ADO
App: 
Project: 
Area: 
