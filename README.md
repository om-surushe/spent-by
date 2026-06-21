# Finance Tracker

A simple, offline personal expense tracker. Log transactions manually or upload JSON, get instant category breakdown and analysis.

## Features

- **Manual entry** – Add expenses one at a time
- **Bulk upload** – Paste JSON array for batch processing
- **Category tracking** – Needs, Wants, Family, Miscellaneous
- **Live analysis** – See spending by category in real-time
- **Export** – Download all data as JSON for backup
- **Offline-first** – All processing in browser; no backend needed
- **No dependencies** – Pure HTML/CSS/JS; runs anywhere
- **Simple** – No split tracking complexity, just log your personal share

## Quick Start

1. Open `index.html` in any modern browser
2. Add expenses manually OR paste JSON from `sample-data.json`
3. View analysis & export your data

## Run as Hosted App with Database

This project can also run as a small Node app with a SQLite database.

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

When opened through `http://localhost:3000`, transactions are saved to:

```text
data/finance-tracker.sqlite
```

When opened directly as `index.html`, the app still uses browser localStorage.

### Login

Set these environment variables to require login:

```bash
AUTH_USERNAME=your-username
AUTH_PASSWORD=change-this-password
SESSION_SECRET=generate-a-long-random-secret
```

If these are not set, auth is disabled for local development.

### Deploy Notes

- Host on a Node server such as Render, Railway, Fly.io, or a VPS.
- Use persistent disk storage for the `data/` folder.
- Set `PORT` if your host requires it.
- Optional: set `DATABASE_PATH` to control where the SQLite file is stored.
- Do not commit `.env.production`; keep it only on the server.

## VM Deployment

This repo includes Docker Compose and a GitHub Actions deploy workflow.

On the VM:

```bash
cd /home/ubuntu/finance-tracker
cp .env.example .env.production
nano .env.production
sudo docker compose up -d --build
```

GitHub repo secrets needed:

- `SSH_HOST`: `80.225.237.216`
- `SSH_USER`: `ubuntu`
- `SSH_PRIVATE_KEY`: private key that can SSH into the VM

On every push to `main`, GitHub Actions uploads the app files over SSH, then runs:

```bash
/home/ubuntu/finance-tracker/scripts/deploy.sh
```

## Data Format

Simple transaction structure:

```json
{
  "amount": 500,
  "reason": "Lunch",
  "date": "2026-06-10",
  "category": "Wants",
  "subcategory": "Eating Out",
  "payment_method": "Card",
  "notes": "",
  "needs_review": false,
  "review_reason": ""
}
```

### Fields

- `amount` (required) – Positive number in ₹
- `reason` (required) – What you spent on
- `date` (required) – YYYY-MM-DD format
- `category` (required) – One of: Needs, Wants, Family, Miscellaneous
- `subcategory` (optional) – Specific budget bucket inside the category
- `payment_method` (optional) – Card, UPI, Cash, Bank, Other
- `notes` (optional) – Context (e.g., "your share from split")
- `needs_review` (optional) – Use true for unclear transactions
- `review_reason` (optional) – Why the transaction needs review

See `data-format.md` for full details & examples.

## How to Use

### Add Manually
1. Fill Amount, Reason, Date, Category
2. Click "Add Expense"
3. Data saves automatically to browser

### Bulk Upload
1. Paste JSON array into upload box
2. Review any validation errors
3. Click "Upload"

### View Analysis
- See total spending by category
- Filter by category
- View all transactions with dates

### Export
- Click "Export as JSON" to download
- Use for backup or external analysis

## Project Files

```
finance-tracker/
├── README.md           (this file)
├── index.html          (the complete app)
├── data-format.md      (transaction format reference)
└── sample-data.json    (test data)
```

## Storage

- **Local Storage** – Data persists in your browser
- **No cloud** – Everything stays on your device
- **Export regularly** – Use export function to back up

## Browser Support

Works in all modern browsers:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## GitHub Setup

1. Create repo: `github.com/new`
2. Name it `finance-tracker`
3. Clone locally: `git clone <your-repo-url>`
4. Copy these 4 files into the folder
5. Push:
   ```bash
   git add .
   git commit -m "Initial commit: finance tracker"
   git push
   ```

## Using from GitHub

- Share the repo link with anyone
- Open `index.html` directly in browser (works with GitHub pages too)
- All data stays local; export to back up to Git

## Notes

- **For shared expenses:** Log only your personal share, add context in notes
  - Example: ₹900 split 3 ways = log ₹300 with note "Your share: split 3"
- **Recurring expenses:** Log each month or add notes to track
- **One-time expenses:** Use Miscellaneous category

## License

Public domain – use however you want.

---

**Next steps:**
1. Open `index.html` in browser
2. Try the sample data
3. Start tracking your expenses
