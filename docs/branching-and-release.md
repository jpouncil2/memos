# Branching and Release Strategy

This repository uses two long-lived branches:

- `develop`: staging branch
- `main`: production branch

## Flow

1. Create feature branches from `develop`.
2. Open PRs into `develop` for integration and staging validation.
3. When staging is ready, open a release PR from `develop` to `main`.
4. Merge to `main` only after checks pass and release is approved.

## CI Image Publishing

- Push to `develop` publishes `ghcr.io/<owner>/memos:develop` and `sha-*` tags.
- Push to `main` publishes `ghcr.io/<owner>/memos:main` and `sha-*` tags.

Workflows:

- `.github/workflows/publish-ghcr-develop.yml`
- `.github/workflows/publish-ghcr-main.yml`

## Railway Mapping

- Staging environment should deploy from `ghcr.io/<owner>/memos:develop` (or a pinned `sha-*` tag).
- Production environment should deploy from `ghcr.io/<owner>/memos:main` (or a pinned `sha-*` tag).

For deterministic promotion, deploy immutable `sha-*` tags in both environments.

## Branch Protection (GitHub Settings)

Apply protection on both `develop` and `main`:

- Require pull requests before merging
- Require status checks to pass
- Require at least one approval
- Restrict direct pushes
- Include administrators

Recommended checks:

- backend tests
- frontend tests
- lints/static checks
