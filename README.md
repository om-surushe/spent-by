# TransactionsApp

Private personal-finance tracker that works in two modes:

- open `index.html` directly for browser-local storage;
- run the Node 22 server for SQLite persistence, login protection, and JSON APIs.

The repository contains only sanitized sample data. Real exports, financial profiles, review queues, SQLite files, and credentials must stay outside Git.

## Features

- manual transaction entry and bulk JSON import;
- category and subcategory summaries;
- review flags for unclear transactions;
- JSON export for private backups;
- localStorage when opened directly;
- SQLite persistence when served by Node.

## Local use

Requires Node.js 22.5 or newer for `node:sqlite`.

```bash
npm start
```

Open `http://localhost:3000`. Local development allows authentication to be omitted. To test login locally:

```bash
cp .env.example .env
set -a; . ./.env; set +a
npm start
```

You can also open `index.html` directly without the server. That mode stores data only in the current browser profile.

## Production requirements

Production fails closed unless all three values are configured:

```text
AUTH_USERNAME
AUTH_PASSWORD
SESSION_SECRET
```

Use a long random session secret and store all values outside Git. The Docker image sets `NODE_ENV=production`, so incomplete authentication prevents startup rather than exposing financial data.

SQLite data defaults to `data/finance-tracker.sqlite`. Use persistent storage for `data/`, and back it up separately.

## Data import

Import a JSON array following [`data-format.md`](data-format.md). [`sample-data.json`](sample-data.json) is the only tracked fixture.

Real data files are ignored, including:

```text
*-expenses.json
financial-profile-*.json
review-queue.json
```

Export private data regularly and store it in a location with appropriate filesystem permissions and backups.

## Validation

```bash
npm run check
```

This checks server syntax, authentication behavior, and the sample JSON fixture without installing dependencies.

## Deployment

The GitHub Actions deployment workflow copies application code and sanitized fixtures to the configured private VM. It does not upload personal financial exports. The deployment script removes stale tracked-export filenames before rebuilding the container while preserving the SQLite volume.

Required GitHub Actions secrets:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`

Keep the repository private. No license has been selected.
