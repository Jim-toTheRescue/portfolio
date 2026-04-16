# Portfolio Backtest Documentation

## Overview

This document describes the backtest functionality for portfolio analysis, supporting three different strategies:

1. **Fixed Weight + Rebalancing** (`fixed_weight`)
2. **Fixed Shares** (`fixed_shares`)
3. **Decision-based** (`decision`)

All backtests use a normalized NAV (Net Asset Value) starting at 100 for comparison purposes.

---

## Core Concepts

### Normalized NAV

- Backtests normalize all values to start at NAV = 100 for fair comparison
- Initial total assets are calculated based on actual holdings at the start date
- Daily NAV changes reflect portfolio value changes

### Base Amount

- `baseAmount = 100` is the normalized initial portfolio value
- Used to calculate normalized shares and track relative performance

### Cash Weight

- The actual cash proportion from your portfolio is preserved in the backtest
- This ensures fair comparison between strategies

---

## Strategy 1: Fixed Weight + Rebalancing

### Concept

Maintain target weights throughout the period by rebalancing periodically. The target weights are determined by the **end date** prices (as if you knew the future).

### Calculation Flow

```
1. Determine target weights based on end date prices:
   - Calculate each stock's value at end date using (shares × end_price)
   - totalAssets = sum(stock_values) + cash
   - targetWeight[i] = stock_value[i] / totalAssets

2. Calculate initial shares using start date prices:
   - stockCash = baseAmount × (1 - cashWeight)
   - initShares[symbol] = stockCash × targetWeight[symbol] / startPrice[symbol]

3. Rebalance on schedule (daily/weekly/monthly/etc):
   - Calculate total portfolio value
   - Recalculate shares to match target weights
   - Cash amount remains constant
```

### Key Points

- **Target weights are fixed** (based on end prices)
- **Shares change** during rebalancing
- **Cash amount is fixed** (not reinvested)
- More frequent rebalancing = more transactions = typically lower returns

### Example

```
Start: AAPL @ $100 (100 shares), Cash = $10,000
End: AAPL @ $200 (100 shares)
Target weight: 100% stocks
Init shares: baseAmount × 1.0 / $100 = 1.0 (normalized)

If monthly rebalancing:
- Month 1: AAPL @ $120 → sell shares to maintain weight
- Month 2: AAPL @ $150 → buy shares to maintain weight
...
- End: AAPL @ $200
```

---

## Strategy 2: Fixed Shares

### Concept

Buy and hold your actual shares without any rebalancing. This represents your actual portfolio behavior.

### Calculation Flow

```
1. Use actual shares from your portfolio:
   initShares[symbol] = positions[symbol].shares

2. Calculate total value at start date:
   totalFirstValue = Σ(shares[i] × startPrice[i]) + cash

3. Track daily without changes:
   - Shares never change
   - NAV = baseAmount × (currentValue / totalFirstValue)
```

### Key Points

- **Shares are fixed** to your actual holdings
- **No rebalancing** - completely passive
- Weights drift over time as prices change
- This is typically the **worst performing** strategy (no adjustment to winning stocks)

### Example

```
Start: AAPL 100 shares @ $100, Cash = $10,000
End: AAPL @ $200

Total return: +100% (on stock portion)
Cash return: 0%
Portfolio return ≈ +67% (weighted by initial allocation)
```

---

## Strategy 3: Decision-based

### Concept

Use end date weights to determine "ideal" allocation, then calculate shares based on **start date** prices. No rebalancing - just a one-time decision.

### Calculation Flow

```
1. Determine target weights based on end date (same as Strategy 1):
   - Calculate each stock's end value
   - totalAssets = sum(stock_values) + cash
   - targetWeight[i] = stock_value[i] / totalAssets

2. Calculate initial shares based on start date prices:
   initShares[symbol] = totalFirstAssets × targetWeight[symbol] / startPrice[symbol]

3. Hold without rebalancing:
   - Shares never change
   - Cash amount never changes
```

### Key Points

- **Target weights are fixed** (based on end prices)
- **Shares are fixed** (calculated once at start)
- **No rebalancing** - one-time allocation
- This represents "perfect foresight" allocation without transaction costs

### Example

```
Start: AAPL @ $100, MSFT @ $50
End: AAPL @ $200 (100% return), MSFT @ $50 (0% return)
Target: 100% AAPL, 0% MSFT

Init shares: 100% × baseAmount / $100 = 1.0 share of AAPL
Result: +100% (perfectly allocated to winner)
```

---

## Implementation Details

### Data Structure

```javascript
// Position input
positions = [
  { symbol: 'AAPL.US', shares: 100, avgCost: 150 },
  { symbol: 'MSFT.US', shares: 50, avgCost: 300 }
]

// Kline data format
klineData = {
  'AAPL.US': [
    { date: '2023-01-01T00:00:00', open: 100, high: 105, low: 99, close: 102, volume: 1000000 },
    ...
  ],
  'MSFT.US': [...]
}
```

### Date Handling

- All dates are normalized to `YYYY-MM-DD` format
- `firstDate` = first trading day >= startDate
- `lastDate` = last trading day <= endDate
- Missing price data: carry forward previous price

### Currency Conversion

```javascript
// Symbol suffix to currency mapping
const suffixMap = { US: 'USD', HK: 'HKD', SH: 'CNY', SZ: 'CNY' }

// Conversion formula
convertedValue = value × (targetRate / sourceRate)
```

### Rebalancing Logic

```javascript
shouldRebalance(dateStr, lastRebalanceDate, period) {
  if (period === 'daily') return true;
  if (period === 'weekly') return daysSince >= 7;
  if (period === 'monthly') return month changed;
  if (period === 'quarterly') return quarter changed;
  if (period === 'semi_annual') return half-year changed;
  if (period === 'annual') return year changed;
}
```

---

## Special Cases

### Stock Splits and Renames

**META/FB Issue:**
- FB was renamed to META on 2022-06-08 with a 10:1 split
- Data must be merged: FB data up to 2022-06-08, META data from 2022-06-09
- Solution: Filter FB data for dates < 2022-06-09, then drop duplicates keeping last

### Missing Data

- If a stock has no data for a date, use the previous available price
- If no previous price exists, skip that stock in calculations

### Date Range

- Backtest only includes dates where all stocks have data
- This may cause actual date range to be narrower than requested

---

## Statistics Calculated

| Metric | Formula | Description |
|--------|---------|-------------|
| Total Return | (finalNAV - 100) / 100 | Overall portfolio return |
| Annualized Return | (1 + totalReturn)^(252/tradingDays) - 1 | CAGR |
| Annual Volatility | std(dailyReturns) × √252 | Annualized standard deviation |
| Sharpe Ratio | (annualReturn - 0.03) / annualVolatility | Risk-adjusted return (assuming 3% risk-free rate) |
| Max Drawdown | max(peak - nav) / peak | Largest peak-to-trough decline |
| Win Rate | positiveDays / totalDays | Percentage of up days |

---

## Common Issues and Solutions

### Issue: Returns seem too low

**Check:** Are you using `lastDate` prices for end prices?
- Bug: Using the last date in the dataset instead of the backtest end date
- Fix: `endPrices[symbol] = matchedData[symbol][lastDate].close`

### Issue: Cash keeps changing

**Check:** Is `cashAmount` being recalculated during rebalancing?
- Bug: Cash was being reset to `totalValue × cashWeight`
- Fix: Cash amount should remain constant throughout backtest

### Issue: Init shares calculation is wrong

**Check:** Are you using the correct base for stock allocation?
- Bug: Using `baseTotal` instead of `(baseTotal - cashAmountInit)`
- Fix: `initShares[symbol] = (baseTotal - cashAmountInit) × weight / price`

---

## File Structure

```
/src/utils/backtest.js     # Core backtest logic
/src/components/BacktestPage.jsx    # UI component
/src/components/BacktestCharts.jsx # Chart components
/kline_data/kline_data.json        # Stock price data
/fetch_kline.py           # Data fetching script
```

## Usage Example

```javascript
import { runBacktest, formatStats } from './utils/backtest';

const result = runBacktest(
  positions,      // Your holdings
  cash,           // Your cash
  klineData,      // Price data
  '2023-01-01',   // Start date
  '2024-01-01',   // End date
  exchangeRates,  // Currency rates
  'USD',          // Cash currency
  {
    strategy: 'fixed_weight',  // or 'fixed_shares' or 'decision'
    rebalancePeriod: 'monthly' // only for fixed_weight
  }
);

console.log(result.stats);      // Performance metrics
console.log(result.dailyData);  // Daily NAV data
console.log(result.positions);  // Position breakdown
```
