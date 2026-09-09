# SonarCloud Commands

Commands for integrating SonarCloud code analysis into your workflow.

## Available Commands

| Command | Description |
|---------|-------------|
| `/sonarcloud:analyze-and-fix` | Analyze project and fix identified issues |

## Setup

### 1. Configure Environment Variables

```bash
export SONARCLOUD_TOKEN="your-token-here"
export SONARCLOUD_ORG="your-organization-key"
```

### 2. Verify MCP Configuration

Check `.mcp.json` contains:

```json
{
  "mcpServers": {
    "sonarcloud": {
      "command": "npx",
      "args": ["-y", "sonarqube-mcp-server@latest"],
      "env": {
        "SONARQUBE_URL": "https://sonarcloud.io",
        "SONARQUBE_TOKEN": "${SONARCLOUD_TOKEN}",
        "SONARQUBE_ORGANIZATION": "${SONARCLOUD_ORG}"
      }
    }
  }
}
```

### 3. Test Connection

After starting Claude Code, verify connection:

```
mcp__sonarcloud__ping_system
```

## Usage in Agentic Flow

### End-of-Task Analysis

Add to your workflow hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [{
          "type": "skill",
          "skill": "sonarcloud-analysis"
        }]
      }
    ]
  }
}
```

### Manual Invocation

```
/sonarcloud:analyze-and-fix --severity CRITICAL
```

## Related

- [SonarCloud Analysis Skill](../../skills/sonarcloud-analysis/SKILL.md)
- [Hooks Automation](../../skills/hooks-automation/SKILL.md)
