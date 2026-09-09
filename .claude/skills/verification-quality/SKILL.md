---
name: "Verification & Quality Assurance"
description: "Comprehensive truth scoring, code quality verification, and automatic rollback system with 0.95 accuracy threshold for ensuring high-quality agent outputs and codebase reliability."
version: "2.0.0"
category: "quality-assurance"
tags: ["verification", "truth-scoring", "quality", "rollback", "metrics", "ci-cd"]
---

# Verification & Quality Assurance Skill

## What This Skill Does

This skill provides a comprehensive verification and quality assurance system that ensures code quality and correctness through:

- **Truth Scoring**: Real-time reliability metrics (0.0-1.0 scale) for code, agents, and tasks
- **Verification Checks**: Automated code correctness, security, and best practices validation
- **Automatic Rollback**: Instant reversion of changes that fail verification (default threshold: 0.95)
- **Quality Metrics**: Statistical analysis with trends, confidence intervals, and improvement tracking
- **CI/CD Integration**: Export capabilities for continuous integration pipelines
- **Real-time Monitoring**: Live dashboards and watch modes for ongoing verification

## Prerequisites

- Claude Flow installed (`npx claude-flow@alpha`)
- Git repository (for rollback features)
- Node.js 18+ (for dashboard features)

## Quick Start

```bash
# View current truth scores
npx claude-flow@alpha truth

# Run verification check
npx claude-flow@alpha verify check

# Verify specific file with custom threshold
npx claude-flow@alpha verify check --file src/app.js --threshold 0.98

# Rollback last failed verification
npx claude-flow@alpha verify rollback --last-good
```

---

## Complete Guide

### Truth Scoring System

#### View Truth Metrics

Display comprehensive quality and reliability metrics for your codebase and agent tasks.

**Basic Usage:**
```bash
# View current truth scores (default: table format)
npx claude-flow@alpha truth

# View scores for specific time period
npx claude-flow@alpha truth --period 7d

# View scores for specific agent
npx claude-flow@alpha truth --agent coder --period 24h

# Find files/tasks below threshold
npx claude-flow@alpha truth --threshold 0.8
```

**Output Formats:**
```bash
# Table format (default)
npx claude-flow@alpha truth --format table

# JSON for programmatic access
npx claude-flow@alpha truth --format json

# CSV for spreadsheet analysis
npx claude-flow@alpha truth --format csv

# HTML report with visualizations
npx claude-flow@alpha truth --format html --export report.html
```

#### Truth Score Dashboard

Example dashboard output:
```
Truth Metrics Dashboard

Overall Truth Score: 0.947
Trend: +2.3% (7d)

Top Performers:
  verification-agent   0.982
  code-analyzer       0.971
  test-generator      0.958

Needs Attention:
  refactor-agent      0.821
  docs-generator      0.794
```

#### Metrics Explained

**Truth Scores (0.0-1.0):**
- `1.0-0.95`: Excellent (production-ready)
- `0.94-0.85`: Good (acceptable quality)
- `0.84-0.75`: Warning (needs attention)
- `<0.75`: Critical (requires immediate action)

### Verification Checks

#### Run Verification

Execute comprehensive verification checks on code, tasks, or agent outputs.

**File Verification:**
```bash
# Verify single file
npx claude-flow@alpha verify check --file src/app.js

# Verify directory recursively
npx claude-flow@alpha verify check --directory src/

# Verify with auto-fix enabled
npx claude-flow@alpha verify check --file src/utils.js --auto-fix
```

#### Verification Criteria

The verification system evaluates:

1. **Code Correctness** — Syntax validation, type checking, logic flow analysis, error handling completeness
2. **Best Practices** — Code style adherence, SOLID principles, design patterns usage, modularity and reusability
3. **Security** — Vulnerability scanning, secret detection, input validation, authentication/authorization checks
4. **Performance** — Algorithmic complexity, memory usage patterns, database query optimization, bundle size impact
5. **Documentation** — JSDoc/TypeDoc completeness, README accuracy, API documentation, code comments quality

### Automatic Rollback

```bash
# Rollback to last known good state
npx claude-flow@alpha verify rollback --last-good

# Rollback only failed files (preserve good changes)
npx claude-flow@alpha verify rollback --selective

# Dry-run mode (preview without executing)
npx claude-flow@alpha verify rollback --dry-run
```

### Configuration

Set verification preferences in `.claude-flow/config.json`:

```json
{
  "verification": {
    "threshold": 0.95,
    "autoRollback": true,
    "gitIntegration": true,
    "checks": {
      "codeCorrectness": true,
      "security": true,
      "performance": true,
      "documentation": true,
      "bestPractices": true
    }
  }
}
```

### CI/CD Integration

**GitHub Actions:**
```yaml
name: Quality Verification
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Verification
        run: npx claude-flow@alpha verify check --json > verification.json
      - name: Check Truth Score
        run: |
          score=$(jq '.overallScore' verification.json)
          if (( $(echo "$score < 0.95" | bc -l) )); then
            echo "Truth score too low: $score"
            exit 1
          fi
```

### Best Practices

1. **Set Appropriate Thresholds**: Use 0.99 for critical code, 0.95 for standard, 0.90 for experimental
2. **Enable Auto-rollback**: Prevent bad code from persisting
3. **Monitor Trends**: Track improvement over time, not just current scores
4. **Integrate with CI/CD**: Make verification part of your pipeline
5. **Use Watch Mode**: Get immediate feedback during development
