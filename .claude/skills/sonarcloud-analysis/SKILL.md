---
name: SonarCloud Analysis
description: Analyze code quality with SonarCloud MCP at the end of agentic flows. Identifies issues, code smells, duplications, and security vulnerabilities, then automatically fixes them.
---

# SonarCloud Analysis

Integrate SonarCloud code quality analysis into your agentic workflows to identify and fix issues, code duplications, and security vulnerabilities.

## What This Skill Does

This skill connects to SonarCloud via MCP to analyze your codebase and automatically fix identified issues:

**Key Capabilities:**
- **Code Analysis**: Run SonarCloud analysis on your project
- **Issue Detection**: Find bugs, code smells, security vulnerabilities
- **Duplication Detection**: Identify and resolve duplicated code blocks
- **Auto-Fix**: Automatically fix issues within the agentic flow
- **Quality Gate**: Verify code meets quality thresholds before completion

## Prerequisites

**Required:**
- SonarCloud account with project configured
- SonarCloud token (`SONARCLOUD_TOKEN` env variable)
- SonarCloud organization (`SONARCLOUD_ORG` env variable)
- SonarCloud MCP configured in `.mcp.json`

**Setup:**
```bash
# Set environment variables
export SONARCLOUD_TOKEN="your-token-here"
export SONARCLOUD_ORG="your-organization-key"
```

## Quick Start

### 1. Analyze Project Issues

```bash
# Fetch all issues for the project
mcp__sonarcloud__search_issues --projectKey "kissapps" --statuses "OPEN,CONFIRMED"
```

### 2. Get Issue Details

```bash
# Get specific issue details
mcp__sonarcloud__get_issue --issueKey "AZQ1234"
```

### 3. List Code Duplications

```bash
# Find duplicated code blocks
mcp__sonarcloud__get_duplications --component "kissapps:packages/front/src"
```

---

## Complete Guide

### Available MCP Tools

Once the SonarCloud MCP is connected, these tools become available:

#### Analysis Tools
- `mcp__sonarcloud__analyze_code` - Trigger code analysis
- `mcp__sonarcloud__get_analysis_status` - Check analysis progress
- `mcp__sonarcloud__get_quality_gate` - Get quality gate status

#### Issue Management
- `mcp__sonarcloud__search_issues` - Search for issues with filters
- `mcp__sonarcloud__get_issue` - Get detailed issue information
- `mcp__sonarcloud__bulk_change_issues` - Bulk update issue statuses

#### Metrics & Measures
- `mcp__sonarcloud__get_measures` - Get project metrics
- `mcp__sonarcloud__get_duplications` - Find code duplications
- `mcp__sonarcloud__get_hotspots` - List security hotspots

### Integration with Agentic Flow

#### Post-Task Hook Configuration

Add to `.claude/settings.json` to run SonarCloud analysis after tasks:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "^Task$",
        "hooks": [
          {
            "type": "command",
            "command": "npx claude-flow hook post-task --task-id '${result.task_id}' --analyze-performance",
            "async": true
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "mcp",
            "tool": "mcp__sonarcloud__search_issues",
            "params": {
              "projectKey": "${project.key}",
              "statuses": "OPEN,CONFIRMED",
              "createdAfter": "${session.start}"
            }
          }
        ]
      }
    ]
  }
}
```

### Workflow: End-of-Flow Analysis and Fix

#### Step 1: Trigger Analysis

After completing your development work, trigger a SonarCloud scan:

```
1. Use mcp__sonarcloud__get_quality_gate to check current status
2. Use mcp__sonarcloud__search_issues to list all open issues
3. Prioritize issues by severity (BLOCKER > CRITICAL > MAJOR)
```

#### Step 2: Analyze Issues

For each issue:

```
1. Get issue details with mcp__sonarcloud__get_issue
2. Read the affected file using Read tool
3. Understand the issue context and recommended fix
```

#### Step 3: Fix Issues

```
1. Apply fixes using Edit tool
2. Mark issue as resolved if SonarCloud supports it
3. Run tests to verify fix doesn't break functionality
```

#### Step 4: Handle Duplications

```
1. Use mcp__sonarcloud__get_duplications to find duplicated blocks
2. Extract common code into shared utilities
3. Replace duplications with calls to shared functions
```

### Agentic Flow Example

Complete workflow for end-of-flow quality check:

```
USER: "Analyze the codebase with SonarCloud and fix all issues"

FLOW:
1. INIT: Connect to SonarCloud MCP
   └── Verify authentication with ping_system

2. ANALYZE: Fetch current issues
   └── mcp__sonarcloud__search_issues --statuses "OPEN,CONFIRMED"

3. CATEGORIZE: Group by type
   ├── Bugs → Priority fix
   ├── Vulnerabilities → Security review
   ├── Code Smells → Refactor
   └── Duplications → Extract/consolidate

4. FIX LOOP: For each issue
   ├── Read affected file
   ├── Analyze issue context
   ├── Apply fix with Edit tool
   ├── Run related tests
   └── Store in memory for tracking

5. VERIFY: Check quality gate
   └── mcp__sonarcloud__get_quality_gate

6. REPORT: Generate summary
   └── Issues fixed, remaining items, quality status
```

### Issue Types and Fix Strategies

#### Bugs
```
- Null pointer dereferences → Add null checks
- Resource leaks → Add proper cleanup/try-finally
- Logic errors → Correct conditional logic
```

#### Vulnerabilities
```
- SQL Injection → Use parameterized queries
- XSS → Sanitize user input
- Hardcoded secrets → Move to environment variables
```

#### Code Smells
```
- Long methods → Extract smaller functions
- Duplicated literals → Define constants
- Complex conditionals → Simplify with early returns
```

#### Duplications
```
- Same code in multiple places → Extract to shared utility
- Similar patterns → Create generic function
- Copy-paste errors → Refactor to single source of truth
```

### Integration with Swarm Agents

Spawn specialized agents for different issue types:

```bash
# For security issues
npx claude-flow agent spawn --type security-architect \
  --task "Review and fix security vulnerabilities from SonarCloud"

# For refactoring
npx claude-flow agent spawn --type coder \
  --task "Refactor code smells identified by SonarCloud"

# For testing
npx claude-flow agent spawn --type tester \
  --task "Verify fixes don't break existing functionality"
```

### Memory Coordination

Store analysis results in swarm memory for tracking:

```bash
# Store issues for tracking
mcp__claude-flow__memory_store \
  --key "sonarcloud/issues/${date}" \
  --namespace "quality" \
  --value "${issues_json}"

# Retrieve previous analysis
mcp__claude-flow__memory_retrieve \
  --key "sonarcloud/issues/latest" \
  --namespace "quality"
```

### Quality Gate Thresholds

Configure minimum quality standards:

| Metric | Threshold |
|--------|-----------|
| Coverage | >= 80% |
| Duplications | <= 3% |
| Maintainability Rating | A |
| Reliability Rating | A |
| Security Rating | A |

### Best Practices

1. **Run Analysis Early** - Catch issues before they accumulate
2. **Fix High Severity First** - Blockers and Critical issues prioritized
3. **Use Memory** - Track issue trends over sessions
4. **Coordinate Agents** - Different agents for different issue types
5. **Verify Fixes** - Always run tests after applying fixes
6. **Document Decisions** - Store rationale for deferred issues

### Troubleshooting

#### MCP Connection Issues
```bash
# Test connection
mcp__sonarcloud__ping_system

# Check environment variables
echo $SONARCLOUD_TOKEN
echo $SONARCLOUD_ORG
```

#### No Issues Found
- Verify project key matches SonarCloud configuration
- Check analysis has run on the target branch
- Confirm issue filters are correct

#### Rate Limiting
- Add delays between requests if hitting limits
- Use bulk operations when possible
- Cache results in memory

### Related Skills

- **Hooks Automation** - Trigger SonarCloud analysis in hooks
- **Verification Quality** - Combine with truth-score validation
- **SPARC Methodology** - Integrate into SPARC refinement phase
- **Swarm Orchestration** - Coordinate multi-agent issue fixing
