---
name: spec-update
description: "Update or create technical specifications after issue resolution or feature implementation. Finds related spec and appends resolution details, or creates new spec if none exists."
---

# Spec Update

Post-implementation technical specification maintenance. Runs inline.

## When to Use
- After issue resolution (ISSUE pipeline)
- After implementation (PUSH pipeline)
- After feature delivery (FEATURE pipeline)
- Standalone: `/spec-update`

## Required Input
- Implementation summary (changed files, approach taken)
- Scope: which app, frontend / backend / full-stack
- Issue analysis or feature description (for context)

## Workflow

### 1. Identify Target App
From scope, determine the app: , etc.

### 2. Search Existing Specs
List files in `documentation//<app>/technical-specification/`.
Match by: file name, overview content, covered modules.

### 3a. Update Mode (spec found)
Append a new section:

```markdown
## Issue Resolution: <ADO work item ID>

### Problem
<description from issue analysis>

### Root Cause
<what was wrong>

### Solution
<what was changed and why>

### Files Changed
<list of files>

### Impact on Existing Behavior
<behavioral changes, or "None — bug fix only">
```

Do NOT rewrite existing content. Append only.

### 3b. Create Mode (no spec found)
Create new spec at `documentation//<app>/technical-specification/<feature-area>.md`:
1. Overview (purpose, scope)
2. Functional Summary
3. Architecture Overview
4. Frontend Spec (if applicable)
5. Backend Spec (if applicable)
6. Data Contracts
7. Non-Functional Requirements
8. Acceptance Criteria
9. Issue History

Use the `spec-template` skill for structure if available.

## File Rules
- Path: `documentation//<app>/technical-specification/`
- Name: kebab-case
- One feature area = one file
- MUST write file, NOT chat-only

## Forbidden
- Rewriting existing spec content
- Removing existing sections
- Implementing code
- Creating specs for unaffected areas
