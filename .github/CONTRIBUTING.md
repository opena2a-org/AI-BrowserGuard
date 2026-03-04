# Contributing

## Development workflow

All changes to `main` must go through a pull request. Branch protection requires:
- 1 approving review
- `Build`, `Test`, and `Lint` status checks passing
- Branch up to date with `main` before merge

```bash
git checkout -b feat/short-description   # always branch from main
# ... make changes ...
npm run build && npm test                 # verify locally before opening PR
git push -u origin feat/short-description
gh pr create --title "..." --body "..."  # open PR; Claude review posts automatically
```

Squash-merge all PRs. Do not use regular merge commits.

## Parallel agent worktrees

When using worktree-isolated subagents, merge each branch with `--squash` to
keep a linear history on `main`:

```bash
git merge --squash worktree-agent-<id>
git commit -m "Descriptive summary of agent work"
git branch -d worktree-agent-<id>
```

Do **not** use a bare `git merge` — it creates a merge commit that cannot be
removed after push (force pushes are disabled on `main`).

## CI

Three jobs run on every PR and on direct pushes to `main` (path-filtered to
`src/**`, config files):

| Job | Command |
|-----|---------|
| Build | `npm run build` |
| Test | `npm test` |
| Lint | `npm run lint` (tsc --noEmit --strict) |

The security workflow (`security.yml`) runs dependency audits and SAST on PRs,
pushes to `main`, and weekly on a schedule.

## Known backlog items

These are deferred, not forgotten:

### Kill switch keyboard shortcut UI hint
The manifest declares `Ctrl+Shift+K` / `Cmd+Shift+K` as the kill switch
shortcut (`commands._execute_action` equivalent via `commands` key), but the
popup does not display this shortcut anywhere. Add a small label near the Kill
Switch button:

```
Kill Switch  [⌘⇧K]
```

File to edit: `src/popup/popup.ts` — `renderKillSwitchPanel()` button row.

### Session storage cap
`chrome.storage.local` holds all `AgentSession[]` without a hard cap. The
architecture comment says "last 5 sessions" but this is not enforced. Add a
trim after every `saveSession()` call:

```typescript
// In src/session/storage.ts, after saving:
const all = await getSessions();
if (all.length > 5) {
  await chrome.storage.local.set({ sessions: all.slice(-5) });
}
```

### Merge commit in history (cosmetic, irrecoverable)
Commit `b37363c` is a merge commit from a parallel worktree session. Force
pushes are disabled, so it cannot be removed. The history between `cec127f`
and `5fb329d` is non-linear as a result. No functional impact.

Going forward, use `--squash` when merging worktree branches (see above).
