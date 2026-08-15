# Analytics

All analytics operate on **closed trades** computed from broker transactions.
Monetary values are integer satang throughout the domain layer.

## Core metrics

| Metric | Formula |
|--------|---------|
| Win Rate | winning trades / closed trades |
| Gross Profit | sum of positive net P/L |
| Gross Loss | absolute sum of negative net P/L |
| Profit Factor | gross profit / gross loss (∞ when no losses but profitable) |
| Average Win | gross profit / winning trades |
| Average Loss | gross loss / losing trades |
| Expectancy | (win rate × avg win) − (loss rate × abs avg loss) |
| Max Drawdown | min over curve of (equity − peak) / peak |

Break-even trades (net P/L == 0) are counted separately and are **not**
classified as wins.

## Trade engine

Broker transactions are grouped into trades by `(account, instrument, side)`.
FIFO lot allocation realizes gross P/L against the oldest open lots, supporting
scale-in, scale-out, and partial close:

- OPEN 1 @ 1070, OPEN 1 @ 1080, CLOSE 1 @ 1090, CLOSE 1 @ 1090
  → FIFO: 1070→1090 (+20) and 1080→1090 (+10).

The computed trade state (status, average entry/exit, gross P/L, fees, net
P/L) is stored on the `trades` row and recomputed whenever a transaction is
assigned.

## Dimensions

Analytics can be grouped by instrument, direction (long vs short), strategy,
day of week, and month. Grouped outputs include trades, contracts, win rate,
gross P/L, fees, net P/L, profit factor, expectancy, average win/loss.

## Equity & drawdown

The equity curve is built from `daily_account_snapshots` (authoritative,
broker-provided where available). Running drawdown and maximum drawdown are
derived from the curve.

## Capital flow

Net capital flow = deposits − withdrawals + interest + adjustments. This is
kept strictly separate from trading P/L.

Net trading profit = current equity − initial capital − deposits + withdrawals.