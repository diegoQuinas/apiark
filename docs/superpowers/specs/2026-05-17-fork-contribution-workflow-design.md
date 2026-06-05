# Fork Contribution Workflow — ApiArk

**Date:** 2026-05-17
**Context:** `diegoQuinas/apiark` is an active fork of `berbicanes/apiark`. Upstream maintainer has been inactive for ~2 months. Goal is to contribute upstream via PRs while keeping the fork as a functional daily driver.

---

## Strategy: Fork as daily driver + PRs upstream

Maintain the fork as a working tool with all needed changes. Open PRs upstream only for changes with community value. Personal improvements stay fork-only. Never blocked waiting for upstream to merge.

---

## Branch Strategy

```
upstream/main  →  origin/main  →  fix/issue-123      (PR upstream + merge fork)
                                 →  feat/issue-456     (PR upstream + merge fork)
                                 →  personal/my-thing  (fork only, no PR)
```

**Naming rules:**
- `fix/<description>` or `fix/<issue-number>-<description>` — bug fixes, candidates for upstream PR
- `feat/<description>` or `feat/<issue-number>-<description>` — features, candidates for upstream PR
- `personal/<description>` or `chore/<description>` — fork-only, never open as upstream PR

**Sync cadence:** Run `git fetch upstream && git rebase upstream/main` before starting any new work to minimize divergence and future conflicts.

---

## Change Classification

| Category | Criterion | Destination |
|---|---|---|
| Bug fix from issue | There is an open upstream issue | PR upstream + fork |
| Community feature request | Issue exists with 👍 or comments | PR upstream + fork |
| Own improvement | No upstream issue exists | Open issue first, then PR + fork |
| Personal/workflow | Very specific to personal setup | Fork only |

For own improvements: open an upstream issue describing the problem/need first, wait ~24-48h for feedback, then open the PR referencing that issue. This gives the PR context and makes it reviewable.

---

## Priority Order

1. **Bugs that block daily work** — fix what hurts now
2. **Upstream issues with most 👍 / comments** — high community impact, better chances of merge when maintainer returns
3. **Wanted features, not urgent** — implement when time allows, open issue first
4. **Code quality / refactors** — last priority, only if needed to implement something above

---

## PR Guidelines

- One PR per fix or feature — no bundling unrelated changes
- Reference the upstream issue: `Fixes berbicanes/apiark#123`
- Use conventional commits: `fix:`, `feat:`, `chore:`, `refactor:`
- Write a clear PR description with: what changed, why, how to test
- After opening the PR, merge the branch into your own fork's `main` regardless of upstream response

---

## Initial Action: Upstream Issue Triage

Before writing any code, do a pass through `berbicanes/apiark` open issues:
- Which ones affect your daily work?
- Which ones have the most community traction (👍, comments)?
- Which ones do you already know how to fix?

This triage becomes the backlog for implementation.
