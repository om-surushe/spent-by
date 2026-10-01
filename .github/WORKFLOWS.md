# GitHub Actions policy

This repository uses an intentional CI/CD model. A commit by itself should not spend compute.

## 1. Intentional Quality Gate

File: `.github/workflows/quality-gate.yml`

This is the single validation workflow. It has no push trigger and does not run automatically for every PR update.

### Run from the Actions tab

Choose **Intentional Quality Gate**, select a Git ref, then select one suite:

- `core` - Finance Vault worker type-check + application build.
- `legacy` - legacy application checks.
- `storybook` - build Storybook and validate component stories.
- `screenshots` - build Finance Vault and capture responsive screenshots at mobile, tablet, and desktop widths. Screenshots are uploaded as a 7-day artifact.
- `all` - run every suite.

### Run from a pull request

Apply one of these labels when a specific validation is useful:

- `run-quality-gate` - Finance Vault core validation.
- `run-legacy-checks` - legacy application checks.
- `run-storybook-checks` - Storybook build.
- `run-responsive-screenshots` - responsive screenshot artifact.

Adding ordinary commits, opening a draft PR, marking a PR ready, or merging does not automatically run these validation jobs.

## 2. Finance Vault preview deploy

File: `.github/workflows/deploy-preview.yml`

Trigger: manual only (`workflow_dispatch`).

Use this when a specific ref should be deployed to the Cloudflare preview environment. The workflow validates the worker and application before deployment because those checks are part of the intentional deploy action.

## 3. Legacy production deploy

File: `.github/workflows/deploy.yml`

Triggers:

- manual dispatch, or
- publishing a GitHub Release.

A normal push to `main` does not deploy production.

## Compute policy

- No validation should run merely because another commit was pushed.
- Use the lightest validation suite that answers the current question.
- Use `core` before merging meaningful Finance Vault logic changes.
- Use Storybook only when component/UI work needs it.
- Use responsive screenshots when layout or styling changes need visual review.
- Use `all` only for significant changes or before a release.
- Preview and production deployment remain explicit actions.
- Concurrent runs for the same ref/PR are cancelled when a newer intentional quality run replaces them.
