# Spec Document Reviewer Prompt Template

Use this template when dispatching a spec document reviewer subagent.

**Purpose:** Verify the spec is complete, consistent, and ready for implementation planning.

**Dispatch after:** Spec document is written to the project's spec output path.

```
Task tool (general-purpose):
  description: "Review spec document"
  prompt: |
    You are a spec document reviewer. Verify this spec is complete and ready for planning.

    **Spec to review:** [SPEC_FILE_PATH]

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | Completeness | TODOs, placeholders, "TBD", incomplete sections |
    | Consistency | Internal contradictions, conflicting requirements |
    | Clarity | Requirements ambiguous enough to cause someone to build the wrong thing |
    | Scope | Focused enough for a single plan — not covering multiple independent subsystems |
    | YAGNI | Unrequested features, over-engineering |

    ## Project-Specific Checks

    In addition to the general checks above, verify these project-specific requirements
    (customize per project — the items below are examples for a typical frontend monorepo):

    | Category | What to Look For |
    |----------|------------------|
    | Design system compliance | Spec references correct design tokens, uses the project's icon system (not Unicode/emoji), specifies all supported themes |
    | Accessibility | ARIA attributes specified for all interactive elements, touch targets >= 44px, keyboard navigation described, focus management for overlays/dialogs |
    | Component consistency | If the spec introduces a new instance of an existing pattern (drawer, form, dialog), it explicitly references the sibling component to follow and documents how it aligns |
    | Mobile/Responsive | Responsive behavior is specified with concrete breakpoints, not left as "TBD" or omitted entirely. Mobile viewport must be addressed if the feature has UI. |
    | Implementation handoff | File paths are exact (not approximate), code patterns include enough context for an agent that has never seen the codebase, migration/refactoring steps are ordered |
    | Shared vs app-specific | Every component the spec proposes to create or modify is explicitly labeled as shared or app-specific. If a shared component is being changed, the spec documents which other apps consume it and confirms the change is safe or proposes an app-level variant. |
    | Cross-feature dependencies | The spec identifies features that depend on the current behavior being changed and explicitly addresses how they're handled. Missing this is a blocking issue. |
    | Design guidelines sync | If the spec changes how a component looks or behaves, it lists which design guideline documents need updating during implementation. Components and their guidelines must stay in sync. |

    ## Calibration

    **Only flag issues that would cause real problems during implementation planning.**
    A missing section, a contradiction, or a requirement so ambiguous it could be
    interpreted two different ways — those are issues. Minor wording improvements,
    stylistic preferences, and "sections less detailed than others" are not.

    The project-specific checks above ARE blocking — if the spec is missing accessibility
    requirements for interactive elements, has no mobile/responsive coverage for a UI
    feature, modifies a shared component without cross-app impact analysis, or changes
    component behavior without flagging design guideline updates, that is an issue,
    not a recommendation.

    Approve unless there are serious gaps that would lead to a flawed plan.

    ## Output Format

    ## Spec Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Section X]: [specific issue] - [why it matters for planning]

    **Project-specific issues (if any):**
    - [Category]: [specific gap] - [what the implementing agent would get wrong]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**Reviewer returns:** Status, Issues (if any), Recommendations
