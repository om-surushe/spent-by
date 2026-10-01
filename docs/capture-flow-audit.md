# Finance Vault capture-flow audit

## Goal

Validate the financial model before optimizing capture speed. The key finding is that every positive amount cannot safely be treated as spending.

## Money movement semantics

| Movement | Spending impact |
| --- | ---: |
| Expense | +amount |
| Refund | -amount |
| Reimbursement | -amount |
| Transfer | 0 |
| Income | 0 |

Existing records without `movementType` are interpreted as `Expense` for backward compatibility.

## Product rules

- Category answers what the transaction was for; movement type answers what happened financially.
- Transfers between owned accounts are neutral to spending.
- Refunds and reimbursements reduce net spending.
- Income is tracked but does not inflate spending.
- For shared expenses, record the user's actual share when known. If the full payment is recorded, money returned later should be recorded as a reimbursement.

## Why this precedes capture-speed work

A faster flow is not useful if the dashboard becomes economically incorrect. Correct movement semantics create a trustworthy base for later work such as defaults, recurring patterns, faster capture and analytics.

## Evidence to collect

Use the experiment and observe:

- how often non-expense movement types occur;
- which classifications are ambiguous;
- whether monthly net spending reconciles correctly;
- which form fields are repeatedly changed from defaults;
- how often transactions are captured late.

The next product iteration should be based on this evidence rather than adding features speculatively.
