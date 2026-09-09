# Design Workflow — Designer Guide

> For the engineering setup details, see `bridge-ds/knowledge-base/guides/design-system.md`.
> This guide is for **designers** who want to create and sync designs using Claude Code.

---

## How it works

Claude Code connects to your Figma account via the official **Figma MCP** (a secure OAuth integration maintained by Figma/Anthropic). Once connected, Claude can read from and write to any Figma file you have access to — creating components, setting design tokens, building screens — all from a chat prompt.

No plugins. No bridge. No Desktop app required.

```
You (Claude Code prompt)
        ↓
  figma-remote-mcp  (OAuth — Figma's official cloud API)
        ↓
  Your Figma file  (browser or desktop, doesn't matter)
```

---

## One-time setup (per machine, ~3 minutes)

### Step 1 — Connect Figma via OAuth (for design creation)

1. Open Claude Code in the project folder
2. Type `/mcp` and press Enter
3. A dialog appears listing available MCP servers
4. Find **Figma** in the list (it may appear as "Figma" or "figma-remote-mcp") → click **Connect**
5. A browser window opens → log in with your Figma account → Authorize
6. Return to Claude Code — you'll see Figma listed as connected

This covers Agent 28 (Code → Figma canvas) and all `make`, `fix`, `setup` commands.

---

### Step 2 — Add your Figma API token (for Figma → code sync)

Agent 27 (Figma → code) reads component definitions from Figma via REST API and needs a personal access token stored in your global Claude Code settings.

**Get your token:**
1. Go to [figma.com](https://figma.com) → click your profile avatar → **Settings**
2. Go to **Security** → scroll to **Personal access tokens**
3. Click **Generate new token** → give it a name (e.g. `claude-code`) → copy it

**Store it globally** (never in the repo):

Open `~/.claude/settings.json` (create it if it doesn't exist) and add:

```json
{
  "env": {
    "FIGMA_API_TOKEN": "figd_your_token_here"
  }
}
```

If the file already has other settings, just add `FIGMA_API_TOKEN` inside the existing `"env"` block.

This token is picked up automatically by the `figma` MCP server configured in `.mcp.json`. It never touches the repository.

---

Both steps persist across sessions. You won't need to repeat them on this machine.

---

## Daily usage

### Check connection

```
/design-workflow status
```

Shows: who you're authenticated as, which Figma file is active, how populated the knowledge base is.

---

### Design something new

```
/design-workflow make a login screen with email input, password input, and a primary login button
```

Claude will:
1. Parse your description into components and layout
2. Map to the project's design tokens (colors, spacing, typography)
3. Create the design directly in your Figma file
4. Take a screenshot and show you the result in chat
5. Ask for feedback → iterate if needed

**Expected output in chat:**
```
✓ Frame created: "LoginScreen" (node: 42:18)
[screenshot preview]
Looks good? Reply with feedback or run /design-workflow done to archive.
```

---

### Iterate on the output

If the design needs corrections after `make`:

```
/design-workflow fix
```

Describe what's wrong (e.g. "the button padding is too tight" or "wrong background color on the card"). Claude reads the current Figma state, applies corrections, and updates the recipe library so future designs are better.

---

### Archive a finished design

```
/design-workflow done
```

Moves the spec to `bridge-ds/specs/shipped/`, extracts reusable patterns into the recipe library, and logs learnings so future designs are smarter.

---

### Sync Figma → code

```
/design-workflow scan
File: <your-figma-file-url>
Component: all
```

Audits which Figma components already have React counterparts and which are missing or drifted.

```
/design-workflow build
File: <your-figma-file-url>
Component: Button
```

Creates a React component from a Figma component that doesn't exist in the codebase yet.

```
/design-workflow sync
File: <your-figma-file-url>
Component: Button
```

Updates an existing React component whose values have drifted from what's in Figma (e.g. spacing or color changed in Figma but not in code). Stops for confirmation before each update.

---

## What file does Claude write to?

The active Figma file is set in `bridge-ds/knowledge-base/guides/design-system.md`. The value there may change as the project evolves — check it if Claude writes to the wrong file.

To work in a specific file, pass the URL directly in your command:

```
/design-workflow make a button — File: https://figma.com/design/<your-file-id>/...
```

---

## Design tokens used

Claude always uses the project's design tokens — never hardcoded colors. Tokens live in `` and are mirrored in `bridge-ds/knowledge-base/registries/variables.json`.

Refer to `` for the full list of available tokens (colors, spacing, typography, radius).

---

## Troubleshooting

**"Figma MCP: NOT CONNECTED"**
→ Type `/mcp` and reconnect Figma. Your OAuth session may have expired.

**"No active Figma file"**
→ Include the Figma file URL in your command, e.g.:
`/design-workflow make a button — File: https://figma.com/design/<your-file-id>/...`

**Design looks wrong / token values off**
→ Run `/design-workflow fix` — describe what's wrong and Claude will correct and learn from it.

**Want to start over on a design**
→ Run `/design-workflow drop` — archives it with a note, no Figma changes.

---

## What you don't need

| Was previously needed | Status |
|---|---|
| Figma Desktop Bridge plugin | Not needed |
| WebSocket bridge running in terminal | Not needed |
| Figma Desktop app open | Not needed (browser is fine) |
| Any npm install for Figma tooling | Not needed |
