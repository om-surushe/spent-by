<div align="center">

# Spent by Om

**A private, manual expense tracker.**

[![CI](https://github.com/om-surushe/spent-by/actions/workflows/check.yml/badge.svg)](https://github.com/om-surushe/spent-by/actions/workflows/check.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live app](https://img.shields.io/badge/live%20app-spent--by.om--surushe.workers.dev-brightgreen)](https://spent-by.om-surushe.workers.dev)

[Open Spent by Om](https://spent-by.om-surushe.workers.dev)

</div>

Spent by Om is an offline-first PWA for recording what you spend, without bank connections, income feeds, or account aggregation. It is designed for a simple daily habit: add an expense, review the month, and keep the data private.

## How it works

[![Expense lifecycle diagram](docs/diagrams/money-data-flow.svg)](docs/diagrams/money-data-flow.excalidraw)

An expense stays on your device first. It is encrypted before optional cloud sync, and remains readable in the ledger while offline.

[![Private cloud sync diagram](docs/diagrams/worker-sync-boundary.svg)](docs/diagrams/worker-sync-boundary.excalidraw)

The Worker only verifies and stores encrypted records; it never receives the recovery phrase or plaintext expense data.

## Highlights

- **Fast manual entry** — calculator keypad, presets, date, category, account, payment source, and optional notes.
- **Expense-focused overview** — monthly totals, budget categories, search, filters, ledger review, and export/import.
- **Private by default** — data is encrypted in the browser before optional cloud sync; the server never receives the recovery phrase or plaintext records.
- **Local-first** — IndexedDB keeps the app usable offline. Cloud sync is optional and can run immediately or on a chosen interval.
- **Recovery-ready** — copy or download the recovery phrase to restore the encrypted vault on another device.
- **Installable** — works as a responsive PWA on desktop and mobile.

## Intentionally not included

No bank connections, income tracking, shared accounts, subscriptions, or ad-tech. This is a personal record of expenses you enter yourself.

## Run locally

Requires Node.js 20 or later.

```bash
git clone https://github.com/om-surushe/spent-by.git
cd spent-by/next-app
npm ci
npm run dev
```

Validate a change with:

```bash
npm test
npm run build
npm run standards:check
npm run check:responsive
npm run worker:check
```

## Architecture maps

Open the [Excalidraw architecture diagrams](docs/diagrams/README.md) for the vault, expense, dashboard, sync, and deployment flows.

## Deployment

The deployed application and Cloudflare Worker live in [`next-app/`](next-app/).

- Pull requests and pushes to `main` run validation.
- Preview and production deployments are manual GitHub Actions workflows.
- Production: [spent-by.om-surushe.workers.dev](https://spent-by.om-surushe.workers.dev)

The repository root includes an earlier Node/SQLite prototype for reference; it is not deployed.

## Security

The recovery phrase is the only way to restore an encrypted vault. Keep it private and backed up; do not commit financial exports, recovery phrases, credentials, local databases, or Cloudflare tokens.

See [SECURITY.md](SECURITY.md) for reporting guidance.

## License

[MIT](LICENSE) © Om Surushe
