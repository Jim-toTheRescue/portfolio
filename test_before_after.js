// 修复前后的代码对比

// ============ 修复前 ============

// 1. initShares 计算
const initShares_before = {};
for (const w of targetWeights) {
  if (w.symbol === '__CASH__') continue;
  const price = firstPrices[w.symbol];
  if (price) {
    initShares_before[w.symbol] = baseTotal * w.weight / price;  // BUG: baseTotal 包含了现金部分
  }
}

let cashAmount_before = baseTotal * (cashInCurrency / totalAssets);

// 2. 调仓逻辑
if (shouldRebalance) {
  let totalValue = cashAmount_before;
  for (const symbol of positionSymbols) {
    const price = todayPrices[symbol] || prevPrices[symbol];
    if (price) {
      totalValue += (stockShares[symbol] || 0) * price;
    }
  }

  for (const symbol of positionSymbols) {
    const targetWeight = targetWeights.find(w => w.symbol === symbol)?.weight || 0;
    const price = todayPrices[symbol] || prevPrices[symbol];
    if (price && totalValue > 0) {
      stockShares[symbol] = totalValue * targetWeight / price;  // BUG: 把现金也算进 totalValue
    }
  }
  cashAmount_before = totalValue * (targetWeights.find(w => w.symbol === '__CASH__')?.weight || 0);  // BUG: 现金被重新计算
}


// ============ 修复后 ============

// 1. initShares 计算
const cashAmountInit = baseTotal * (cashInCurrency / totalAssets);

const initShares_after = {};
for (const w of targetWeights) {
  if (w.symbol === '__CASH__') continue;
  const price = firstPrices[w.symbol];
  if (price) {
    initShares_after[w.symbol] = (baseTotal - cashAmountInit) * w.weight / price;  // 正确：减去现金部分
  }
}

let cashAmount_after = cashAmountInit;

// 2. 调仓逻辑
if (shouldRebalance) {
  let totalValue = cashAmount_after;
  for (const symbol of positionSymbols) {
    const price = todayPrices[symbol] || prevPrices[symbol];
    if (price) {
      totalValue += (stockShares[symbol] || 0) * price;
    }
  }

  const stockValue = totalValue - cashAmount_after;  // 正确：只取股票部分
  for (const symbol of positionSymbols) {
    const targetWeight = targetWeights.find(w => w.symbol === symbol)?.weight || 0;
    const price = todayPrices[symbol] || prevPrices[symbol];
    if (price && stockValue > 0) {
      stockShares[symbol] = stockValue * targetWeight / price;  // 正确：用股票部分分配
    }
  }
  // cashAmount_after 保持不变
}
