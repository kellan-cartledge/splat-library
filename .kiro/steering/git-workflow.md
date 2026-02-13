# Git Workflow Guidelines

## Branch Strategy

All changes must go through feature branches and pull requests. Direct pushes to `main` are blocked by repository rules.

### Workflow

1. **Create feature branch** from `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b <type>/<description>
   ```

2. **Make changes** and commit with sign-off

3. **Push branch** and create PR:
   ```bash
   git push -u origin <branch-name>
   gh pr create --base main
   ```

4. **Review and merge** via GitHub PR

### Branch Naming

Use prefixes:
- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `chore/` - Maintenance tasks

Examples:
- `feat/add-batch-processing`
- `fix/colmap-memory-leak`
- `docs/update-readme`

## Commit Messages

### Sign-off Required

All commits must include a sign-off line. Use the `-s` flag:

```bash
git commit -s -m "feat: add new feature"
```

This adds:
```
Signed-off-by: Kellan Cartledge <kdcartledge@gmail.com>
```

### Configure Git for Sign-off

```bash
git config user.name "Kellan Cartledge"
git config user.email "kdcartledge@gmail.com"
```

### Conventional Commits

Format: `<type>: <description>`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `chore` - Maintenance
- `test` - Tests

Examples:
```bash
git commit -s -m "feat: add delete scene endpoint"
git commit -s -m "fix: resolve CUDA kernel compilation error"
git commit -s -m "docs: update gsplat migration spec"
```

## Code Scanning

The repository has branch protection rules requiring code scanning to pass before merging. This is why direct pushes to `main` are blocked.

PRs allow:
- Code scanning to run on the branch
- Review before merging
- CI/CD checks to complete

## Quick Reference

```bash
# Start new work
git checkout main && git pull
git checkout -b feat/my-feature

# Commit with sign-off
git add -A
git commit -s -m "feat: description"

# Push and create PR
git push -u origin feat/my-feature
gh pr create --base main

# After PR merged, cleanup
git checkout main && git pull
git branch -d feat/my-feature
```
