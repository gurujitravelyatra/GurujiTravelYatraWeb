# Shared References

## File Paths

### Design Guidelines
```
documentation/design-guidelines//
├── index.md                          ← Always load (overview, catalog, patterns)
│
├── foundations/                      ← Load on demand
│   ├── accessibility-checklist.md
│   ├── colors.md
│   ├── icons-imagery.md
│   ├── layout.md
│   └── spacing.md
│
├── components/                       ← Load on demand
│   ├── actions.md
│   ├── data-display.md
│   ├── feedback.md
│   ├── forms.md
│   ├── layout.md
│   ├── media.md
│   ├── navigation.md
│   ├── pickers.md
│   └── sort-filter.md
│
└── patterns/                         ← Load on demand
    └── settings-view-pattern.md
```

### Technical Specs
```
/<feature-name>.md
```

### Architecture
```
documentation/architecture.md
```

## Common Input Patterns

### STOP_MISSING
> Missing required input → **STOP and ASK**

### STOP_UNCLEAR
> Behavior/scope unclear → **STOP and ASK**

### STOP_CONTEXT
> Context missing → **STOP and ASK**

## Common Forbidden Patterns

### NO_FEATURE
- Feature invention/development

### NO_SILENT
- Silent assumptions
- Guessing business logic

### NO_SECRETS
- Secrets in code/logs
- Security shortcuts

### NO_STYLE_ONLY
- Cosmetic-only changes without justification
