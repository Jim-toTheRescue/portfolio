import { TIER } from './constants.js';
import { getTargetTier } from './helpers.js';

export function autoRebalance(positions, total) {
  const DRIFT_THRESHOLD = 5;
  
  const needsRebalance = positions.some(p => {
    const percent = (p.value / total) * 100;
    const target = TIER[p.tier - 1].target;
    return Math.abs(percent - target) > DRIFT_THRESHOLD;
  });
  
  if (!needsRebalance) {
    return positions.map(p => ({ ...p }));
  }
  
  const originalPositions = positions.map(p => ({ ...p }));
  let iteration = 0;
  const maxIterations = 100;

  while (iteration < maxIterations) {
    iteration++;

    const working = originalPositions.map(p => ({
      symbol: p.symbol,
      p: p,
      percent: (p.value / total) * 100,
      targetTier: getTargetTier(p.value / total * 100),
      originalInBuffer: p.inBuffer
    }));

    working.sort((a, b) => {
      if (a.targetTier !== b.targetTier) return a.targetTier - b.targetTier;
      const aAlreadyInTarget = a.targetTier === a.p.tier;
      const bAlreadyInTarget = b.targetTier === b.p.tier;
      if (aAlreadyInTarget && !bAlreadyInTarget) return -1;
      if (!aAlreadyInTarget && bAlreadyInTarget) return 1;
      if (!aAlreadyInTarget && !bAlreadyInTarget) return b.percent - a.percent;
      if (aAlreadyInTarget && bAlreadyInTarget) {
        if (a.originalInBuffer !== b.originalInBuffer) {
          return a.originalInBuffer ? 1 : -1;
        }
        return b.percent - a.percent;
      }
      return 0;
    });

    const mainSlots = { 1: [], 2: [], 3: [] };
    const bufferSlots = { 1: [], 2: [], 3: [] };

    for (const pos of working) {
      const target = pos.targetTier;
      const current = pos.p.tier;
      const limit = TIER[target - 1].limit;
      const bufferLimit = TIER[target - 1].buffer;

      if (target === current) {
        if (mainSlots[target].length < limit) {
          pos.p.inBuffer = false;
          mainSlots[target].push(pos);
        } else if (pos.originalInBuffer && bufferLimit > 0) {
          pos.p.inBuffer = true;
          bufferSlots[target].push(pos);
        } else if (!pos.originalInBuffer && bufferLimit > 0 && bufferSlots[target].length < bufferLimit) {
          pos.p.inBuffer = true;
          bufferSlots[target].push(pos);
        } else {
          pos.p.inBuffer = false;
          mainSlots[target].push(pos);
        }
        } else {
          // 检查目标梯队是否满了（主位和缓冲位都满了）
          const targetFull = mainSlots[target].length >= limit && 
                            (bufferLimit === 0 || bufferSlots[target].length >= bufferLimit);
          
          if (!targetFull) {
            // 目标梯队有空位，正常进入
            if (mainSlots[target].length < limit) {
              pos.p.tier = target;
              pos.p.inBuffer = false;
              mainSlots[target].push(pos);
            } else if (bufferLimit > 0 && bufferSlots[target].length < bufferLimit) {
              pos.p.tier = target;
              pos.p.inBuffer = true;
              bufferSlots[target].push(pos);
            }
          } else {
            // 目标梯队满了，尝试放到次优梯队（target+1）
            let placed = false;
            const tryTier = target + 1;
            
            if (tryTier <= 3) {
              const tryLimit = TIER[tryTier - 1].limit;
              const tryBuffer = TIER[tryTier - 1].buffer;
              const tryFull = mainSlots[tryTier].length >= tryLimit && 
                             (tryBuffer === 0 || bufferSlots[tryTier].length >= tryBuffer);
              
              if (!tryFull) {
                if (mainSlots[tryTier].length < tryLimit) {
                  pos.p.tier = tryTier;
                  pos.p.inBuffer = false;
                  mainSlots[tryTier].push(pos);
                } else if (tryBuffer > 0 && bufferSlots[tryTier].length < tryBuffer) {
                  pos.p.tier = tryTier;
                  pos.p.inBuffer = true;
                  bufferSlots[tryTier].push(pos);
                }
                placed = true;
              }
            }
            
            if (!placed) {
            pos.p.tier = current;
            pos.p.inBuffer = false;
            mainSlots[current].push(pos);
          }
        }
      }
    }

    for (let tier = 1; tier <= 3; tier++) {
      while (mainSlots[tier].length < TIER[tier - 1].limit && bufferSlots[tier].length > 0) {
        const pos = bufferSlots[tier].shift();
        if (pos.originalInBuffer) {
          continue;
        }
        pos.p.inBuffer = false;
        pos.p.tier = tier;
        mainSlots[tier].push(pos);
      }
    }

    let allStable = true;
    for (const pos of working) {
      if (pos.p.tier !== pos.targetTier) {
        allStable = false;
        break;
      }
    }

    if (allStable) {
      break;
    }
  }

  return originalPositions.map(p => ({ ...p }));
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

  if (button === '=') {
    const targetPercent = TIER[tier - 1].target / 100;
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
    if (nextTier < 1 || nextTier > 3) return 0;

    const targetPercent = TIER[nextTier - 1].target / 100;
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
    const limit = 35;
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
    const limit = TIER[0].min;
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
    const limit = TIER[1].min;
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
    const limit = TIER[2].min;
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

        if (newPercent > TIER[2].max) continue;

        const diff = newPercent - limit;

        if (diff >= 0 && diff < minDiffOver) {
          minDiffOver = diff;
          bestShares = s;
        }
      }
      shares = bestShares > 0 ? bestShares : 1;
    }
  } else if (button === 'max2') {
    const limit = 25;
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
    const limit = 15;
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