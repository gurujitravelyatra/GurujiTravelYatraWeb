# SonarCloud Analyze and Fix

Analyze the project with SonarCloud and fix identified issues.

## Usage

```
/sonarcloud:analyze-and-fix [options]
```

## Options

- `--severity <level>` - Minimum severity to fix (BLOCKER, CRITICAL, MAJOR, MINOR, INFO)
- `--types <types>` - Issue types to fix (BUG, VULNERABILITY, CODE_SMELL)
- `--limit <n>` - Maximum number of issues to fix
- `--dry-run` - Analyze only, don't apply fixes

## Workflow

When this command is invoked:

1. **Connect to SonarCloud**
   - Verify MCP connection with ping
   - Get project key from configuration

2. **Fetch Issues**
   - Query open/confirmed issues
   - Filter by severity and type
   - Sort by priority (BLOCKER > CRITICAL > MAJOR)

3. **Analyze Each Issue**
   - Read affected source file
   - Understand issue context
   - Determine fix strategy

4. **Apply Fixes**
   - Edit files to resolve issues
   - Run related tests
   - Store changes in memory

5. **Find Duplications**
   - Identify duplicated code blocks
   - Extract to shared utilities
   - Update all references

6. **Verify Quality Gate**
   - Check quality gate status
   - Report improvements

7. **Generate Report**
   - Issues fixed
   - Issues remaining
   - Quality metrics

## Example

```
User: /sonarcloud:analyze-and-fix --severity MAJOR --limit 10

Claude:
1. Connecting to SonarCloud... OK
2. Found 15 issues (MAJOR+)
3. Processing top 10 issues...
   - BUG: Null pointer in auth.ts:42 -> Fixed
   - CODE_SMELL: Long method in api.ts:156 -> Refactored
   ...
4. Quality Gate: PASSED
5. Summary: 8/10 issues fixed, 2 need manual review
```

## Prerequisites

Ensure these environment variables are set:
- `SONARCLOUD_TOKEN` - Your SonarCloud API token
- `SONARCLOUD_ORG` - Your organization key

And `.mcp.json` has the sonarcloud server configured.
