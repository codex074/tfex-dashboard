# TFEX Market Data Reference — Leverage, Margin & Commission

This document records the authoritative sources behind the seeded TFEX
reference data (`apps/api/src/db/seed.reference.ts`). It separates what is
**fixed by the exchange** (and safe to seed) from what **changes over time or
is private to each broker** (must be maintained by the Admin).

> Follow every claim back to the source that owns it. Use the `date` markers
> below for price-sensitive figures; margin rates in particular are re-based
> daily by the clearing house.

---

## 1. Scope and key conclusion

**Leverage is not a published value.** TFEX and the Thailand Clearing House
(TCH) do not publish a "leverage" field. Effective leverage is derived:

```
Effective leverage = notional exposure ÷ account equity
```

and the exchange-controlled input is the **initial margin rate**, which TCH
publishes as a percentage of contract value and re-bases daily from the
latest settlement price.

```
Initial margin (THB) = contract value × initial margin rate
Maximum contract leverage = 1 ÷ initial margin rate
```

So "find the leverage of TFEX instruments" resolves to "record the initial
margin rate per instrument", which is stored as integer basis points
(`initial_margin_rate_bps`) on `instrument_contract_specs`.

---

## 2. Instruments and contract terms (exchange-fixed)

Contract multiplier and minimum price fluctuation are set by TFEX in each
product's contract specification. These are stable and safe to seed.

Source (primary, per product):
`https://www.tfex.co.th/en/products/<group>/<product>/contract-specification`

| Code  | Product                  | Underlying / contract size                     | Multiplier (THB/point) | Tick size (points) |
|-------|--------------------------|------------------------------------------------|------------------------|--------------------|
| S50   | SET50 Index Futures      | SET50 Index                                    | 200                    | 0.1                |
| S50O  | SET50 Index Options      | SET50 Index                                    | 200                    | 0.1                |
| SSF   | Single Stock Futures     | 1,000 shares per contract                      | 1,000                  | 0.01               |
| GF    | Gold Futures             | 10 / 50 Thai gold baht (15.244 g)             | contract-size based    | 10 (THB)           |
| GO    | Gold Online Futures      | 300 × reference price / troy ounce             | 0.01 USD               | 0.1 (USD)          |
| SILVER| Silver Online Futures    | 3,000 × reference price / troy ounce           | 0.001 USD              | 0.01 (USD)         |
| GD    | Gold-D                   | 100 grams (3.2148 troy oz)                     | USD-quoted             | 0.10 (USD)         |
| USD   | USD Futures              | 1,000 USD                                      | 1,000                  | 0.01               |
| USDJPY| USD/JPY Futures          | USD/JPY rate                                   | —                      | 0.01 (JPY)         |
| EURUSD| EUR/USD Futures          | EUR/USD rate                                   | —                      | 0.0001 (USD)       |
| EURTHB| EUR/THB Futures          | 1,000 EUR                                      | 1,000                  | 0.01 (THB)         |
| JPYTHB| JPY/THB Futures          | JPY/THB rate                                   | 1,000                  | 0.01 (THB)         |
| TGB5  | 5Y Gov Bond Futures      | 5Y Thai gov bond (5% coupon)                  | 100                    | 0.01               |
| RSS3  | RSS3 Futures             | 5,000 kg (5 tons)                              | 5,000                  | 0.05 (THB)         |
| RSS3D | RSS3D Futures            | 5,000 kg (5 tons)                              | 5,000                  | 0.05 (THB)         |
| JRF   | Japanese Rubber Futures  | 300 × reference price                          | ~30,000                | 0.10 (JPY)         |

> `—` warns the multiplier is instrument-currency- or contract-size-dependent;
> the Admin should confirm the THB-equivalent multiplier before relying on it.

Rows where the multiplier is not a simple THB-per-point (GF, GO, SILVER, GD,
USDJPY, EURUSD, JRF) are seeded as `0` (unknown) rather than guessed, per
§54 Data Integrity. Confirm from the contract-spec page before use.

---

## 3. Broker list (36 Full License Members)

Source: TFEX > Market Data > Participants > Member List
`https://www.tfex.co.th/en/market-data/participants/member-list`
*(page states "TFEX has 36 Full License Members (Data as of May 15, 2025)")*

| ShortName | Legal name |
|-----------|------------|
| AIRA      | Aira Securities Public Company Limited |
| ASL       | ASL Securities Company Limited |
| ASPS      | Asia Plus Securities Company Limited |
| BLS       | Bualuang Securities Public Company Limited |
| BYD       | Beyond Securities Public Company Limited |
| CAF       | Classic Ausiris Investment Advisory Securities Co., Ltd. |
| CGSI      | CGS International Securities (Thailand) Company Limited |
| CLSAT     | CLSA Securities (Thailand) Limited |
| DAOLSEC   | DAOL Securities (Thailand) Public Company Limited |
| DBSV      | DBS Vickers Securities (Thailand) Company Limited |
| FSS       | Finansia Syrus Securities Public Company Limited |
| GBS       | Globlex Securities Company Limited |
| HGF       | Hua Seng Heng Gold Futures Co., Ltd. |
| INVX      | InnovestX Securities Co., Ltd. |
| IVG       | I V Global Securities Public Company Limited |
| JPM       | JPMorgan Securities (Thailand) Limited |
| KGI       | KGI Securities (Thailand) Public Company Limited |
| KINGSFORD | Kingsford Securities Public Company Limited |
| KKPS      | Kiatnakin Phatra Securities Public Company Limited |
| KS        | Kasikorn Securities Public Company Limited |
| KSS       | Krungsri Securities Public Company Limited |
| KTX       | Krungthai XSpring Securities Company Limited |
| LHS       | Land and Houses Securities Public Company Limited |
| LIB       | Liberator Securities Company Limited |
| MST       | Maybank Securities (Thailand) Public Company Limited |
| MTSGF     | MTS Capital Co., Ltd. |
| PI        | PI Securities Public Company Limited |
| PST       | Phillip Securities (Thailand) Public Company Limited |
| SBITO     | SBI Thai Online Securities Company Limited |
| TISCO     | Tisco Securities Company Limited |
| TNITY     | Trinity Securities Company Limited |
| TTBWEALTH | TTB Wealth Securities Public Company Limited |
| UBS       | UBS Securities (Thailand) Limited |
| UOBKH     | UOB Kay Hian Securities (Thailand) Public Company Limited |
| YLG       | YLG Bullion & Futures Co., Ltd. |
| YUANTA    | Yuanta Securities (Thailand) Company Limited |

---

## 4. Margin rates (must be maintained by Admin)

**Source authority:** Thailand Clearing House (TCH), under set.or.th.

- Entry page: `https://www.set.or.th/en/tch/rules-regulations/regulations#noti-margin-rate`
- TFEX margin index: `https://www.tfex.co.th/en/market-data/news-and-notice/margin`
- TFEX margin simulator (loads rates client-side): `https://www.tfex.co.th/en/education/pricing-calculator/margin`

**Why not seeded:** TCH publishes margin as a percentage of contract value,
re-based **daily** from the latest settlement price. Baking a point-in-time
percentage into the seed would go stale immediately and violate §54 (do not
store values that must remain live as if they were static). These are left
`NULL` and must be entered by the Admin from the TCH notice / margin page.

**Where it goes:** `instrument_contract_specs.initial_margin_rate_bps` and
`maintenance_margin_rate_bps` (basis points, 1% = 100 bps). Effective leverage
is then `10_000 / initial_margin_rate_bps`.

---

## 5. Broker commission (must be maintained by Admin)

**Source authority:** each broker's own fee schedule. TFEX only publishes the
*exchange* fee schedule — `https://media.tfex.co.th/tfex/Documents/2023/Mar/ExchangeFees31102022EN.pdf` —
which is not the broker's client commission.

- Commission is **broker-specific**, often tiered by volume and
  account/negotiation, and many brokers do not publish a public flat rate.
- Therefore `broker_contract_terms.commission` is **not** bulk-seeded with
  guessed figures. The Admin must enter each broker's fee from that broker's
  official fee schedule (e.g. its website).

**Where it goes:** `broker_contract_terms` (per broker × instrument family),
with fee components `commission`, `trading_fee`, `clearing_fee`,
`regulatory_fee`, `vat`, `other_fee` in integer satang.

---

## 6. Data-integrity rules applied (AGENTS.md §54)

- Only exchange-fixed values (broker list, multiplier, tick) are seeded.
- Margin rates and broker commissions are left empty where a stale or
  guessed value would be worse than none.
- `Capital flow ≠ trading performance`; margin and commission are recording
  defaults, never a rewrite of imported broker statements.