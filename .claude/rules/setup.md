# Setup Guide

## Prerequisites

- Node.js >= 18
- PNPM package manager
- Claude Code CLI installed
- GitHub CLI (`gh`) authenticated

## 1. Environment Variables

Add these to your shell profile (`~/.zshrc`, `~/.bashrc`) or a local `.env` file:

### Azure DevOps (required for FEATURE and ISSUE pipelines)

```bash
export AZURE_DEVOPS_ORG_URL=""
export AZURE_DEVOPS_PAT="<your-personal-access-token>"
```

**How to create a PAT:**
1. Go to `/_usersettings/tokens`
2. Click **New Token**
3. Name: `claude-mcp` (or any name)
4. Scopes required:
   - **Work Items** → Read (minimum)
   - **Work Items** → Read & Write (if you want agents to update work items)
   - **Project and Team** → Read
5. Click **Create**, copy the token immediately (it won't be shown again)

### SonarCloud (required for SONARCLOUD agent and Quality Gate)

```bash
export SONARCLOUD_TOKEN="<your-sonarcloud-token>"
export SONARCLOUD_ORG="<your-sonarcloud-organization>"
```

**How to create a SonarCloud token:**
1. Go to `https://sonarcloud.io/account/security`
2. Generate a new token
3. Copy the token value

## 2. MCP Servers

MCP servers are configured in `.mcp.json`:

| Server | Package | Purpose |
|--------|---------|---------|
| `claude-flow` | `@claude-flow/cli@latest` | Multi-agent orchestration, memory, swarm coordination |
| `azure-devops` | `@anthropic/azure-devops-mcp@latest` | Azure DevOps work item access (features, bugs, issues) |
| `sonarcloud` | `sonarqube-mcp-server@latest` | Code quality analysis, issue detection, metrics |

Servers are auto-installed via `npx` on first use. No manual install needed.

### Enabled servers

Configured in `.claude/settings.local.json` under `enabledMcpjsonServers`:
```json
["claude-flow", "sonarcloud", "azure-devops"]
```

### Verify MCP servers are working

After setting environment variables, restart Claude Code and check that tools are available:
- Azure DevOps: try `mcp__azure-devops__mcp_ado_core_list_projects`
- SonarCloud: try `mcp__sonarcloud__system_ping`

## 3. Azure DevOps MCP — Available Tools

Source: [github.com/microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp)

### Work Items (used by ado-feature-briefing, ado-issue-intake)

| Tool | Description |
|------|-------------|
| `mcp__azure-devops__mcp_ado_wit_get_work_item` | Get a work item by ID |
| `mcp__azure-devops__mcp_ado_wit_list_work_item_comments` | List comments on a work item |
| `mcp__azure-devops__mcp_ado_wit_my_work_items` | List work items assigned to current user |
| `mcp__azure-devops__mcp_ado_wit_get_work_items_for_iteration` | Get work items in a sprint |
| `mcp__azure-devops__mcp_ado_search_workitem` | Search work items by text |
| `mcp__azure-devops__mcp_ado_wit_update_work_item` | Update work item fields |
| `mcp__azure-devops__mcp_ado_wit_add_work_item_comment` | Add a comment to a work item |

### Other categories

| Category | Example tools |
|----------|---------------|
| Core | `mcp_ado_core_list_projects`, `mcp_ado_core_list_project_teams` |
| Repositories | `mcp_ado_repo_list_repos_by_project`, `mcp_ado_repo_create_pull_request` |
| Pipelines | `mcp_ado_pipelines_get_builds`, `mcp_ado_pipelines_run_pipeline` |
| Search | `mcp_ado_search_code`, `mcp_ado_search_workitem` |
| Test Plans | `mcp_ado_testplan_list_test_plans`, `mcp_ado_testplan_create_test_case` |

Full toolset: [TOOLSET.md](https://github.com/microsoft/azure-devops-mcp/blob/main/docs/TOOLSET.md)

## 4. Git Workflow

The ORCHESTRATOR enforces a worktree-based workflow:

1. If you activate ORCHESTRATOR on `main`, it creates a git worktree and asks you to switch
2. All feature/issue work happens on branches: `users//<feature-name>`
3. After the Quality Gate passes, push to trigger the CI/CD pipeline

No manual branch management needed — the ORCHESTRATOR handles it.

## 5. Project Structure

```
/
├── .mcp.json                          ← MCP server config
├── .claude/
│   ├── settings.json                  ← Global Claude Code settings (hooks, permissions)
│   └── settings.local.json            ← Local overrides (enabled MCP servers)
│   ├── rules/
│   │   └── agent-manual.md            ← Agent manual (index, pipelines)
│   └── agents/
│       ├── _base-core.md                   ← Universal rules (all agents)
│       ├── _base-impl.md              ← Implementation rules
│       ├── _base-test.md              ← Testing rules
│       ├── _base-spec.md              ← Specification rules
│       ├── _base-design.md            ← Design rules
│       ├── _refs.md                   ← Shared file paths
│       ├── orchestrator.md            ← Pipeline coordinator
│       ├── critical-thinker.md        ← Challenge reasoning
│       ├── backend.md                 ← NestJS implementation
│       ├── monorepo-architect.md      ← Architecture enforcement
│       ├── frontend.md                ← React implementation
│       └── ...                        ← Other agents
├── apps/
├── packages/
│   ├── back/
│   ├── front/
│   └── common/
└── documentation//
    ├── documentation/architecture.md
    ├── documentation/design-guidelines//
    └── <app>/technical-specification/   ← Tech specs per app
```

## 6. Pipelines Overview

### When to use each pipeline

| Pipeline | Use when... | Input | Produces code? |
|----------|-------------|-------|----------------|
| **FEATURE** | You have a feature card or user story in ADO and want the agents to build it end-to-end | ADO work item ID (Feature/User Story) | Yes |
| **ISSUE** | You have a bug or issue in ADO and want the agents to analyze and fix it | ADO work item ID (Bug/Issue) | Yes |
| **UX** | You have a screenshot or mockup of a bad UX and want the agents to redesign and implement it | Screenshot or mockup image | Yes |
| **SPEC** | You have a written functional spec (not in ADO) and want the agents to turn it into code | Functional spec document path | Yes |
| **FRONTEND-ONLY** | You have a technical spec and only need frontend implementation | Technical spec document path | Yes (FE only) |
| **BACKEND-ONLY** | You have a technical spec and only need backend implementation | Technical spec document path | Yes (BE only) |
| **PUSH** | You already wrote code manually and want agents to validate it, add tests, update docs, and push | Existing code changes on a branch | No — validates and pushes your code |
| **PR-REVIEW** | You want the agents to review an existing PR (yours or a colleague's) | PR number | No — read-only review |
| **DOC-TO-ADO** | You have documentation for an app and want to generate ADO work items from it | App name + docs path | No — creates ADO items only |
| **IDEATION** | You want to explore a new feature idea before committing to building it | Feature description (free text) | Yes — brainstorm produces Feature Breakdown, each feature gets its own pipeline via DAG executor |

### Pipeline steps

The canonical, up-to-date step sequences for every pipeline — including WAVE-CHECK, the `edge-case-adversary` gates, and MEMORY-CHECK — live in the **Predefined Pipelines** section of [`agent-manual.md`](agent-manual.md#predefined-pipelines). That table is the single source of truth; this guide intentionally does not duplicate it to avoid drift.

**QG** = Quality Gate: `github:code-review` → `verification-quality` → `v3-security-overhaul`

**CREATE-PR** = Push branch + create/update PR with ADO links, impacted apps, QG results.

## 7. Quick Start

### Feature development
```
Activate ORCHESTRATOR
Task: Implement feature card #1234 from ADO project 
Mode: AUTO
```

### Issue resolution
```
Activate ORCHESTRATOR
Task: Fix issue #5678 from ADO project 
Mode: STEP
```

### Direct agent activation
```
Activate FRONTEND
```

## 8. Troubleshooting

| Problem | Solution |
|---------|----------|
| MCP server not connecting | Check env vars are exported, restart Claude Code |
| ADO tools not found | Verify `azure-devops` is in `enabledMcpjsonServers` in `.claude/settings.local.json` |
| PAT expired | Generate a new token at `/_usersettings/tokens` |
| SonarCloud auth error | Regenerate token at `https://sonarcloud.io/account/security` |
| Pipeline blocked on main | ORCHESTRATOR requires a feature branch — follow the worktree instructions |
| Agent not activating | Check exact name spelling — activation is case-sensitive |
