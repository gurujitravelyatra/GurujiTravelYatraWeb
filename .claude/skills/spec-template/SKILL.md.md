---
name: spec-template
description: "Canonical specification document structure and validation. Provides the standard template for technical and functional specs. Use when creating or validating specification documents."
---

# Spec Template

Standard specification document structure. Runs inline — provides template and validates completeness.

## When to Use
- Called by agent `func-to-tech-spec` when producing tech specs
- Called by agent `func-spec-writer` when producing func specs
- Called by `spec-update` skill when creating new specs
- Standalone: `/spec-template <type>` where type is `technical` or `functional`

## Technical Specification Template

Path: ``

### Required Sections
1. **Overview** — purpose, scope, affected apps
2. **Functional Summary** — what the feature does (user-facing)
3. **Architecture Overview** — how it fits in the monorepo structure
4. **Frontend Spec** (if applicable) — components, hooks, state, routes
5. **Backend Spec** (if applicable) — modules, controllers, services, DTOs
6. **Data Contracts** — API endpoints, request/response DTOs, shared types
7. **Non-Functional Requirements** — performance, security, accessibility
8. **Acceptance Criteria** — testable statements
9. **Unit Tests** — list of expected test cases
10. **E2E Tests** — list of expected E2E scenarios

## Functional Specification Template

Path: ``

### Required Sections
1. **Context & Goal** — why this feature exists
2. **Functional Scope** — what's in and out
3. **User Roles** — who interacts with this feature
4. **User Flows** — step-by-step interactions
5. **Functional Requirements** — detailed behaviors
6. **Edge Cases & Errors** — what can go wrong
7. **Constraints** — legal, product, UX limitations
8. **Assumptions & Open Questions** — numbered list

## File Rules
- Path: `documentation//<app>/<spec-type>/`
- Name: kebab-case matching feature name
- One feature = one file
- MUST write file, NOT chat-only

## Validation Checklist
When validating a spec, check:
- [ ] All required sections present
- [ ] No empty sections (flag if found)
- [ ] Scope explicitly stated (in/out)
- [ ] Acceptance criteria are testable (not vague)
- [ ] Data contracts include request + response types
- [ ] No mixing of functional/technical concerns
