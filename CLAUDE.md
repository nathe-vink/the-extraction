# the-extraction — Claude Operating Context

## Commit Convention

Every commit must follow this exact format:

```
git add <changed-files>
git commit -m "<type>: <concise description>

Signed-off-by: nathe-vink <nathe.vink@gmail.com>"
git push -u origin $BRANCH_NAME
```

- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- **Every commit MUST include:** `Signed-off-by: nathe-vink <nathe.vink@gmail.com>` — no exceptions, no PRs without it
- Do **not** add `Co-Authored-By` trailers — Vercel deployment protection blocks PRs with unknown co-authors
- Always use a feature branch; never push directly to `main`

## Before Opening a PR — Rewrite Commit Author (MANDATORY)

**Claude must always run this before creating any PR, without being asked.** All commits on the branch must be authored as `nathe-vink <nathe.vink@gmail.com>` before merging.

**Single commit:**
```
git commit --amend --author="nathe-vink <nathe.vink@gmail.com>" --no-edit
git push origin <branch> --force
```

**Multiple commits (full branch history from main):**
```
git stash  # if there are unstaged changes
git rebase main --exec 'git commit --amend --author="nathe-vink <nathe.vink@gmail.com>" --no-edit'
git push origin <branch> --force
git stash pop  # if stashed
```

Note: do NOT use `--reset-author` together with `--author` — they conflict.

Do this on every branch before creating a PR — no exceptions.
