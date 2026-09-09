---
name: memory-review
description: "Review and maintain persistent memory. List, verify, update, or clean stale memories. Use at session end or when memory needs maintenance."
---

# Memory Review

Review, verify, and maintain the persistent memory system.

## When to Use
- End of a productive session (`/memory-review`)
- After architectural decisions or corrections
- Periodic maintenance (monthly)

## Workflow

### 1. Read Current State
Read `MEMORY.md` index and count entries.

### 2. Verify Freshness
For each memory file:
- **feedback** memories: Still valid? Approach still correct?
- **project** memories: Still active? Deadline passed? Initiative completed?
- **reference** memories: Resources still exist? URLs still valid?
- **user** memories: Profile still accurate?

### 3. Check for Saves Needed
Review the current conversation for unsaved:
- Corrections or preferences (-> feedback memory)
- Decisions or deadlines (-> project memory)
- New external resources (-> reference memory)

### 4. Clean Stale Entries
- Remove project memories for completed/abandoned work
- Update feedback memories if approach has evolved
- Merge duplicate or overlapping memories

### 5. Report
Output a brief summary:
```
Memory Status: <N> files, ~<N>K tokens
- Added: <list or "none">
- Updated: <list or "none">
- Removed: <list or "none">
- Total: <N> entries in MEMORY.md
```

## Budget Check
If over 15 memory files or MEMORY.md over 200 lines, flag for consolidation.
