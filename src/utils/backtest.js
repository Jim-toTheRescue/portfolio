/**
 * 回测工具函数
 * 支持3种回测逻辑：
 * 1. fixed_weight: 固定权重 + 定期调仓
 * 2. fixed_shares: 固定股数（你的实际持仓）
 * 3. decision: 期末权重决策 + 固定股数（按期初价算出）
 */

export function runBacktest(positions, cash, klineData, startDate, endDate, exchangeRates, cashCurrency, options = {}) {
  const {
    strategy = 'fixed_shares',
    rebalancePeriod = 'monthly'
  } = options;

  if (!positions || positions.length === 0) {
    return { error: '没有持仓数据' };
  }

  if (!klineData || Object.keys(klineData).length === 0) {
    return { error: '没有K线数据' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: '日期格式错误' };
  }

  if (start >= end) {
    return { error: '开始日期必须早于结束日期' };
  }

  let result;
  if (strategy === 'fixed_weight') {
    result = buildFixedWeightReturns(positions, cash, klineData, start, end, exchangeRates, cashCurrency, rebalancePeriod);
  } else if (strategy === 'decision') {
    result = buildDecisionReturns(positions, cash, klineData, start, end, exchangeRates, cashCurrency);
  } else {
    result = buildFixedSharesReturns(positions, cash, klineData, start, end, exchangeRates, cashCurrency);
  }

  if (result.dailyData.length < 2) {
    return { error: '数据不足，无法计算' };
  }

  const stats = calculateStats(result.dailyData);

  const lastNav = result.dailyData[result.dailyData.length - 1].nav;
  const baseNav = 100;

  const positionsWithContribution = result.endWeights.map((w, i) => {
    const initWeight = result.initWeights[i]?.weight || 0;
    const initValue = baseNav * initWeight;
    const endValue = lastNav * w.weight;
    const contribution = endValue - initValue;

    return {
      symbol: w.symbol,
      name: positions.find(p => p.symbol === w.symbol)?.name || w.symbol,
      shares: positions.find(p => p.symbol === w.symbol)?.shares || result.initShares?.[w.symbol] || 0,
      avgCost: positions.find(p => p.symbol === w.symbol)?.avgCost || 0,
      initWeight,
      endWeight: w.weight,
      contribution
    };
  });

  const totalContribution = positionsWithContribution.reduce((sum, p) => sum + p.contribution, 0);

  return {
    dailyData: result.dailyData,
    stats,
    startDate: startDate,
    endDate: endDate,
    strategy,
    rebalancePeriod: strategy === 'fixed_weight' ? rebalancePeriod : null,
    positions: positionsWithContribution,
    cashInitWeight: result.initWeights[result.initWeights.length - 1]?.weight || 0,
    cashEndWeight: result.endWeights[result.endWeights.length - 1]?.weight || 0,
    totalContribution
  };
}

function parseSymbolCurrency(symbol) {
  const suffix = symbol.split('.').pop().toUpperCase();
  const map = { US: 'USD', HK: 'HKD', SH: 'CNY', SZ: 'CNY' };
  return { currency: map[suffix] || 'USD' };
}

function convertToCurrency(value, fromCurrency, toCurrency, exchangeRates) {
  if (fromCurrency === toCurrency) return value;
  const fromRate = exchangeRates[fromCurrency] || 1;
  const toRate = exchangeRates[toCurrency] || 1;
  return value * (toRate / fromRate);
}

function getAllDates(klineData) {
  const allDates = new Set();
  Object.values(klineData).forEach(records => {
    records.forEach(r => {
      const date = r.date.split('T')[0];
      allDates.add(date);
    });
  });
  return Array.from(allDates).sort();
}

function shouldRebalance(dateStr, lastRebalanceDate, period) {
  if (!lastRebalanceDate) return true;

  const current = new Date(dateStr);
  const last = new Date(lastRebalanceDate);

  if (period === 'daily') return true;

  if (period === 'weekly') {
    const daysSinceLast = (current - last) / (24 * 60 * 60 * 1000);
    return daysSinceLast >= 7;
  }

  if (period === 'monthly') {
    return current.getMonth() !== last.getMonth() || current.getFullYear() !== last.getFullYear();
  }

  if (period === 'quarterly') {
    const currentQuarter = Math.floor(current.getMonth() / 3);
    const lastQuarter = Math.floor(last.getMonth() / 3);
    return currentQuarter !== lastQuarter || current.getFullYear() !== last.getFullYear();
  }

  if (period === 'semi_annual') {
    const currentHalf = Math.floor(current.getMonth() / 6);
    const lastHalf = Math.floor(last.getMonth() / 6);
    return currentHalf !== lastHalf || current.getFullYear() !== last.getFullYear();
  }

  if (period === 'annual') {
    return current.getFullYear() !== last.getFullYear();
  }

  return false;
}

/**
 * 逻辑1: 固定权重 + 定期调仓
 * 用期末价决定目标权重，按期初价算出初始股数，定期调仓维持目标权重
 */
function buildFixedWeightReturns(positions, cash, klineData, startDate, endDate, exchangeRates, cashCurrency, rebalancePeriod) {
  const dailyData = [];
  const sortedDates = getAllDates(klineData);
  
  const positionMap = {};
  positions.forEach(p => {
    positionMap[p.symbol] = {
      shares: p.shares || 0,
      avgCost: p.avgCost || 0,
      currency: parseSymbolCurrency(p.symbol).currency
    };
  });

  const positionSymbols = new Set(positions.map(p => p.symbol));

  const matchedData = {};
  for (const [symbol, records] of Object.entries(klineData)) {
    if (positionSymbols.has(symbol)) {
      matchedData[symbol] = {};
      records.forEach(r => {
        const date = r.date.split('T')[0];
        matchedData[symbol][date] = r;
      });
    }
  }

  const firstDate = sortedDates.find(dateStr => new Date(dateStr) >= startDate);
  const lastDate = sortedDates[sortedDates.length - 1];

  if (!firstDate) {
    return { dailyData: [], endWeights: [], initWeights: [], initShares: {} };
  }

  const endPrices = {};
  for (const symbol of positionSymbols) {
    if (matchedData[symbol] && matchedData[symbol][lastDate]) {
      endPrices[symbol] = matchedData[symbol][lastDate].close;
    }
  }

  const firstPrices = {};
  for (const symbol of positionSymbols) {
    if (matchedData[symbol] && matchedData[symbol][firstDate]) {
      firstPrices[symbol] = matchedData[symbol][firstDate].close;
    }
  }

  const cashInCurrency = convertToCurrency(cash || 0, cashCurrency, cashCurrency, exchangeRates);

  let totalStockValue = 0;
  for (const symbol of positionSymbols) {
    const price = endPrices[symbol];
    const shares = positionMap[symbol].shares;
    if (price && shares > 0) {
      const value = shares * price;
      const currency = positionMap[symbol].currency;
      totalStockValue += convertToCurrency(value, currency, cashCurrency, exchangeRates);
    }
  }
  const totalAssets = totalStockValue + cashInCurrency;

  const targetWeights = [];
  for (const symbol of positionSymbols) {
    const price = endPrices[symbol];
    const shares = positionMap[symbol].shares;
    if (price && shares > 0) {
      const value = shares * price;
      const currency = positionMap[symbol].currency;
      const convertedValue = convertToCurrency(value, currency, cashCurrency, exchangeRates);
      targetWeights.push({
        symbol,
        weight: convertedValue / totalAssets
      });
    }
  }
  targetWeights.push({ symbol: '__CASH__', weight: cashInCurrency / totalAssets });

  const initWeights = [...targetWeights];
  
  const baseAmount = 100;
  const baseTotal = baseAmount;
  
  const cashAmountInit = baseTotal * (cashInCurrency / totalAssets);
  
  const initShares = {};
  for (const w of targetWeights) {
    if (w.symbol === '__CASH__') continue;
    const price = firstPrices[w.symbol];
    if (price) {
      initShares[w.symbol] = (baseTotal - cashAmountInit) * w.weight / price;
    }
  }

  let cashAmount = cashAmountInit;
  let stockShares = { ...initShares };
  let lastRebalanceDate = null;

  let currentNav = baseAmount;
  let prevPrices = {};
  let todayPrices = {};
  let isFirstDay = true;

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr);

    if (date < startDate) {
      prevPrices = {};
      for (const symbol of positionSymbols) {
        if (matchedData[symbol] && matchedData[symbol][dateStr]) {
          prevPrices[symbol] = matchedData[symbol][dateStr].close;
        }
      }
      continue;
    }

    if (date > endDate) break;

    const todayPrices = {};
    for (const symbol of positionSymbols) {
      if (matchedData[symbol] && matchedData[symbol][dateStr]) {
        todayPrices[symbol] = matchedData[symbol][dateStr].close;
      } else if (prevPrices[symbol]) {
        todayPrices[symbol] = prevPrices[symbol];
      }
    }

    if (Object.keys(prevPrices).length > 0) {
      if (isFirstDay || shouldRebalance(dateStr, lastRebalanceDate, rebalancePeriod)) {
        let totalValue = cashAmount;
        for (const symbol of positionSymbols) {
          const price = todayPrices[symbol] || prevPrices[symbol];
          if (price) {
            totalValue += (stockShares[symbol] || 0) * price;
          }
        }

        const stockValue = totalValue - cashAmount;
        for (const symbol of positionSymbols) {
          const targetWeight = targetWeights.find(w => w.symbol === symbol)?.weight || 0;
          const price = todayPrices[symbol] || prevPrices[symbol];
          if (price && stockValue > 0) {
            stockShares[symbol] = stockValue * targetWeight / price;
          }
        }

        lastRebalanceDate = dateStr;
        isFirstDay = false;
      }

      let totalTodayValue = cashAmount;
      for (const symbol of positionSymbols) {
        const price = todayPrices[symbol] || prevPrices[symbol];
        if (price) {
          totalTodayValue += (stockShares[symbol] || 0) * price;
        }
      }

      let dailyReturn = 0;
      if (currentNav > 0) {
        dailyReturn = (totalTodayValue - currentNav) / currentNav;
      }

      const weights = [];
      for (const symbol of positionSymbols) {
        const price = todayPrices[symbol] || prevPrices[symbol];
        const value = (stockShares[symbol] || 0) * (price || 0);
        weights.push({ symbol, weight: totalTodayValue > 0 ? value / totalTodayValue : 0 });
      }
      weights.push({ symbol: 'CASH', weight: totalTodayValue > 0 ? cashAmount / totalTodayValue : 0 });

      currentNav = totalTodayValue;

      dailyData.push({
        date: dateStr,
        nav: currentNav,
        dailyReturn: dailyReturn,
        cumulativeReturn: (currentNav - baseAmount) / baseAmount,
        weights
      });
    }

    prevPrices = { ...todayPrices };
  }

  const lastDayData = dailyData[dailyData.length - 1];
  const endWeights = lastDayData ? lastDayData.weights : [];

  return { dailyData, endWeights, initWeights, initShares };
}

/**
 * 逻辑2: 固定股数（你的实际持仓）
 */
function buildFixedSharesReturns(positions, cash, klineData, startDate, endDate, exchangeRates, cashCurrency) {
  const dailyData = [];
  const sortedDates = getAllDates(klineData);

  const positionMap = {};
  positions.forEach(p => {
    positionMap[p.symbol] = {
      shares: p.shares || 0,
      avgCost: p.avgCost || 0,
      currency: parseSymbolCurrency(p.symbol).currency
    };
  });

  const positionSymbols = new Set(positions.map(p => p.symbol));

  const matchedData = {};
  for (const [symbol, records] of Object.entries(klineData)) {
    if (positionSymbols.has(symbol)) {
      matchedData[symbol] = {};
      records.forEach(r => {
        const date = r.date.split('T')[0];
        matchedData[symbol][date] = r;
      });
    }
  }

  const firstDate = sortedDates.find(dateStr => new Date(dateStr) >= startDate);

  if (!firstDate) {
    return { dailyData: [], endWeights: [], initWeights: [], initShares: {} };
  }

  const cashInCurrency = convertToCurrency(cash || 0, cashCurrency, cashCurrency, exchangeRates);

  let totalFirstValue = 0;
  const initShares = {};
  for (const symbol of positionSymbols) {
    const records = matchedData[symbol];
    if (records && records[firstDate]) {
      const price = records[firstDate].close;
      const shares = positionMap[symbol].shares;
      initShares[symbol] = shares;
      const currency = positionMap[symbol].currency;
      totalFirstValue += convertToCurrency(shares * price, currency, cashCurrency, exchangeRates);
    }
  }
  totalFirstValue += cashInCurrency;

  const initWeights = [];
  for (const symbol of positionSymbols) {
    const shares = initShares[symbol] || 0;
    const records = matchedData[symbol];
    if (records && records[firstDate]) {
      const price = records[firstDate].close;
      const value = shares * price;
      const currency = positionMap[symbol].currency;
      const convertedValue = convertToCurrency(value, currency, cashCurrency, exchangeRates);
      initWeights.push({ symbol, weight: convertedValue / totalFirstValue });
    }
  }
  initWeights.push({ symbol: '__CASH__', weight: cashInCurrency / totalFirstValue });

  const baseNav = 100;
  const cashAmount = cashInCurrency;

  let currentNav = baseNav;
  let prevPrices = {};
  let todayPrices = {};

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr);

    if (date < startDate) {
      prevPrices = {};
      for (const symbol of positionSymbols) {
        if (matchedData[symbol] && matchedData[symbol][dateStr]) {
          prevPrices[symbol] = matchedData[symbol][dateStr].close;
        }
      }
      continue;
    }

    if (date > endDate) break;

    todayPrices = {};
    for (const symbol of positionSymbols) {
      if (matchedData[symbol] && matchedData[symbol][dateStr]) {
        todayPrices[symbol] = matchedData[symbol][dateStr].close;
      }
    }

    if (Object.keys(prevPrices).length > 0) {
      let totalTodayValue = cashAmount;
      for (const symbol of positionSymbols) {
        totalTodayValue += (initShares[symbol] || 0) * todayPrices[symbol];
      }

      const todayNav = baseNav * totalTodayValue / totalFirstValue;
      let dailyReturn = 0;
      if (currentNav > 0) {
        dailyReturn = (todayNav - currentNav) / currentNav;
      }

      const weights = [];
      for (const symbol of positionSymbols) {
        const value = (initShares[symbol] || 0) * todayPrices[symbol];
        weights.push({ symbol, weight: value / totalTodayValue });
      }
      weights.push({ symbol: 'CASH', weight: cashAmount / totalTodayValue });

      currentNav = todayNav;

      dailyData.push({
        date: dateStr,
        nav: currentNav,
        dailyReturn: dailyReturn,
        cumulativeReturn: (currentNav - baseNav) / baseNav,
        weights
      });
    }

    prevPrices = { ...todayPrices };
  }

  const endWeights = [];
  let totalEndValue = cashAmount;
  for (const symbol of positionSymbols) {
    totalEndValue += (initShares[symbol] || 0) * todayPrices[symbol];
  }
  for (const symbol of positionSymbols) {
    const value = (initShares[symbol] || 0) * todayPrices[symbol];
    endWeights.push({ symbol, weight: value / totalEndValue });
  }
  endWeights.push({ symbol: 'CASH', weight: cashAmount / totalEndValue });

  return { dailyData, endWeights, initWeights, initShares };
}

/**
 * 逻辑3: 决策回测
 * 用期末价决定目标权重，按期初价算出固定股数，不调仓
 */
function buildDecisionReturns(positions, cash, klineData, startDate, endDate, exchangeRates, cashCurrency) {
  const dailyData = [];
  const sortedDates = getAllDates(klineData);

  const positionMap = {};
  positions.forEach(p => {
    positionMap[p.symbol] = {
      shares: p.shares || 0,
      avgCost: p.avgCost || 0,
      currency: parseSymbolCurrency(p.symbol).currency
    };
  });

  const positionSymbols = new Set(positions.map(p => p.symbol));

  const matchedData = {};
  for (const [symbol, records] of Object.entries(klineData)) {
    if (positionSymbols.has(symbol)) {
      matchedData[symbol] = {};
      records.forEach(r => {
        const date = r.date.split('T')[0];
        matchedData[symbol][date] = r;
      });
    }
  }

  const firstDate = sortedDates.find(dateStr => new Date(dateStr) >= startDate);
  const lastDate = sortedDates[sortedDates.length - 1];

  if (!firstDate) {
    return { dailyData: [], endWeights: [], initWeights: [], initShares: {} };
  }

  const endPrices = {};
  for (const symbol of positionSymbols) {
    if (matchedData[symbol] && matchedData[symbol][lastDate]) {
      endPrices[symbol] = matchedData[symbol][lastDate].close;
    }
  }

  const firstPrices = {};
  for (const symbol of positionSymbols) {
    if (matchedData[symbol] && matchedData[symbol][firstDate]) {
      firstPrices[symbol] = matchedData[symbol][firstDate].close;
    }
  }

  const cashInCurrency = convertToCurrency(cash || 0, cashCurrency, cashCurrency, exchangeRates);

  let totalEndStockValue = 0;
  for (const symbol of positionSymbols) {
    const price = endPrices[symbol];
    const shares = positionMap[symbol].shares;
    if (price && shares > 0) {
      const value = shares * price;
      const currency = positionMap[symbol].currency;
      totalEndStockValue += convertToCurrency(value, currency, cashCurrency, exchangeRates);
    }
  }
  const totalEndAssets = totalEndStockValue + cashInCurrency;

  const targetWeights = [];
  for (const symbol of positionSymbols) {
    const price = endPrices[symbol];
    const shares = positionMap[symbol].shares;
    if (price && shares > 0) {
      const value = shares * price;
      const currency = positionMap[symbol].currency;
      const convertedValue = convertToCurrency(value, currency, cashCurrency, exchangeRates);
      targetWeights.push({
        symbol,
        weight: convertedValue / totalEndAssets
      });
    }
  }
  targetWeights.push({ symbol: '__CASH__', weight: cashInCurrency / totalEndAssets });

  let totalFirstStockValue = 0;
  for (const symbol of positionSymbols) {
    const price = firstPrices[symbol];
    const shares = positionMap[symbol].shares;
    if (price && shares > 0) {
      const value = shares * price;
      const currency = positionMap[symbol].currency;
      totalFirstStockValue += convertToCurrency(value, currency, cashCurrency, exchangeRates);
    }
  }
  const totalFirstAssets = totalFirstStockValue + cashInCurrency;

  const initWeights = [];
  for (const symbol of positionSymbols) {
    const price = firstPrices[symbol];
    const shares = positionMap[symbol].shares;
    if (price && shares > 0) {
      const value = shares * price;
      const currency = positionMap[symbol].currency;
      const convertedValue = convertToCurrency(value, currency, cashCurrency, exchangeRates);
      initWeights.push({ symbol, weight: convertedValue / totalFirstAssets });
    }
  }
  initWeights.push({ symbol: '__CASH__', weight: cashInCurrency / totalFirstAssets });

  const baseNav = 100;
  const cashAmount = cashInCurrency;

  const initShares = {};
  for (const w of targetWeights) {
    if (w.symbol === '__CASH__') continue;
    const price = firstPrices[w.symbol];
    if (price) {
      initShares[w.symbol] = totalFirstAssets * w.weight / price;
    }
  }

  let currentNav = baseNav;
  let prevPrices = {};
  let todayPrices = {};

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr);

    if (date < startDate) {
      prevPrices = {};
      for (const symbol of positionSymbols) {
        if (matchedData[symbol] && matchedData[symbol][dateStr]) {
          prevPrices[symbol] = matchedData[symbol][dateStr].close;
        }
      }
      continue;
    }

    if (date > endDate) break;

    todayPrices = {};
    for (const symbol of positionSymbols) {
      if (matchedData[symbol] && matchedData[symbol][dateStr]) {
        todayPrices[symbol] = matchedData[symbol][dateStr].close;
      }
    }

    if (Object.keys(prevPrices).length > 0) {
      let totalTodayValue = cashAmount;
      for (const symbol of positionSymbols) {
        totalTodayValue += (initShares[symbol] || 0) * todayPrices[symbol];
      }

      const todayNav = baseNav * totalTodayValue / totalFirstAssets;
      let dailyReturn = 0;
      if (currentNav > 0) {
        dailyReturn = (todayNav - currentNav) / currentNav;
      }

      const weights = [];
      for (const symbol of positionSymbols) {
        const value = (initShares[symbol] || 0) * todayPrices[symbol];
        weights.push({ symbol, weight: value / totalTodayValue });
      }
      weights.push({ symbol: 'CASH', weight: cashAmount / totalTodayValue });

      currentNav = todayNav;

      dailyData.push({
        date: dateStr,
        nav: currentNav,
        dailyReturn: dailyReturn,
        cumulativeReturn: (currentNav - baseNav) / baseNav,
        weights
      });
    }

    prevPrices = { ...todayPrices };
  }

  const endWeights = [];
  let totalEndValue = cashAmount;
  for (const symbol of positionSymbols) {
    totalEndValue += (initShares[symbol] || 0) * todayPrices[symbol];
  }
  for (const symbol of positionSymbols) {
    const value = (initShares[symbol] || 0) * todayPrices[symbol];
    endWeights.push({ symbol, weight: value / totalEndValue });
  }
  endWeights.push({ symbol: 'CASH', weight: cashAmount / totalEndValue });

  return { dailyData, endWeights, initWeights, initShares };
}

function calculateStats(dailyData) {
  if (dailyData.length < 2) {
    return null;
  }

  const firstNav = dailyData[0].nav;
  const lastNav = dailyData[dailyData.length - 1].nav;

  const totalReturn = (lastNav - firstNav) / firstNav;

  const dailyReturns = dailyData.map(d => d.dailyReturn).filter(r => !isNaN(r) && isFinite(r));

  const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;

  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  const annualReturn = avgDailyReturn * 252;
  const annualVolatility = stdDev * Math.sqrt(252);

  const sharpeRatio = annualVolatility > 0 ? (annualReturn - 0.03) / annualVolatility : 0;

  let maxDrawdown = 0;
  let peak = firstNav;
  for (const d of dailyData) {
    if (d.nav > peak) {
      peak = d.nav;
    }
    const drawdown = (peak - d.nav) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const tradingDays = dailyData.length;
  const years = tradingDays / 252;
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

  const positiveDays = dailyReturns.filter(r => r > 0).length;
  const winRate = dailyReturns.length > 0 ? positiveDays / dailyReturns.length : 0;

  return {
    totalReturn: totalReturn * 100,
    annualizedReturn: annualizedReturn * 100,
    annualVolatility: annualVolatility * 100,
    sharpeRatio: sharpeRatio.toFixed(2),
    maxDrawdown: maxDrawdown * 100,
    maxNav: lastNav,
    tradingDays,
    winRate: winRate * 100
  };
}

export function formatStats(stats) {
  if (!stats) return [];

  return [
    { label: '总收益率', value: `${stats.totalReturn.toFixed(2)}%`, color: stats.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: '年化收益率', value: `${stats.annualizedReturn.toFixed(2)}%`, color: stats.annualizedReturn >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: '年化波动率', value: `${stats.annualVolatility.toFixed(2)}%`, color: 'inherit' },
    { label: '夏普比率', value: stats.sharpeRatio, color: parseFloat(stats.sharpeRatio) >= 1 ? 'var(--green)' : 'inherit' },
    { label: '最大回撤', value: `${stats.maxDrawdown.toFixed(2)}%`, color: 'var(--red)' },
    { label: '胜率', value: `${stats.winRate.toFixed(1)}%`, color: 'inherit' },
    { label: '交易天数', value: `${stats.tradingDays}`, color: 'inherit' }
  ];
}
