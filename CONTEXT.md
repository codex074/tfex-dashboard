# Trading Ledger Glossary

## Instrument Contract Specification

The versioned exchange terms that define how one contract of an instrument
behaves: contract multiplier and price tick. A specification applies from an
effective date and must not alter historical trades.

## Contract Multiplier

The Thai-baht value of a one-point price move for one contract. It is an
instrument property, not a portfolio-wide default. For the S50 contract in this
application, the multiplier is 200 THB per point.

## Instrument Family

The stable underlying product selected by a trader, such as S50. It has a
default contract specification but is not itself a tradable expiry.

## Contract Series

The expiry code entered by a trader after selecting an instrument family, such
as U26. The resulting tradable contract code is S50U26. A series identifies an
expiry; it does not define the multiplier or leverage by itself.

## Notional Exposure

The market-value exposure of an open position. It is distinct from the margin
posted to open the position.

## Effective Leverage

Notional exposure divided by current portfolio equity. It is reported at the
portfolio level and may be aggregated across instruments.

## Margin Utilization

Initial margin required for open positions divided by current portfolio equity.
It is a risk measure and is not interchangeable with effective leverage.

## Broker Trading Profile

The versioned commercial terms a broker applies to a particular account and
instrument family. It supplies margin and fee defaults when a position is
recorded. It is distinct from an Instrument Contract Specification.

## Fee Schedule

The broker's configured commission and exchange-fee components for a contract.
Fee schedules are defaults for entry, not a replacement for broker-reported
fees on imported transactions.
