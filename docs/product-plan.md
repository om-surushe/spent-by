# Finance Vault — Product Plan

## 1. Product stage

Finance Vault is **personal-first**.

The first user is Om. The immediate goal is not to build a generic fintech product or acquire users. The goal is to make personal expense tracking reliable enough that it becomes the default system for recording, reviewing, and understanding spending.

If the product works consistently for one real user over time, we can later decide whether to generalize it.

---

## 2. Problem

Personal spending data is fragmented across UPI, bank accounts, Splitwise, cash, food apps, family expenses, refunds, subscriptions, and temporary transfers.

Existing finance apps often create one or more of these problems:

- logging an expense takes too many steps;
- automatic categorization is inaccurate or difficult to correct;
- the user loses context about *why* money was spent;
- refunds, reimbursements, shared expenses, and temporary transfers distort actual spending;
- financial data is handed to a third party;
- reviewing transactions becomes a backlog instead of a useful habit.

### Core problem statement

> I want a fast, trustworthy record of where my money went, without giving a third party access to my financial history, so that I can make better spending decisions without turning expense tracking into work.

---

## 3. Primary user

### V0 user

One technically comfortable individual managing personal finances across multiple payment sources.

Current characteristics:

- mostly digital payments, with occasional cash;
- expenses across personal, family, shared, and reimbursable contexts;
- wants detailed records when useful, but very low friction during entry;
- cares strongly about privacy and control of data;
- periodically reviews spending instead of maintaining perfect bookkeeping in real time.

### Not a V0 user

For now, Finance Vault is **not** designed for:

- couples/family shared accounts;
- accountants;
- business bookkeeping;
- investment portfolio tracking;
- automatic bank aggregation;
- public multi-user SaaS onboarding.

---

## 4. Job to be done

### Primary job

**When I spend money, I want to capture the transaction quickly enough that I actually record it, so I can later trust my financial history.**

### Secondary jobs

1. When I review my spending, I want to understand what each expense was for.
2. When money moves temporarily (refund, reimbursement, family transfer, Splitwise), I want the system to represent the real economic cost instead of blindly counting every bank movement as spending.
3. When I look back at a month, I want to know where my money went and whether anything needs attention.
4. When I change devices, I want my data to remain available without exposing plaintext financial data to the server.

---

## 5. Product principles

### 1. Capture first
If entering a transaction is annoying, every downstream insight becomes unreliable.

### 2. Correctness over automation
A smaller dataset the user trusts is more useful than automatically imported data full of incorrect categories and transfers.

### 3. Context matters
`₹500 — Food` is less useful than knowing what happened, who it involved, and whether some of it will be reimbursed.

### 4. Review should reduce uncertainty
The review experience should help clean incomplete records, not simply display a large table.

### 5. Privacy is part of the product
Local-first and zero-knowledge sync are user-facing product decisions, not merely architecture choices.

### 6. Personal-first before generalization
Do not add signup, teams, social features, monetization, or generic onboarding until the personal workflow is genuinely good.

---

## 6. Core product loop

```text
Spend
  ↓
Capture quickly
  ↓
Review / correct
  ↓
Understand spending
  ↓
Make a decision
  ↓
Spend
```

The product fails if the loop breaks at **Capture** or **Review**.

---

## 7. V0 success criteria

Finance Vault is successful for the personal-use stage if:

- most meaningful expenses are captured;
- adding a normal transaction feels faster than writing it in a notes app;
- pending transaction-review backlog stays manageable;
- refunds/transfers/reimbursements do not materially distort monthly spending;
- monthly spending can be understood without manually reconstructing the month from bank apps;
- data is usable across devices without the server learning transaction contents.

---

## 8. Metrics

At the personal stage these are **product-health metrics**, not growth metrics.

### North-star candidate

**Weekly reviewed transaction coverage**

> Percentage of the week's meaningful transactions that are captured and sufficiently reviewed/categorized to be trusted.

This combines the two most important behaviors: capture and review.

### Supporting metrics

- transactions captured per week;
- median time to add a transaction;
- transactions awaiting review;
- oldest unreviewed transaction age;
- percentage of transactions with category/source/reason completed;
- number of corrections made during review;
- number of days since last successful sync;
- monthly difference between expected cash flow and recorded cash flow.

Avoid vanity metrics such as number of screens, charts, categories, or features shipped.

---

## 9. MVP scope

### Must work exceptionally well

#### Capture
- amount;
- expense/income/transfer semantics;
- source/account;
- category;
- reason/note;
- date/time;
- quick calculator;
- rapid keyboard-first/mobile entry.

#### Review
- obvious list of items needing attention;
- edit without navigating through several screens;
- identify shared/reimbursed/refunded/temporary movements;
- mark records reviewed;
- search/filter recent transactions.

#### Understand
- monthly total spending;
- spending by category;
- spending by source/account;
- comparison with previous periods where useful;
- clear exclusion/handling of transfers, reimbursements, and refunds.

#### Reliability/privacy
- local-first storage;
- encrypted sync;
- recovery flow;
- backup/export;
- clear sync/error state.

### Explicitly later

- bank account aggregation;
- SMS/email transaction ingestion;
- AI categorization;
- public signup;
- social/shared finance;
- investment tracking;
- complex budgeting frameworks;
- financial advice;
- gamification.

These may become useful, but they should not distract from making the core loop excellent.

---

## 10. Staged roadmap

### Stage 0 — Product foundation
**Goal:** decide what Finance Vault is before adding more features.

Deliverables:
- problem statement;
- primary user;
- JTBD;
- product principles;
- core loop;
- MVP boundaries;
- success metrics.

**Status: started with this document.**

### Stage 1 — Capture
**Question:** Can a transaction be recorded with almost no friction?

Work:
- audit current add-transaction flow;
- count interactions required for common transactions;
- optimize defaults and keyboard/mobile behavior;
- make recurring fields easy to reuse;
- test with real transactions for at least one week.

Exit condition:
> Normal transaction entry is consistently fast enough that the user does not postpone it.

### Stage 2 — Review
**Question:** Can incomplete records be cleaned quickly instead of becoming backlog?

Work:
- explicit review queue;
- reviewed/unreviewed state;
- fast inline corrections;
- special handling for transfers/refunds/reimbursements/shared expenses;
- review-age indicator.

Exit condition:
> A week's backlog can be reconciled in one short session without consulting several apps repeatedly.

### Stage 3 — Understand
**Question:** Can the user answer useful financial questions from the data?

Start with questions, not charts:
- How much did I actually spend this month?
- What changed versus last month?
- Where did the increase come from?
- How much did I spend on family/personal/fun/food/etc.?
- Which expenses are unusual?
- What money is expected to return via refund/reimbursement?

Build only the views needed to answer those questions.

### Stage 4 — Reliability
**Question:** Would the user trust Finance Vault as the financial source of truth?

Work:
- backup/recovery testing;
- sync edge cases;
- conflict visibility;
- import/export validation;
- recovery phrase UX;
- data-integrity checks.

### Stage 5 — Automation
Only after the manual product loop is strong.

Potential experiments:
- suggested category/reason;
- merchant memory;
- recurring transaction suggestions;
- transaction import;
- AI-assisted review.

Automation should reduce friction without reducing trust.

### Stage 6 — Public product decision
At this point decide explicitly whether Finance Vault remains a personal/open-source tool or becomes a product for other users.

Only then revisit:
- public onboarding;
- personas beyond the original user;
- activation;
- retention;
- pricing;
- support;
- scalable quotas;
- public-facing domain/brand.

---

## 11. Product questions to answer through usage

Keep a running evidence log instead of guessing.

1. What causes a transaction to be recorded late?
2. Which fields are frequently left incomplete?
3. Which categories are ambiguous?
4. Which transaction types create the most reconciliation work?
5. What information is repeatedly checked in another app during review?
6. Which insights actually change a spending decision?
7. What parts of the workflow feel like bookkeeping rather than useful personal finance?

---

## 12. Immediate next step

Do **not** add another major feature yet.

The next product exercise is a **Capture Flow Audit**:

1. Identify 5 common real transaction scenarios.
2. Record exactly how many actions each takes in the current app.
3. Note every point where the user has to think, type redundant information, or leave the flow.
4. Define the ideal flow for each scenario.
5. Pick the single highest-friction problem and fix that first.

Suggested scenarios:

- normal UPI food purchase;
- cash expense;
- family expense;
- Splitwise/shared expense;
- refund/reimbursement/temporary transfer.

This becomes Stage 1 of the product work.