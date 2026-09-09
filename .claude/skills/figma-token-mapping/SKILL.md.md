---
name: figma-token-mapping
description: Map Figma design values (hex colors, px dimensions, typography) to the project's design tokens in tokens.css and _theme-colors.scss. Produces a token mapping table and flags any unmapped raw values needing design token entries. Used by both Figma-to-code and code-to-Figma flows.
triggers:
  - map tokens
  - token mapping
  - figma token
  - design tokens
  - resolve tokens
---

# Skill: figma-token-mapping

Teaches Claude how to map Figma values to design tokens and resolve CSS custom properties.
Used by: FIGMA-SYNC agent, FIGMA-DESIGNER agent

---

## Token Sources

Always read both files before mapping:

| File | Contains |
|------|----------|
| `` | Spacing, typography, z-index, breakpoints, radius, shadows |
| `` | Color tokens (brand, neutral, status, foreground, background) |

Cross-reference against:
- `documentation/design-guidelines//foundations/colors.md`
- `documentation/design-guidelines//foundations/spacing.md`

---

## Mapping Rules

| Value type | Mapping rule |
|------------|-------------|
| Exact hex color | → nearest `var(--color-*)` or `var(--brand-*)` or `var(--status-*)` token |
| Background/surface color | → `var(--background-1/2/3)` |
| Text color | → `var(--foreground-1/2/3)` or `var(--foreground-on-brand)` |
| Spacing / padding / margin | → nearest `var(--spacing-*)` token on the 4px scale |
| Border radius | → `var(--radius-small/medium/large/xlarge/circular)` |
| Font size | → `var(--font-size-100)` through `var(--font-size-800)` |
| Font weight | → `var(--font-weight-regular/semibold/bold)` |
| Line height | → `var(--line-height-*)` |
| Shadow | → `var(--shadow-2/4/8/16/28)` |
| Z-index | → `var(--z-index-*)` if defined |

**Only use raw values (hardcoded hex/px) when NO matching token exists AND the guidelines do not define one.**

---

## Required Token Categories to Resolve

When building a complete token map for a DESIGN session, resolve all of:

- Background surfaces: `--background-1`, `--background-2`, `--background-3`
- Foregrounds: `--foreground-1`, `--foreground-2`, `--foreground-3`, `--foreground-on-brand`
- Brand: `--brand-background`, `--brand-background-hover`, `--brand-foreground`
- Strokes: `--neutral-stroke-1`, `--neutral-stroke-2`, `--neutral-stroke-accessible`
- Status: `--status-danger`, `--status-warning`, `--status-success`, `--status-info`
- Spacing: full `--spacing-*` scale
- Radius: full `--radius-*` scale
- Typography: `--font-family-base`, full `--font-size-*` and `--font-weight-*` scales
- Shadows: `--shadow-2`, `--shadow-4`, `--shadow-8`, `--shadow-16`

---

## Token Mapping Table Output Format

Produce this table for every component:

```
TOKEN MAPPING — <ComponentName>
─────────────────────────────────────────────────────────
Property         | Figma value   | Token                     | Resolved value | Status
-----------------|---------------|---------------------------|----------------|--------
background       | #5b5fc7       | var(--brand-background)   | #5b5fc7        | Mapped
height           | 32px          | var(--size-800)           | 32px           | Mapped
padding          | 6px 12px      | var(--spacing-6/12)       | 6px 12px       | Mapped
font-size        | 14px          | var(--font-size-300)      | 14px           | Mapped
border-radius    | 4px           | var(--radius-medium)      | 4px            | Mapped
border-color     | #e05252       | —                         | #e05252        | Unmapped
```

---

## Unmapped Values

Any raw value with no matching token must be flagged:

```
UNMAPPED VALUES — require design token system update:
  <ComponentName>.border-color : #e05252 used for danger border
  <ComponentName>.icon-size    : 18px — no matching size token
```

Flag these as action items for the design system team, but do not block the build.

---

## Tailwind → CSS Resolution Reference

| Tailwind class | CSS equivalent |
|----------------|---------------|
| `p-1` | `padding: 4px` |
| `p-2` | `padding: 8px` |
| `p-3` | `padding: 12px` |
| `p-4` | `padding: 16px` |
| `px-3 py-1.5` | `padding: 6px 12px` |
| `h-8` | `height: 32px` |
| `h-9` | `height: 36px` |
| `h-10` | `height: 40px` |
| `text-xs` | `font-size: 12px` |
| `text-sm` | `font-size: 14px` |
| `text-base` | `font-size: 16px` |
| `rounded` | `border-radius: 4px` |
| `rounded-md` | `border-radius: 6px` |
| `rounded-lg` | `border-radius: 8px` |
| `rounded-full` | `border-radius: 9999px` |
| `gap-2` | `gap: 8px` |
| `gap-3` | `gap: 12px` |

Use the project's Tailwind config if present; fall back to standard Tailwind v3 defaults.
