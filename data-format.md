# Transaction Data Format

Simple format for personal expenses only — no split tracking.

## Basic Transaction

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

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | Number | ✓ | Positive amount in ₹ (e.g., 500, 1250.50) |
| `reason` | String | ✓ | What you spent on (e.g., "Lunch", "Groceries") |
| `date` | String | ✓ | Date in YYYY-MM-DD format (e.g., "2026-06-10") |
| `category` | String | ✓ | One of: Needs, Wants, Family, Miscellaneous |
| `subcategory` | String | ✗ | More specific bucket inside the category |
| `payment_method` | String | ✗ | Card, UPI, Cash, Bank, or Other (default: Card) |
| `notes` | String | ✗ | Optional context (e.g., "your share of split") |
| `needs_review` | Boolean | ✗ | Marks transactions for review cards |
| `review_reason` | String | ✗ | Why the transaction needs review |

---

## Examples

### Personal expense
```json
{
  "amount": 500,
  "reason": "Coffee & pastry",
  "date": "2026-06-10",
  "category": "Wants",
  "payment_method": "UPI",
  "notes": ""
}
```

### Your share from a split (₹900 ÷ 3 = ₹300 per person)
```json
{
  "amount": 300,
  "reason": "Dinner",
  "date": "2026-06-10",
  "category": "Wants",
  "payment_method": "Card",
  "notes": "Your share: split 3 with Harsh, Arvi"
}
```
→ Log **only your portion**, not the full amount

### Home renovation
```json
{
  "amount": 60000,
  "reason": "Bathroom fitting",
  "date": "2026-05-15",
  "category": "Miscellaneous",
  "payment_method": "Bank",
  "notes": ""
}
```

### Family gifting
```json
{
  "amount": 5000,
  "reason": "Gift",
  "date": "2026-01-24",
  "category": "Family",
  "payment_method": "Card",
  "notes": ""
}
```

### Fixed monthly bill
```json
{
  "amount": 3000,
  "reason": "TV EMI",
  "date": "2026-06-01",
  "category": "Needs",
  "payment_method": "Bank",
  "notes": "Monthly recurring"
}
```

---

## Batch Upload Format

Upload as a JSON array:

```json
[
  {
    "amount": 500,
    "reason": "Lunch",
    "date": "2026-06-10",
    "category": "Wants",
    "payment_method": "Card",
    "notes": ""
  },
  {
    "amount": 300,
    "reason": "Dinner",
    "date": "2026-06-10",
    "category": "Wants",
    "payment_method": "Card",
    "notes": "Your share: split 3"
  }
]
```

---

## Validation

The app checks:
- ✓ `amount` is positive
- ✓ `reason` is not empty
- ✓ `date` is valid (YYYY-MM-DD)
- ✓ `category` is one of: Needs, Wants, Family, Miscellaneous

---

## Tips

- Always include: amount, reason, date, category
- For splits: log only **your personal share**, note the context in `notes`
- Keep reasons short: "Lunch" not "Went to a random restaurant for lunch"
- Use consistent spelling and capitalization
