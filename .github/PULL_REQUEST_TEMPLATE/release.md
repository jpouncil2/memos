## Release: `develop` -> `main`

### Summary

Describe what is being promoted from staging to production.

### Scope

- Included features/fixes:
- Explicitly excluded items:

### Staging Evidence (required)

- [ ] Staging environment is on `develop` (or `ghcr.io/<owner>/memos:develop`)
- [ ] Smoke tests passed on staging
- [ ] Key user flows validated (auth, memo create/edit, attachments/library, boards/agents as applicable)
- [ ] No critical errors in staging logs

Evidence links/screenshots:

- CI run:
- Staging deploy:
- Screenshots/log snippets:

### Production Deployment Plan (required)

- [ ] Promote from `main` only after this PR merges
- [ ] Use immutable image tag (`sha-*`) for production deploy
- [ ] Confirm production environment variables are correct (`MEMOS_DSN`, driver, port, domain)
- [ ] Confirm rollback target image tag is ready

Production image tag to deploy:

Rollback image tag:

### Risk & Rollback

- Risk level: `low` / `medium` / `high`
- Known risks:
- Rollback trigger:
- Rollback steps:
  1. Redeploy rollback image tag in production.
  2. Verify `/healthz` and core flows.
  3. Confirm error rate returns to baseline.

### Post-Deploy Verification (required)

- [ ] `GET /healthz` returns 200
- [ ] Sign-in works
- [ ] Memo create/edit works
- [ ] Library (audio/PDF) works
- [ ] No spike in 4xx/5xx for critical endpoints

### Approvals

- [ ] Product/owner approval
- [ ] Engineering approval
