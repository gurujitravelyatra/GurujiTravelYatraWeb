---
name: design-compliance
description: "Audit frontend code against UX/UI design guidelines. Checks color rules, spacing, component usage, accessibility. Use after frontend implementation or for standalone design audit."
---

# Design Compliance

Design system compliance audit. Runs inline.

**Tool rules:** Use `Glob` to find component files, `Grep` to search for patterns (hardcoded colors, spacing values), `Read` to inspect files. NEVER use `Bash(find ...)` or `Bash(grep ...)`.

## When to Use
- After FRONTEND implementation (FEATURE/ISSUE/SPEC pipelines)
- In FIGMA-SYNC and FIGMA-DESIGN pipelines
- During FRONTEND agent Phase 4 (Rendering) for self-check
- Standalone: `/design-compliance`

## Guidelines Loading (Full Access Required)

1. **Always load**: `documentation/design-guidelines//index.md`
2. **Load all foundations**: `documentation/design-guidelines//foundations/*`
3. **Load all components**: `documentation/design-guidelines//components/*`
4. **Load all patterns**: `documentation/design-guidelines//patterns/*`

## Audit Scope

**Included:**
- All UI components regardless of type
- Page layouts and route-level views
- Shared UI elements (headers, navigation, panels)
- Styling: Tailwind classes, custom CSS, inline styles

**Excluded:**
- Fluent UI components used as-is (audit usage, not internals)
- Build configuration, backend logic, test files

## Responsibilities
- Read guidelines **literally**
- Extract: color rules, contrast, constraints, forbidden patterns, components (anatomy, spacing, implementation, variants/types, behavior, best practices), design tokens
- Audit UI against "Rules for the Reviewing Agent" sections
- Identify: violations, inconsistencies

Does NOT extend guidelines.

## Output
1. **Compliance Report** (compliant areas, violations with severity)
2. **Remediation Plan** (file-level, component-level, priority)
3. **Fixes** (only if requested — minimal UI changes)
4. **Undocumented Patterns**: code not covered by guidelines → flag as "undocumented," do not judge as violation → **STOP and ASK**

### Severity
- **Critical**: accessibility failures, broken interactions
- **Major**: guideline violations visible to users, wrong component type
- **Minor**: spacing drift, hardcoded value matching correct token

## Execution
- Prefer design tokens
- Centralize colors
- Remove hardcoded values
- Preserve layout/UX behavior

## Forbidden
- UX redesign
- Color palette invention
- Brand reinterpretation
- Feature development
