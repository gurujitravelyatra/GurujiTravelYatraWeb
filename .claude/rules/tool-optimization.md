# Tool Optimization Rules

## Mandatory Tool Selection

When searching, reading, or exploring files, ALWAYS use the dedicated tool — never Bash.

| Task | Correct Tool | Wrong (Bash) | Token Savings |
|------|-------------|-------------|---------------|
| Find files | `Glob("**/*.tsx")` | `find . -name "*.tsx"` | 5-10x |
| Search content | `Grep("pattern")` | `grep -r "pattern" .` | 10-20x |
| Read file | `Read(path)` | `cat path` | 2-5x |
| Read portion | `Read(path, offset=10, limit=20)` | `sed -n '10,30p' path` | 3-5x |
| List directory | `Glob("dir/*")` | `ls dir/` | 2-3x |
| Edit file | `Edit(path, old, new)` | `sed -i 's/old/new/' path` | 2x |
| Write file | `Write(path, content)` | `echo "..." > path` | 2x |
| Count matches | `Grep(pattern, output_mode="count")` | `grep -c "pattern" file` | 3x |
| File paths only | `Grep(pattern, output_mode="files_with_matches")` | `grep -rl "pattern" .` | 5x |

## Bash Is ONLY For

- `git` commands (status, diff, log, push, commit, branch, worktree)
- `pnpm` / `npm` (install, build, test, biome, lint)
- Running project scripts
- System operations (`mkdir`, `mv`, `rm`, `wc -l`)
- Commands that have no dedicated tool equivalent

## Why This Matters

Each Bash command returns raw unstructured text that consumes context window tokens.
Dedicated tools return structured, optimized output.

Example: `Bash(grep -r "somePattern" src/)` on a large codebase -> 500+ lines -> ~8K tokens.
Same query: `Grep("somePattern", path="src/", output_mode="files_with_matches")` -> 30 file paths -> ~500 tokens.

**16x difference** for the same information.

## In Subagents

Subagents inherit `_base-core.md` which enforces these rules. When dispatching a subagent, do NOT include Bash exploration commands in the prompt — the subagent should use dedicated tools to explore.

## Grep Optimization Tips

- Default to `output_mode: "files_with_matches"` — get file paths first, then Read specific files
- Use `head_limit` to cap results (default 250, reduce to 20-50 for exploratory searches)
- Use `glob` filter to narrow scope: `Grep("pattern", glob="*.tsx")` instead of searching everything
- Use `type` filter for known file types: `Grep("pattern", type="ts")`
- Use `-A`/`-B`/`-C` context lines only when you need surrounding code, not for discovery
