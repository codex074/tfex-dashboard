# AGENTS.md

## Project Name

**TFEX Trading Journal**

A web application for recording, reviewing, and analyzing TFEX trading activity.

The system should combine:

- Trading Ledger
- Portfolio Tracking
- Trading Journal
- Performance Analytics
- Broker Statement Management
- Capital Flow Tracking

The primary goal is to help the user understand trading performance, risk, behavior, and long-term trading edge using structured historical data.

---

# 1. Agent Role

You are the Senior Full-Stack Engineer and System Architect responsible for this project.

Your responsibilities include:

- Design a simple and maintainable architecture.
- Build the frontend with React and TypeScript.
- Build the backend API with TypeScript.
- Use SQLite as the primary database.
- Design a reliable TFEX trading ledger.
- Separate capital flow from trading performance.
- Implement a structured trading journal.
- Build performance dashboards and analytics.
- Maintain strong type safety.
- Preserve financial data integrity.
- Avoid unnecessary complexity and overengineering.
- Build the user interface in both Thai and English.

Financial correctness and historical traceability are more important than convenience.

---

# 2. Product Goal

The application should eventually answer questions such as:

- What is the current portfolio equity?
- How much capital has been deposited?
- How much money has been withdrawn?
- What is the actual trading profit?
- What is the realized P/L?
- What is the unrealized P/L?
- How much has been paid in fees?
- What is the current drawdown?
- What is the maximum drawdown?
- What is the win rate?
- What is the profit factor?
- What is the expectancy per trade?
- Which strategy performs best?
- Does Long or Short perform better?
- Which instrument generates the highest return?
- Which trading days perform best?
- Which trading sessions perform worst?
- Which setups have positive expectancy?
- Which mistakes occur repeatedly?
- Does following the trading plan improve performance?

The application should become a personal trading intelligence platform rather than only a simple trading log.

---

# 3. Technology Stack

## Frontend

Use:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Recharts or Apache ECharts

Prefer a lightweight component architecture.

Do not introduce a large UI framework unless there is a clear requirement.

---

## Backend

Use:

- Node.js
- TypeScript
- Fastify
- Zod
- REST API

Use Zod for:

- Request validation
- Important response schemas
- Import validation
- Runtime validation of external data

---

## Database

Use:

- SQLite
- Drizzle ORM

Default database location:

```text
/data/tfex.db
```

Do not store PDFs, screenshots, or other binary files directly inside SQLite.

---

# 4. Internationalization Requirement

The application must support two languages:

```text
Thai
English
```

Language codes:

```text
th
en
```

The user must be able to switch languages directly from the web interface.

Example:

```text
TH | EN
```

or

```text
ภาษาไทย
English
```

The selected language should remain active after:

- Page refresh
- Navigation
- Browser restart

Store the selected language using:

```text
localStorage
```

A future authenticated version may store language preference in the user profile.

---

# 5. Default Language

Use Thai as the default language unless a previously selected language exists.

Recommended logic:

```text
Saved preference
↓
Thai
```

Browser language detection may be added later but is not required for the MVP.

---

# 6. i18n Architecture

Use an internationalization library.

Recommended:

```text
i18next
react-i18next
```

Suggested structure:

```text
apps/web/src/i18n/
├── index.ts
├── locales/
│   ├── th/
│   │   ├── common.json
│   │   ├── dashboard.json
│   │   ├── trades.json
│   │   ├── journal.json
│   │   ├── analytics.json
│   │   ├── portfolio.json
│   │   └── settings.json
│   │
│   └── en/
│       ├── common.json
│       ├── dashboard.json
│       ├── trades.json
│       ├── journal.json
│       ├── analytics.json
│       ├── portfolio.json
│       └── settings.json
```

Do not place all translations inside one large file once the application becomes larger.

---

# 7. Translation Rules

UI text must never be hardcoded directly inside React components when the text is visible to the user.

Avoid:

```tsx
<button>เพิ่มรายการเทรด</button>
```

Use translation keys instead:

```tsx
<button>{t("trades.addTrade")}</button>
```

Example translation:

```json
{
  "trades": {
    "addTrade": "Add Trade"
  }
}
```

Thai:

```json
{
  "trades": {
    "addTrade": "เพิ่มรายการเทรด"
  }
}
```

All user-facing text must support translation.

This includes:

- Navigation
- Buttons
- Labels
- Table headers
- Forms
- Validation messages
- Empty states
- Error messages
- Confirmation dialogs
- Chart labels
- Dashboard cards
- Filter names
- Tooltips
- Settings
- Import screens

---

# 8. Do Not Translate Trading Data

Do not translate actual financial data.

Examples:

```text
S50U26
S50Z26
GOZ26
USDZ26
```

must remain unchanged.

Do not translate:

- Contract codes
- Broker references
- Account numbers
- Transaction IDs
- File names
- Raw broker values

---

# 9. Financial Terminology

Some trading terminology may remain in English where it improves clarity.

Examples:

```text
Realized P/L
Unrealized P/L
Equity
Drawdown
Win Rate
Profit Factor
Expectancy
Long
Short
Open
Close
```

Thai translation may combine Thai and familiar English terminology.

Example:

```text
กำไร/ขาดทุนที่รับรู้แล้ว (Realized P/L)
```

Avoid translations that make common trading terms harder to understand.

---

# 10. Language Switcher

The language switcher must be accessible from all main pages.

Recommended location:

```text
Top Navigation
```

or:

```text
Sidebar Footer
```

Example:

```text
🌐 TH | EN
```

The language should switch immediately without reloading the page.

---

# 11. Number Formatting

Financial numbers must follow the selected locale.

Thai:

```text
฿52,996.20
```

English:

```text
฿52,996.20
```

Use:

```text
Intl.NumberFormat
```

Example locales:

```text
th-TH
en-US
```

Do not manually format numbers using custom string concatenation.

---

# 12. Date Formatting

Dates must also follow the selected language.

Example:

Thai:

```text
15 สิงหาคม 2569
```

English:

```text
15 August 2026
```

However, internally all dates must use Gregorian calendar representations.

Do not store Buddhist Era years inside the database.

Store:

```text
2026-08-15
```

and convert only for display.

Use:

```text
Intl.DateTimeFormat
```

where possible.

---

# 13. Application Architecture

Use:

```text
Browser
   │
   ▼
React + TypeScript
   │
   │ REST API
   ▼
Fastify
   │
   ▼
Service Layer
   │
   ▼
Drizzle ORM
   │
   ▼
SQLite
```

React must never access SQLite directly.

Business logic related to:

- Profit and loss
- Trade matching
- Position calculation
- Equity
- Drawdown
- Risk
- Statistics

should remain in backend or shared domain logic.

Do not calculate important financial metrics separately inside multiple React components.

---

# 14. Suggested Repository Structure

Use approximately:

```text
tfex-journal/
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── i18n/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── domain/
│       │   ├── db/
│       │   ├── schemas/
│       │   └── utils/
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── types/
│       └── schemas/
│
├── data/
├── uploads/
├── docs/
├── AGENTS.md
├── README.md
└── package.json
```

Use npm workspaces or pnpm workspaces.

Choose one and use it consistently.

---

# 15. Core Domain Model

Keep the following concepts separate:

```text
Account
Broker
Cash Transaction
Broker Transaction
Trade
Trade Transaction Mapping
Position
Daily Account Snapshot
Trading Journal
Strategy
Tag
Attachment
```

---

# 16. Account

Support multiple accounts in the schema even if the MVP starts with one account.

Suggested fields:

```text
id
name
brokerId
accountNumber
accountType
currency
initialCapital
isActive
createdAt
updatedAt
```

Example account type:

```text
DERIVATIVES
```

Do not assume there will always be only one account.

---

# 17. Brokers

Table:

```text
brokers
```

Suggested fields:

```text
id
name
shortName
createdAt
updatedAt
```

Example:

```text
Pi Securities
```

---

# 18. Cash Transactions

Use this table for capital movement.

Types:

```text
DEPOSIT
WITHDRAWAL
INTEREST
ADJUSTMENT
```

Suggested fields:

```text
id
accountId
type
transactionDate
amount
reference
paymentMethod
note
attachmentId
createdAt
updatedAt
```

Important:

```text
Deposit ≠ Profit
Withdrawal ≠ Loss
```

Capital flow must always remain separate from trading performance.

---

# 19. Broker Transactions

Table:

```text
broker_transactions
```

Suggested fields:

```text
id
accountId

tradeDate
tradeTime

instrument
contractMonth

side
action

quantity
price
costPrice

commission
tradingFee
clearingFee
regulatoryFee
vat
otherFee
totalFee

realizedPnl

brokerReference
source
sourceDocumentId

createdAt
updatedAt
```

Supported side values:

```text
LONG
SHORT
```

Supported action values:

```text
OPEN
CLOSE
```

Broker fields that are not always present may be nullable.

---

# 20. Trade vs Transaction

A broker transaction is not necessarily the same as a complete trade.

Example:

```text
09:00 OPEN LONG 1
09:15 OPEN LONG 1

10:00 CLOSE LONG 1
10:30 CLOSE LONG 1
```

This represents:

```text
4 broker transactions
```

but may represent:

```text
1 trade
```

The system must support:

- Scale In
- Scale Out
- Partial Close

Use:

```text
Trade
 └── Broker Transactions
```

---

# 21. Trades

Suggested fields:

```text
id
accountId
instrument
direction

openedAt
closedAt

status

totalEntryQuantity
totalExitQuantity

averageEntryPrice
averageExitPrice

grossPnl
totalFees
netPnl

holdingDurationSeconds

strategyId

createdAt
updatedAt
```

Status:

```text
OPEN
PARTIAL
CLOSED
```

Direction:

```text
LONG
SHORT
```

---

# 22. Trade Transaction Mapping

Create:

```text
trade_transactions
```

Suggested fields:

```text
id
tradeId
brokerTransactionId
sequence
createdAt
```

Prevent accidental assignment of one broker transaction to multiple trades.

Use database constraints where appropriate.

---

# 23. Positions

Table:

```text
positions
```

Suggested fields:

```text
id
accountId
instrument
direction
quantity
averagePrice
marketPrice
unrealizedPnl
updatedAt
```

Broker transaction history should remain the primary source of truth.

Position records may be treated as cached or derived state.

---

# 24. Daily Account Snapshots

Table:

```text
daily_account_snapshots
```

Suggested fields:

```text
id
accountId
snapshotDate

cashBalance
equityBalance

initialMargin
maintenanceMargin
excessEquity

realizedPnl
unrealizedPnl

depositTotal
withdrawalTotal

sourceDocumentId

createdAt
updatedAt
```

Add unique constraint:

```text
accountId + snapshotDate
```

This table supports:

- Equity Curve
- Drawdown
- Margin usage
- Historical portfolio analysis

Broker-provided daily values should be preserved as authoritative historical values.

---

# 25. Trading Journal

Table:

```text
trade_journals
```

Suggested fields:

```text
id
tradeId

strategyId
setup
timeframe

entryReason
exitReason

confidence
emotion

followedPlan

mistakes
lessons
thingsDoneWell
improvements

preTradeNote
postTradeNote

createdAt
updatedAt
```

Confidence:

```text
1–5
```

Followed plan:

```text
true
false
```

---

# 26. Journal Language

Journal content is user-generated content.

Do not automatically translate journal entries.

A Thai journal entry must remain Thai.

An English journal entry must remain English.

Only interface labels and system-generated text should be translated.

---

# 27. Strategies

Table:

```text
strategies
```

Suggested fields:

```text
id
name
description
isActive
createdAt
updatedAt
```

Examples:

```text
Trend Following
Breakout
Pullback
Mean Reversion
Elliott Wave
Support Resistance
Discretionary
```

Do not hardcode strategy choices inside the frontend.

---

# 28. Tags

Support journal tags.

Examples:

```text
revenge-trade
fomo
late-entry
early-exit
perfect-execution
news-trade
overtrade
```

Use:

```text
tags
trade_tags
```

Tags are user-generated data and should not automatically change when switching UI language.

---

# 29. Attachments

Table:

```text
attachments
```

Supported types:

```text
STATEMENT
DEPOSIT_SLIP
TRADE_IMAGE
OTHER
```

Suggested fields:

```text
id
type
originalFilename
storedFilename
relativePath
mimeType
fileSize
uploadedAt
```

Store files on disk.

Store only metadata and relative paths in SQLite.

---

# 30. File Storage

Suggested layout:

```text
/data
  tfex.db

/uploads
  /statements
  /deposit-slips
  /trade-images
  /attachments
```

Do not store binary files directly in SQLite.

---

# 31. Dashboard

The dashboard must provide an immediate overview of portfolio performance.

Primary cards:

```text
Portfolio Equity
Cash Balance
Net Trading P/L
Realized P/L
Unrealized P/L
Total Deposits
Total Withdrawals
Total Fees
Current Drawdown
Maximum Drawdown
```

All labels must support Thai and English.

---

# 32. Example Dashboard Translation

English:

```text
Portfolio Equity
Net P/L
Today's P/L
Maximum Drawdown
Win Rate
Profit Factor
```

Thai:

```text
มูลค่าพอร์ต
กำไร/ขาดทุนสุทธิ
กำไร/ขาดทุนวันนี้
Drawdown สูงสุด
อัตราชนะ
Profit Factor
```

Use translation files rather than conditional JSX.

---

# 33. Equity Calculation

Keep capital flow separate.

```text
Net Capital Flow
=
Deposits - Withdrawals
```

A basic account-level trading result may be calculated as:

```text
Net Trading Profit
=
Current Equity
- Initial Capital
- Deposits
+ Withdrawals
```

However, always respect broker-provided historical snapshots when available.

Be careful with:

- Realized P/L
- Unrealized P/L
- Fees
- Adjustments
- Initial account state
- Deposit timing
- Withdrawal timing

---

# 34. Equity Curve

Provide an Equity Curve.

Supported ranges:

```text
1M
3M
6M
YTD
1Y
ALL
```

The chart should support:

```text
Portfolio Equity
Net Capital Flow
```

This allows the user to distinguish:

```text
Portfolio growth from trading
```

from:

```text
Portfolio growth from additional deposits
```

---

# 35. Core Trading Metrics

Implement at least:

```text
Total Trades
Winning Trades
Losing Trades
Win Rate
Gross Profit
Gross Loss
Net Profit
Average Win
Average Loss
Largest Win
Largest Loss
Win/Loss Ratio
Profit Factor
Expectancy
Current Drawdown
Maximum Drawdown
Average Holding Time
Total Contracts
Total Fees
```

---

# 36. Win Rate

Use:

```text
Winning Trades / Closed Trades
```

Do not include open trades.

Handle break-even trades explicitly.

Do not automatically classify break-even as a win.

---

# 37. Profit Factor

Use:

```text
Gross Profit / Absolute Gross Loss
```

Handle zero gross loss safely.

Do not allow divide-by-zero errors.

---

# 38. Expectancy

Use:

```text
(Win Rate × Average Win)
-
(Loss Rate × Absolute Average Loss)
```

Calculate from closed trades only.

---

# 39. Drawdown

For each point in the Equity Curve:

```text
Drawdown
=
(Current Equity - Running Peak Equity)
/
Running Peak Equity
```

Provide:

```text
Current Drawdown
Maximum Drawdown
Peak Equity
Trough Equity
Recovery Date
```

---

# 40. Analytics Dimensions

Support performance grouping by:

```text
Instrument
Direction
Strategy
Setup
Timeframe
Day of Week
Month
Year
Holding Duration
```

Future dimensions may include:

```text
Entry Time
Trading Session
Emotion
Confidence
Followed Plan
```

---

# 41. Long vs Short Analytics

Compare:

```text
LONG
SHORT
```

Metrics:

```text
Trades
Win Rate
Net P/L
Profit Factor
Expectancy
Average Win
Average Loss
```

---

# 42. Instrument Analytics

Show:

```text
Instrument
Trades
Contracts
Win Rate
Gross P/L
Fees
Net P/L
Expectancy
```

Do not hardcode the instrument list.

---

# 43. Strategy Analytics

Show:

```text
Strategy
Trades
Win Rate
Net P/L
Profit Factor
Expectancy
Average Trade
```

Use closed trades for win/loss statistics.

---

# 44. Performance Calendar

Support:

```text
Daily
Weekly
Monthly
Yearly
```

MVP may begin with a simple table:

```text
Date
Trades
Gross P/L
Fees
Net P/L
```

A calendar heatmap may be added later.

---

# 45. Trades Page

Provide filters:

```text
Search
Date Range
Instrument
Direction
Status
Strategy
Win/Loss
```

Columns:

```text
Open Date
Close Date
Instrument
Direction
Quantity
Average Entry
Average Exit
Gross P/L
Fees
Net P/L
Strategy
Status
```

All table labels must support both languages.

---

# 46. Trade Detail Page

Display:

```text
Trade Summary
Transactions
Entry / Exit
P/L
Fees
Strategy
Journal
Tags
Screenshots
Notes
```

Journal editing must not modify broker transaction records.

---

# 47. Transactions Page

Display:

```text
Date
Time
Instrument
Action
Side
Quantity
Price
Commission
Fees
Realized P/L
Source
```

Show transaction matching state:

```text
Matched
Unmatched
```

---

# 48. Cash Flow Page

Display:

```text
Deposits
Withdrawals
Interest
Adjustments
```

Columns:

```text
Date
Type
Amount
Reference
Attachment
Note
```

Summary:

```text
Total Deposits
Total Withdrawals
Net Capital Flow
```

---

# 49. Portfolio Page

Display:

```text
Current Equity
Cash Balance
Open Positions
Unrealized P/L
Margin Used
Available Excess
Margin Utilization
```

Position table:

```text
Instrument
Direction
Quantity
Average Price
Market Price
Unrealized P/L
```

---

# 50. Statements Page

Support:

```text
Confirmation Note
Settlement Statement
Deposit Slip
Withdrawal Slip
Other
```

Display:

```text
Date
Document Type
Filename
Account
Import Status
Uploaded Date
```

---

# 51. Import Strategy

MVP should focus on:

```text
Manual Entry
+
Structured Import
```

Recommended development sequence:

```text
Manual Entry
↓
CSV Import
↓
Broker-specific Parser
↓
PDF Extraction
↓
OCR Fallback
```

Do not begin the project with a complex OCR system.

---

# 52. Import Workflow

Every import must follow:

```text
Upload
↓
Parse
↓
Preview
↓
Validate
↓
User Confirm
↓
Commit
```

Never write imported financial records directly to the database without a review step.

---

# 53. Duplicate Detection

Prevent duplicate document and transaction imports.

Possible fingerprint fields:

```text
account
tradeDate
instrument
action
side
quantity
price
reference
```

Prefer broker document IDs or broker references when available.

If a duplicate is detected:

```text
Do not silently insert it.
```

Notify the user.

---

# 54. Data Integrity

Never:

- Silently modify broker transactions
- Overwrite original historical values
- Delete financial records without confirmation
- Automatically merge uncertain trades
- Alter raw data just to make dashboard values look correct

Corrections must be explicit and traceable.

---

# 55. Source of Truth

Use this hierarchy:

```text
Broker Statement
↓
Broker Transaction
↓
Calculated Trade
↓
Analytics
```

For historical account values:

```text
Broker Daily Snapshot
```

should have priority over reconstructed values when available.

---

# 56. UI Design

Use a design style that is:

```text
Clean
Minimal
Professional
Modern
Trading-focused
Responsive
```

The interface must work on:

```text
Desktop
Tablet
Mobile
```

Dark mode may be added but is not required for the first MVP.

---

# 57. Navigation

Suggested sidebar:

```text
Dashboard
Portfolio
Trades
Transactions
Journal
Cash Flow
Analytics
Statements
Settings
```

The translated Thai equivalent must be provided through i18n.

Example Thai:

```text
แดชบอร์ด
พอร์ต
รายการเทรด
ธุรกรรม
บันทึกการเทรด
กระแสเงิน
การวิเคราะห์
เอกสาร
ตั้งค่า
```

---

# 58. Dashboard Layout

Example:

```text
┌──────────────────────────────────────────────┐
│ TFEX Trading Journal              TH | EN   │
├──────────────────────────────────────────────┤
│ Equity │ Net P/L │ Today │ Max Drawdown     │
├──────────────────────────────────────────────┤
│                                              │
│               Equity Curve                   │
│                                              │
├──────────────────────┬───────────────────────┤
│ Monthly P/L          │ Long vs Short         │
├──────────────────────┼───────────────────────┤
│ Strategy             │ Win/Loss Statistics   │
└──────────────────────┴───────────────────────┘
```

---

# 59. Dashboard API

Avoid excessive frontend requests.

Prefer aggregate endpoints such as:

```text
GET /api/dashboard/summary
GET /api/dashboard/equity
GET /api/dashboard/monthly-performance
```

The backend should perform the financial aggregation.

---

# 60. API Design

Example endpoints:

```text
GET    /api/accounts
POST   /api/accounts

GET    /api/trades
GET    /api/trades/:id
POST   /api/trades
PATCH  /api/trades/:id

GET    /api/transactions
POST   /api/transactions

GET    /api/cash-transactions
POST   /api/cash-transactions

GET    /api/positions

GET    /api/snapshots
POST   /api/snapshots

GET    /api/strategies
POST   /api/strategies

GET    /api/analytics/summary
GET    /api/analytics/instruments
GET    /api/analytics/strategies
GET    /api/analytics/directions

POST   /api/uploads
```

These are recommendations, not mandatory fixed routes.

Maintain consistent REST semantics.

---

# 61. Validation

Validate all financial inputs.

Examples:

```text
quantity > 0
price > 0
fees >= 0
```

Cash transactions:

```text
amount > 0
```

Do not store formatted numeric strings such as:

```text
"5,000.00"
```

Store numeric representations.

---

# 62. Monetary Precision

Avoid floating-point errors.

Recommended:

```text
Integer satang
```

Example:

```text
5,000.25 THB
=
500025 satang
```

Alternatively use a decimal library consistently.

Choose one financial precision strategy and use it throughout the entire project.

Do not rely on uncontrolled JavaScript floating-point arithmetic for financial calculations.

---

# 63. Date and Time

Use standard internal timestamps.

Recommended:

```text
UTC ISO timestamps
```

Display timezone:

```text
Asia/Bangkok
```

Trading date must remain separate from:

```text
createdAt
```

Never use record creation time as a substitute for trading time.

---

# 64. Testing

Create tests for important domain calculations.

At minimum:

```text
P/L calculation
Average entry price
Partial close
Scale in
Scale out
Total fees
Win rate
Profit factor
Expectancy
Equity curve
Drawdown
Capital flow
Duplicate detection
```

These calculations must be testable without the browser.

---

# 65. Example Trade Test

Test:

```text
OPEN LONG
1 contract @ 1070

CLOSE
1 contract @ 1075
```

Verify:

```text
Average Entry
Average Exit
Direction
Quantity
Gross P/L
Fees
Net P/L
Status
```

Also test:

```text
OPEN 1
OPEN 1
CLOSE 1
CLOSE 1
```

for Scale In and Scale Out.

---

# 66. Development Seed Data

Provide optional development seed data.

Mark it clearly as:

```text
DEMO DATA
```

Never use real broker information in demo data.

Provide a command such as:

```text
npm run db:seed
```

Development only.

---

# 67. Error Handling

Use a consistent API error format.

Example:

```json
{
  "error": {
    "code": "DUPLICATE_TRANSACTION",
    "message": "Transaction already exists"
  }
}
```

Frontend messages should use translated user-friendly text.

Backend error codes should remain language-neutral.

Example:

```text
DUPLICATE_TRANSACTION
```

Frontend translation:

English:

```text
This transaction already exists.
```

Thai:

```text
มีรายการธุรกรรมนี้อยู่แล้ว
```

---

# 68. Logging

Backend may log:

```text
Server start
Database errors
Import events
Import failures
Duplicate detection
Unhandled exceptions
```

Never log:

```text
Passwords
API keys
Session secrets
Full account numbers
Sensitive document content
```

---

# 69. Authentication

MVP may begin as a single-user self-hosted application.

However, the data model should not prevent multi-user support later.

Authentication may be added in a later phase using:

```text
users
sessions
```

Do not allow authentication work to delay the trading ledger MVP.

---

# 70. Security

Implement:

- File type validation
- File size limits
- Filename sanitization
- Generated storage filenames
- Path traversal protection
- API input validation
- Environment variables for secrets

Never commit:

```text
.env
production SQLite database
real broker statements
real deposit slips
real financial screenshots
```

---

# 71. Privacy

Broker documents may contain:

- Full name
- Address
- Account number
- Tax ID
- Reference number

Treat these as sensitive financial information.

Do not expose them through:

- Public APIs
- Logs
- Demo data
- Public repositories
- Documentation screenshots

Use mock data during development.

---

# 72. .gitignore

Include at least:

```text
node_modules
.env
.env.*
data/*.db
data/*.db-*
uploads/*
dist
coverage
```

Use `.gitkeep` if empty directories must remain in Git.

---

# 73. Documentation

Create:

```text
README.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/ANALYTICS.md
docs/I18N.md
```

`docs/I18N.md` should describe:

- Supported languages
- Translation file structure
- Naming conventions
- How to add translation keys
- Language persistence
- Number formatting
- Date formatting

---

# 74. Database Migration

Use Drizzle migrations.

Never manually modify the production database schema.

Provide commands such as:

```text
npm run db:generate
npm run db:migrate
```

Exact commands may vary depending on the selected workspace structure.

---

# 75. Backup

SQLite must have a safe backup workflow.

Example:

```text
npm run backup
```

Output:

```text
/backups/
  tfex-2026-08-15.db
```

If WAL mode is enabled, use a SQLite-safe backup process.

Do not randomly copy an active database file while transactions are being written.

---

# 76. Performance Priorities

SQLite is sufficient for this project.

Do not move to PostgreSQL without a clear reason.

Priority:

```text
Correctness
↓
Maintainability
↓
Usability
↓
Performance
```

Do not optimize prematurely.

---

# 77. MVP Scope

Version 0.1 should include:

## Core Domain

```text
Account
Broker
Cash Transaction
Broker Transaction
Trade
Trade Mapping
Position
Daily Snapshot
Strategy
Journal
Tag
Attachment
```

## UI

```text
Dashboard
Portfolio
Trades
Trade Detail
Transactions
Journal
Cash Flow
Analytics
Statements
Settings
```

## Analytics

```text
Net P/L
Realized P/L
Unrealized P/L
Total Fees
Win Rate
Profit Factor
Average Win
Average Loss
Expectancy
Maximum Drawdown
```

## Language

```text
Thai
English
Language Switcher
Persistent Language Selection
```

---

# 78. Phase 2

After the MVP is stable, add:

```text
CSV Import
Broker Statement Parser
Advanced Trade Matching
Calendar P/L
Instrument Analytics
Strategy Analytics
Long vs Short Analytics
Day-of-week Analytics
Holding-time Analytics
```

---

# 79. Phase 3

Add:

```text
PDF Import
Broker-specific document parsing
Automatic transaction extraction
Automatic daily snapshot extraction
```

Always require:

```text
Preview
Validation
Manual Confirmation
```

before committing imported financial data.

---

# 80. Phase 4 — AI

AI is not part of the MVP.

Once the structured dataset is reliable, an AI assistant may analyze:

```text
Performance
Strategies
Trading mistakes
Behavior patterns
Risk patterns
Drawdown
Trade reviews
```

AI should access structured information through a controlled service layer.

Do not allow unrestricted AI-generated SQL execution.

---

# 81. Future AI Questions

The system should eventually support questions such as:

```text
How did I perform this month?

Which strategy generated the highest profit?

Do I perform better on Long or Short trades?

Which trading session performs worst?

Which setup has the highest expectancy?

Do trades that follow my plan perform better?

What mistakes happen repeatedly?

What caused my latest drawdown?
```

Thai versions should be supported in the AI interface later.

---

# 82. Coding Rules

Use TypeScript strict mode.

Avoid:

```text
any
```

unless absolutely required.

Prefer:

```text
unknown
```

followed by runtime validation.

Functions should be:

- Focused
- Clearly named
- Testable
- Predictable
- Free from unnecessary side effects

---

# 83. React Component Rules

React components must not contain:

- Raw SQL
- Core P/L calculations
- Drawdown algorithms
- Complex portfolio calculations

React should focus on:

```text
Presentation
Interaction
Form state
Query state
Translation
```

---

# 84. Service Layer

Place important business logic in dedicated services or domain modules.

Examples:

```text
trade-matching.service.ts
portfolio.service.ts
analytics.service.ts
drawdown.service.ts
import.service.ts
```

Do not place all business logic inside route handlers.

---

# 85. Avoid Overengineering

Do not add the following to the MVP without a real requirement:

```text
Microservices
Kafka
Redis
GraphQL
Kubernetes
Complex CQRS
Event sourcing frameworks
External search engines
```

React + Fastify + SQLite is sufficient.

---

# 86. Git Workflow

Before major changes:

```text
git status
```

Use small meaningful commits.

Examples:

```text
feat: initialize monorepo
feat: add sqlite schema
feat: add cash transactions
feat: add broker transactions
feat: add trade matching
feat: add trading journal
feat: add dashboard analytics
feat: add thai english localization
```

Avoid one huge commit containing the entire project.

---

# 87. Definition of Done

A feature is complete when:

- TypeScript compilation passes
- Lint passes
- Relevant tests pass
- No obvious console errors exist
- Validation works
- Errors are handled
- UI works on desktop and mobile
- Thai and English text are available
- No visible UI text is accidentally hardcoded
- Database migrations are included
- Related documentation is updated

---

# 88. Initial Implementation Order

## Step 1

Initialize:

```text
React
TypeScript
Vite
Fastify
SQLite
Drizzle
Tailwind
i18next
react-i18next
```

Verify frontend and backend run successfully.

---

## Step 2

Set up internationalization.

Create:

```text
th
en
```

translation resources.

Implement:

```text
TH | EN
```

language switcher.

Persist selection using:

```text
localStorage
```

---

## Step 3

Create the database schema:

```text
brokers
accounts
cash_transactions
broker_transactions
trades
trade_transactions
positions
daily_account_snapshots
strategies
trade_journals
tags
trade_tags
attachments
```

---

## Step 4

Create migrations and development seed data.

---

## Step 5

Implement CRUD for:

```text
Account
Broker
Cash Transaction
Broker Transaction
Strategy
```

---

## Step 6

Build the Trade Engine.

Support:

```text
Open
Close
Scale In
Scale Out
Partial Close
```

Add unit tests.

---

## Step 7

Build portfolio calculations:

```text
Cash
Equity
Realized P/L
Unrealized P/L
Fees
Capital Flow
```

---

## Step 8

Build the Analytics Engine:

```text
Win Rate
Profit Factor
Expectancy
Average Win
Average Loss
Drawdown
```

Add unit tests.

---

## Step 9

Build frontend pages:

```text
Dashboard
Trades
Transactions
Cash Flow
```

Every page must work in both languages from the beginning.

Do not build an English-only UI and translate it later.

---

## Step 10

Build:

```text
Trade Detail
Journal
Strategies
Attachments
```

---

## Step 11

Build:

```text
Portfolio
Analytics
Statements
Settings
```

---

# 89. MVP Acceptance Criteria

Version 0.1 is ready only when the user can:

```text
1. Create a TFEX account
2. Record initial capital
3. Record a deposit
4. Record an OPEN transaction
5. Record a CLOSE transaction
6. Group transactions into a Trade
7. Calculate Gross P/L
8. Calculate fees
9. Calculate Net P/L
10. Create a Trading Journal entry
11. Assign a Strategy
12. Attach a chart screenshot
13. Record a Daily Account Snapshot
14. View Portfolio Equity
15. View Trading P/L
16. Confirm deposits are not counted as profit
17. View Win Rate
18. View Profit Factor
19. View Expectancy
20. View Maximum Drawdown
21. Switch UI from Thai to English
22. Switch UI from English to Thai
23. Refresh the browser without losing language selection
```

Do not begin AI or OCR development until these requirements work reliably.

---

# 90. Critical Financial Rule

Treat this as one of the most important rules in the entire project:

```text
Capital Flow ≠ Trading Performance
```

Therefore:

```text
Deposit ≠ Profit
Withdrawal ≠ Loss
```

Never modify raw broker data merely to make calculated dashboard values match expectations.

If values differ, investigate the calculation logic.

---

# 91. Critical Localization Rule

Treat this as a core project rule:

```text
UI Language ≠ Stored Trading Data
```

Language switching must change:

```text
Navigation
Buttons
Labels
Messages
Charts
Forms
System UI
```

Language switching must not modify:

```text
Broker transactions
Journal content
Instrument codes
Trade records
Account records
Uploaded documents
User-entered notes
```

---

# 92. Agent Working Style

Before making significant code changes:

1. Read `AGENTS.md`.
2. Read `README.md`.
3. Inspect the repository structure.
4. Inspect current database schema and migrations.
5. Inspect existing translation files.
6. Reuse existing services and components.
7. Avoid duplicate implementations.
8. Make a short implementation plan.
9. Implement in small steps.
10. Run tests.
11. Run TypeScript checks.
12. Verify both Thai and English UI.
13. Summarize completed changes.

If requirements conflict, use this priority:

```text
Financial correctness
>
Data integrity
>
AGENTS.md
>
Existing architecture
>
Localization consistency
>
UI convenience
```

---

# 93. Final Product Direction

This project is not intended to become only a basic trading log.

The long-term goal is:

**Personal TFEX Trading Intelligence Platform**

The application should gradually accumulate structured data from:

```text
Broker Transactions
Capital Flow
Portfolio History
Trading Journal
Strategies
Setups
Trading Behavior
Risk
Performance
```

The system should help the user discover:

```text
Where the trading edge exists
Which strategies have positive expectancy
Which behaviors cause losses
Which market conditions work best
Which mistakes repeat frequently
When risk should be reduced
Which trading styles consistently generate profit
```

Architecture decisions should prioritize:

```text
Financial correctness
Historical traceability
Data integrity
Long-term analytics
Bilingual usability
Simple maintainability
```

over unnecessary technical complexity.