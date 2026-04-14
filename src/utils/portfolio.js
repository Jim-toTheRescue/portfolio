import { getConfig } from './constants.js';
import { getTargetTier, parseMarket, convertCurrency } from './helpers.js';

export function autoRebalance(positions, total, cashCurrency, exchangeRates) {
  const config = getConfig();
  
  // 检查是否需要 rebalance
  const needsRebalance = positions.some(p => {
    if (p.tier < 1 || p.tier > config.length) return false;
    const { currency } = parseMarket(p.symbol);
    const settleValue = convertCurrency(p.value, currency, cashCurrency, exchangeRates);
    const percent = (settleValue / total) * 100;
    const targetTier = getTargetTier(percent);
    return p.tier !== targetTier;
  });
  
  // 检查缓冲位 promote
  const hasBufferPromotion = positions.some(p => {
    if (!p.inBuffer) return false;
    const tierLimit = config[p.tier - 1].limit;
    const sameTierCount = positions.filter(sp => sp.tier === p.tier && !sp.inBuffer).length;
    return sameTierCount < tierLimit;
  });
  
  if (!needsRebalance && !hasBufferPromotion) {
    return positions.map(p => ({ ...p }));
  }

  // 简化算法：直接根据占比分配梯队
  const result = positions.map(p => {
    const { currency } = parseMarket(p.symbol);
    const settleValue = convertCurrency(p.value, currency, cashCurrency, exchangeRates);
    const percent = (settleValue / total) * 100;
    const targetTier = getTargetTier(percent);
    return { ...p, tier: targetTier };
  });

  // 按结算市值排序，分配主位/缓冲位
  for (const pos of result) {
    const { currency } = parseMarket(pos.symbol);
    pos._settleValue = convertCurrency(pos.value, currency, cashCurrency, exchangeRates);
  }
  result.sort((a, b) => b._settleValue - a._settleValue);
  
  const mainSlots = {};
  const bufferSlots = {};
  for (let i = 1; i <= config.length; i++) {
    mainSlots[i] = [];
    bufferSlots[i] = [];
  }
  
  // 第一步：分配主位
  const assignedToMain = new Set();
  for (const pos of result) {
    const limit = config[pos.tier - 1].limit;
    
    if (mainSlots[pos.tier].length < limit) {
      mainSlots[pos.tier].push(pos);
      pos.inBuffer = false;
      assignedToMain.add(pos.symbol);
    }
    // else: 主位满了，保持原 inBuffer 不变
  }
  
  // 第二步：计算每个 tier 的缓冲位可用数量 = 所有更高权重梯队的主位空位之和
  const bufferAvailable = {};
  for (let tier = 1; tier <= config.length; tier++) {
    let higherEmptySlots = 0;
    for (let higher = 1; higher < tier; higher++) {
      const limit = config[higher - 1].limit;
      higherEmptySlots += limit - mainSlots[higher].length;
    }
    bufferAvailable[tier] = Math.max(0, higherEmptySlots);
  }
  
  // 第三步：分配缓冲位（跳过已在主位的股票）
  for (const pos of result) {
    if (assignedToMain.has(pos.symbol)) continue;
    
    const available = bufferAvailable[pos.tier];
    
    if (available > 0 && bufferSlots[pos.tier].length < available) {
      bufferSlots[pos.tier].push(pos);
      pos.inBuffer = true;
    }
  }
  
  // 第四步：缓冲位 promote 到主位
  for (let tier = 1; tier <= config.length; tier++) {
    while (mainSlots[tier].length < config[tier - 1].limit && bufferSlots[tier].length > 0) {
      const pos = bufferSlots[tier].shift();
      pos.inBuffer = false;
      mainSlots[tier].push(pos);
    }
  }
  
  return result.map(p => {
    const { _settleValue, ...rest } = p;
    return rest;
  });
}

export function calculateShares(params) {
  const pos = params.position;
  const price = params.price;
  const total = params.total;
  const tier = pos.tier;
  const button = params.button;
  const isAdd = params.isAdd;

  if (!button) return 0;

  const posValue = pos.value;
  let targetValue;
  let shares = 0;

  if (tier < 1 || tier > getConfig().length) return 0;

  if (button === '=') {
    const targetPercent = getConfig()[tier - 1].target / 100;
    targetValue = total * targetPercent;

    if (isAdd) {
      const needed = targetValue - posValue;
      if (needed <= 0) {
        shares = 0;
      } else {
        shares = Math.floor(needed / price);
        if (shares <= 0) shares = 1;
      }
    } else {
      const reduce = posValue - targetValue;
      if (reduce <= 0) {
        shares = 0;
      } else {
        shares = Math.ceil(reduce / price);
      }
    }
  } else if (button === 'UP' || button === 'DOWN') {
    const nextTier = button === 'UP' ? tier - 1 : tier + 1;
    if (nextTier < 1 || nextTier > getConfig().length) return 0;

    const targetPercent = getConfig()[nextTier - 1].target / 100;
    targetValue = total * targetPercent;

    if (isAdd) {
      if (posValue >= targetValue) {
        shares = 0;
      } else {
        let bestShares = 0;
        let bestDiff = Infinity;
        for (let s = 1; s <= 10000; s++) {
          const newValue = posValue + s * price;
          const newPercent = (newValue / total) * 100;
          const diff = Math.abs(newPercent - targetPercent * 100);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestShares = s;
          }
          if (newValue >= targetValue + price) break;
        }
        shares = bestShares > 0 ? bestShares : 1;
      }
    } else {
      const reduce = posValue - targetValue;
      if (reduce <= 0) {
        shares = 0;
      } else {
        shares = Math.ceil(reduce / price);
      }
    }
  } else if (button === 'max1') {
    const limit = getConfig()[0].max;
    targetValue = total * (limit / 100);

    if (posValue >= targetValue) {
      shares = 0;
    } else {
      let bestShares = 0;
      let bestDiff = Infinity;
      for (let s = 1; s <= 10000; s++) {
        const newValue = posValue + s * price;
        if (newValue > targetValue) break;
        const newPercent = (newValue / total) * 100;
        const diff = limit - newPercent;
        if (diff >= 0 && diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      shares = bestShares > 0 ? bestShares : 1;
    }
  } else if (button === 'min1') {
    const limit = getConfig()[0].min;
    targetValue = total * (limit / 100);
    const reduce = posValue - targetValue;

    if (reduce <= 0) {
      shares = 0;
    } else {
      let bestShares = 0;
      let bestDiff = Infinity;
      for (let s = 1; s <= 10000; s++) {
        const newValue = posValue - s * price;
        if (newValue < 0) break;
        const newPercent = (newValue / total) * 100;
        const diff = Math.abs(newPercent - limit);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      shares = bestShares > 0 ? bestShares : 1;
    }
  } else if (button === 'min2') {
    const limit = getConfig()[1].min;
    targetValue = total * (limit / 100);
    const reduce = posValue - targetValue;

    if (reduce <= 0) {
      shares = 0;
    } else {
      let bestShares = 0;
      let bestDiff = Infinity;

      for (let s = 1; s <= 10000; s++) {
        const newValue = posValue - s * price;
        if (newValue < 0) break;
        const newPercent = (newValue / total) * 100;

        if (newPercent < limit) break;

        const diff = Math.abs(newPercent - limit);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      if (bestShares === 0) {
        shares = 0;
      } else {
        shares = bestShares;
      }
    }
  } else if (button === 'min3') {
    const config = getConfig();
    if (config.length >= 3) {
      const limit = config[2].min;
      const maxVal = config[2].max;
      targetValue = total * (limit / 100);
      const reduce = posValue - targetValue;

      if (reduce <= 0) {
        shares = 0;
      } else {
        let bestShares = 0;
        let minDiffOver = Infinity;

        for (let s = 1; s <= 10000; s++) {
          const newValue = posValue - s * price;
          if (newValue < 0) break;
          const newPercent = (newValue / total) * 100;

          if (newPercent > maxVal) continue;

          const diff = newPercent - limit;

          if (diff >= 0 && diff < minDiffOver) {
            minDiffOver = diff;
            bestShares = s;
          }
        }
        shares = bestShares > 0 ? bestShares : 1;
      }
    } else {
      shares = 0;
    }
  } else if (button === 'max2') {
    const limit = getConfig()[1].max;
    targetValue = total * (limit / 100);

    if (posValue >= targetValue) {
      shares = 0;
    } else {
      let bestShares = 0;
      let bestDiff = Infinity;
      for (let s = 1; s <= 10000; s++) {
        const newValue = posValue + s * price;
        const newPercent = (newValue / total) * 100;
        if (newPercent >= limit) break;
        const diff = limit - newPercent;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      shares = bestShares > 0 ? bestShares : 1;
    }
  } else if (button === 'max3') {
    const config = getConfig();
    if (config.length >= 3) {
      const limit = config[2].max;
      targetValue = total * (limit / 100);

      if (posValue >= targetValue) {
        shares = 0;
      } else {
        let bestShares = 0;
        for (let s = 1; s <= 10000; s++) {
          const newValue = posValue + s * price;
          const newPercent = (newValue / total) * 100;
          if (newPercent < limit) {
            bestShares = s;
          } else {
            break;
          }
        }
        shares = bestShares > 0 ? bestShares : 1;
      }
    } else {
      shares = 0;
    }
  }

  return shares;
}

export function makeLog(type, symbol, name, action, adjShares, totalShares, price, fromTier, toTier) {
  return {
    type,
    symbol,
    name,
    action,
    adjShares,
    totalShares,
    price,
    fromTier,
    toTier,
    time: new Date().toLocaleString()
  };
}

export function getResultTier(percent) {
  if (percent >= 25) return 1;
  if (percent >= 15) return 2;
  return 3;
}