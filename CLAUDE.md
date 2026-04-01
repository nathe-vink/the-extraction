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
- The `Signed-off-by` trailer is **required** on every commit — the repo owner's GitHub account is `nathe-vink`
- Do **not** add `Co-Authored-By` trailers — Vercel deployment protection blocks PRs with unknown co-authors
- Always use a feature branch; never push directly to `main`
