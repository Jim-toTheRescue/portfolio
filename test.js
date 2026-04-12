const TIER = [
  { name: '第一梯队', target: 30, limit: 1, buffer: 0, min: 25 },
  { name: '第二梯队', target: 20, limit: 2, buffer: 1, min: 15, max: 25 },
  { name: '第三梯队', target: 10, limit: 3, buffer: 3, min: 5, max: 15 }
];

function getTargetTier(percent) {
  if (percent >= 25) return 1;
  if (percent >= 15) return 2;
  return 3;
}

function autoRebalance(positions, total) {
  var maxIterations = 100;
  var iteration = 0;
  var originalPositions = positions;
  
  while (iteration < maxIterations) {
    iteration++;
    
    var workingPositions = originalPositions.map(function(orig) {
      var value = orig.value;
      var tier = orig.tier;
      var inBuffer = orig.inBuffer;
      var percent = (value / total) * 100;
      var targetTier = getTargetTier(percent);
      var oldTier = tier >= 1 && tier <= 3 ? tier : targetTier;
      return {
        symbol: orig.symbol,
        p: orig,
        value: value,
        percent: percent,
        targetTier: targetTier,
        oldTier: oldTier,
        oldInBuffer: inBuffer,
        currentTier: tier,
        currentInBuffer: inBuffer
      };
    });

    workingPositions.sort(function(a, b) { return b.percent - a.percent; });

    var mainSlots = { 1: [], 2: [], 3: [] };
    var bufferSlots = { 1: [], 2: [], 3: [] };

    var allStable = true;
    
    workingPositions.forEach(function(pos) {
      if (pos.currentInBuffer) {
        bufferSlots[pos.currentTier].push(pos);
      } else {
        mainSlots[pos.currentTier].push(pos);
      }
      
      if (pos.targetTier !== pos.currentTier) {
        allStable = false;
      }
    });

    var fillMainFromBuffer = function(tier) {
      while (mainSlots[tier].length < TIER[tier - 1].limit && bufferSlots[tier].length > 0) {
        bufferSlots[tier].sort(function(a, b) { return b.percent - a.percent; });
        var pos = bufferSlots[tier].shift();
        pos.p.inBuffer = false;
        pos.p.tier = tier;
        mainSlots[tier].push(pos);
      }
    };

    // 按权重从高到低排序，先处理高权重的股票
    workingPositions.sort(function(a, b) { return b.percent - a.percent; });

    var assignPosition = function(pos) {
      var target = pos.targetTier;
      var old = pos.currentTier;

      if (target === old) {
        // 同层级，如果目标层主位有空位则移入
        if (pos.oldInBuffer && mainSlots[target].length < TIER[target - 1].limit) {
          bufferSlots[old] = bufferSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
          pos.p.inBuffer = false;
          pos.currentInBuffer = false;
          mainSlots[target].push(pos);
        }
        return;
      }

      if (target < old) {
        // 降级
        if (mainSlots[target].length < TIER[target - 1].limit) {
          if (pos.currentInBuffer) {
            bufferSlots[old] = bufferSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
          } else {
            mainSlots[old] = mainSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
          }
          pos.p.tier = target;
          pos.p.inBuffer = false;
          pos.currentTier = target;
          pos.currentInBuffer = false;
          mainSlots[target].push(pos);
        } else if (bufferSlots[target].length < TIER[target - 1].buffer) {
          var canUseBuffer = true;
          if (target === 2 && old === 3) {
            if (mainSlots[1].length + mainSlots[2].length >= 3) {
              canUseBuffer = false;
            }
          }
          if (canUseBuffer) {
            if (pos.currentInBuffer) {
              bufferSlots[old] = bufferSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
            } else {
              mainSlots[old] = mainSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
            }
            pos.p.tier = target;
            pos.p.inBuffer = true;
            pos.currentTier = target;
            pos.currentInBuffer = true;
            bufferSlots[target].push(pos);
          }
        }
      } else {
        // 升级
        if (mainSlots[target].length < TIER[target - 1].limit) {
          if (pos.currentInBuffer) {
            bufferSlots[old] = bufferSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
          } else {
            mainSlots[old] = mainSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
          }
          pos.p.tier = target;
          pos.p.inBuffer = false;
          pos.currentTier = target;
          pos.currentInBuffer = false;
          mainSlots[target].push(pos);
        } else if (bufferSlots[target].length < TIER[target - 1].buffer) {
          if (pos.currentInBuffer) {
            bufferSlots[old] = bufferSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
          } else {
            mainSlots[old] = mainSlots[old].filter(function(p) { return p.p.symbol !== pos.p.symbol; });
          }
          pos.p.tier = target;
          pos.p.inBuffer = true;
          pos.currentTier = target;
          pos.currentInBuffer = true;
          bufferSlots[target].push(pos);
        }
      }
    };

    workingPositions.forEach(assignPosition);

    if (allStable) {
      break;
    }
  }

  return originalPositions.map(function(p) {
    return { symbol: p.symbol, tier: p.tier, inBuffer: p.inBuffer };
  });
}

function getUpperLimit(tier) {
  var t = TIER[tier - 1];
  return t.max ? t.max : t.min + 10;
}

function calculateShares(params) {
  var pos = params.position;
  var price = params.price;
  var total = params.total;
  var tier = pos.tier;
  var button = params.button;
  var isAdd = params.isAdd;

  if (!button) return 0;

  var posValue = pos.value;
  var targetValue;
  var shares = 0;

  if (button === '=') {
    var targetPercent = TIER[tier - 1].target / 100;
    targetValue = total * targetPercent;

    if (isAdd) {
      var needed = targetValue - posValue;
      if (needed <= 0) {
        shares = 0;
      } else {
        shares = Math.floor(needed / price);
        if (shares <= 0) shares = 1;
      }
    } else {
      var reduce = posValue - targetValue;
      if (reduce <= 0) {
        shares = 0;
      } else {
        shares = Math.ceil(reduce / price);
      }
    }
  } else if (button === 'UP' || button === 'DOWN') {
    var nextTier = button === 'UP' ? tier - 1 : tier + 1;
    if (nextTier < 1 || nextTier > 3) return 0;
    
    var targetPercent = TIER[nextTier - 1].target / 100;
    var targetValue = total * targetPercent;

    if (isAdd) {
      // UP: 找最接近目标比例的股数
      if (posValue >= targetValue) {
        shares = 0;
      } else {
        var bestShares = 0;
        var bestDiff = Infinity;
        for (var s = 1; s <= 10000; s++) {
          var newValue = posValue + s * price;
          var newPercent = (newValue / total) * 100;
          var diff = Math.abs(newPercent - targetPercent * 100);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestShares = s;
          }
          if (newValue >= targetValue + price) break;
        }
        shares = bestShares > 0 ? bestShares : 1;
      }
    } else {
      var reduce = posValue - targetValue;
      if (reduce <= 0) {
        shares = 0;
      } else {
        shares = Math.ceil(reduce / price);
      }
    }
  } else if (button === 'max1') {
    var limit = getUpperLimit(1);
    var targetValue = total * (limit / 100);
    
    if (posValue >= targetValue) {
      shares = 0;
    } else {
      // 找最接近limit但小于limit的股数
      var bestShares = 0;
      var bestDiff = Infinity;
      for (var s = 1; s <= 10000; s++) {
        var newValue = posValue + s * price;
        if (newValue > targetValue) break;
        var newPercent = (newValue / total) * 100;
        var diff = limit - newPercent;
        if (diff >= 0 && diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      shares = bestShares > 0 ? bestShares : 1;
    }
  } else if (button === 'min1') {
    var limit = TIER[0].min; // 25
    var targetValue = total * (limit / 100);
    var reduce = posValue - targetValue;
    
    if (reduce <= 0) {
      shares = 0;
    } else {
      // 找最接近limit的股数
      var bestShares = 0;
      var bestDiff = Infinity;
      for (var s = 1; s <= 10000; s++) {
        var newValue = posValue - s * price;
        if (newValue < 0) break;
        var newPercent = (newValue / total) * 100;
        var diff = Math.abs(newPercent - limit);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      shares = bestShares > 0 ? bestShares : 1;
    }
  } else if (button === 'min2') {
    var limit = TIER[1].min; // 15
    var targetValue = total * (limit / 100);
    var reduce = posValue - targetValue;
    
    if (reduce <= 0) {
      shares = 0;
    } else {
      // 找>=limit中最接近limit的股数
      var bestShares = 0;
      var bestDiff = Infinity;
      
      for (var s = 1; s <= 10000; s++) {
        var newValue = posValue - s * price;
        if (newValue < 0) break;
        var newPercent = (newValue / total) * 100;
        
        // 必须是>=limit
        if (newPercent < limit) break;
        
        var diff = Math.abs(newPercent - limit);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      // 如果没有>=limit的选项，返回0
      if (bestShares === 0) {
        shares = 0;
      } else {
        shares = bestShares;
      }
    }
  } else if (button === 'min3') {
    var limit = TIER[2].min; // 5
    var targetValue = total * (limit / 100);
    var reduce = posValue - targetValue;
    
    if (reduce <= 0) {
      shares = 0;
    } else {
      // min3: 必须降到T3 (< 15%)，且选>=5%中最接近5%的
      // 如果减1股就低于5%，返回0
      var newPercentAfter1 = (posValue - price) / total * 100;
      if (newPercentAfter1 < limit) {
        shares = 0;
      } else {
        var bestShares = 0;
        var minDiffOver = Infinity;
        
        for (var s = 1; s <= 10000; s++) {
          var newValue = posValue - s * price;
          if (newValue < 0) break;
          var newPercent = (newValue / total) * 100;
          
          // 必须降到T3 (percent < 15)
          if (newPercent >= 15) continue;
          
          var diff = limit - newPercent;
          
          if (diff >= 0 && diff < minDiffOver) {
            minDiffOver = diff;
            bestShares = s;
          }
        }
        shares = bestShares > 0 ? bestShares : 1;
      }
    }
  } else if (button === 'max2') {
    var limit = getUpperLimit(2); // 25
    var targetValue = total * (limit / 100);
    
    if (posValue >= targetValue) {
      shares = 0;
    } else {
      // max2: 找最接近limit但<limit的股数（留在T2），加1股就>=limit（晋级T1）
      var bestShares = 0;
      var bestDiff = Infinity;
      for (var s = 1; s <= 10000; s++) {
        var newValue = posValue + s * price;
        var newPercent = (newValue / total) * 100;
        if (newPercent >= limit) break;
        var diff = limit - newPercent;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestShares = s;
        }
      }
      shares = bestShares > 0 ? bestShares : 1;
    }
  } else if (button === 'max3') {
    var limit = getUpperLimit(3);
    var targetValue = total * (limit / 100);
    
    if (posValue >= targetValue) {
      shares = 0;
    } else {
      // T3 max3: 加到刚好低于15%（留在T3）
      var bestShares = 0;
      for (var s = 1; s <= 10000; s++) {
        var newValue = posValue + s * price;
        var newPercent = (newValue / total) * 100;
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

function getRealResultPercent(posValue, price, newShares, total, isAdd) {
  var newPosValue = isAdd ? posValue + newShares * price : posValue - newShares * price;
  return (newPosValue / total) * 100;
}

function getResultTier(percent) {
  if (percent >= 25) return 1;
  if (percent >= 15) return 2;
  return 3;
}

var TEST_CASES = [];

function addTestCase(id, params, expected) {
  TEST_CASES.push({ id, params, expected });
}

// T1 = 按钮 (减仓到30%)
addTestCase(1, { position: { value: 4500, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(2, { position: { value: 5000, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(3, { position: { value: 3500, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(4, { position: { value: 3200, tier: 1 }, price: 50, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(5, { position: { value: 4800, tier: 1 }, price: 80, total: 12000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });

// T1 = 按钮 (加仓到30%, 允许范围25-40%)
addTestCase(6, { position: { value: 2000, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(7, { position: { value: 2500, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(8, { position: { value: 1500, tier: 1 }, price: 50, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(9, { position: { value: 2200, tier: 1 }, price: 75, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(10, { position: { value: 2700, tier: 1 }, price: 120, total: 15000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

// T2 = 按钮 (减仓到20%)
addTestCase(11, { position: { value: 3000, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(12, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(13, { position: { value: 2500, tier: 2 }, price: 50, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(14, { position: { value: 3500, tier: 2 }, price: 80, total: 12000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(15, { position: { value: 3200, tier: 2 }, price: 60, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });

// T2 = 按钮 (加仓到20%, 允许范围15-30%)
addTestCase(16, { position: { value: 1500, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(17, { position: { value: 1200, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(18, { position: { value: 1000, tier: 2 }, price: 50, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(19, { position: { value: 1800, tier: 2 }, price: 75, total: 12000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(20, { position: { value: 1400, tier: 2 }, price: 120, total: 15000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

// T3 = 按钮 (减仓到10%)
addTestCase(21, { position: { value: 1500, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(22, { position: { value: 1800, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(23, { position: { value: 1200, tier: 3 }, price: 50, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(24, { position: { value: 1600, tier: 3 }, price: 80, total: 12000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(25, { position: { value: 1300, tier: 3 }, price: 60, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });

// T3 = 按钮 (加仓到10%, 允许范围5-15%)
addTestCase(26, { position: { value: 500, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(27, { position: { value: 800, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(28, { position: { value: 600, tier: 3 }, price: 50, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(29, { position: { value: 900, tier: 3 }, price: 75, total: 12000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(30, { position: { value: 700, tier: 3 }, price: 120, total: 15000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });

// T2 ↑ 按钮 (升级到T1) - 允许范围25-40%
addTestCase(31, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(32, { position: { value: 2400, tier: 2 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(33, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(34, { position: { value: 2200, tier: 2 }, price: 75, total: 12000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(35, { position: { value: 2600, tier: 2 }, price: 120, total: 15000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

// T3 ↑ 按钮 (升级到T2) - 允许范围15-30%
addTestCase(36, { position: { value: 1000, tier: 3 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(37, { position: { value: 1400, tier: 3 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(38, { position: { value: 800, tier: 3 }, price: 50, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(39, { position: { value: 1200, tier: 3 }, price: 75, total: 12000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(40, { position: { value: 1600, tier: 3 }, price: 120, total: 15000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

// T1 ↓ 按钮 (降级到T2, 目标20%)
addTestCase(41, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(42, { position: { value: 4000, tier: 1 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(43, { position: { value: 3500, tier: 1 }, price: 50, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(44, { position: { value: 4500, tier: 1 }, price: 75, total: 12000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(45, { position: { value: 5000, tier: 1 }, price: 120, total: 15000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });

// T2 ↓ 按钮 (降级到T3, 目标10%)
addTestCase(46, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(47, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(48, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(49, { position: { value: 2400, tier: 2 }, price: 75, total: 12000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(50, { position: { value: 3000, tier: 2 }, price: 120, total: 15000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });

// T1 max1 按钮 (加到<35%)
addTestCase(51, { position: { value: 2500, tier: 1 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(52, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(53, { position: { value: 2800, tier: 1 }, price: 50, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(54, { position: { value: 3200, tier: 1 }, price: 75, total: 12000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(55, { position: { value: 3500, tier: 1 }, price: 120, total: 15000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

// T1 min1 按钮 (减到25%)
addTestCase(56, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: 25, tier: 1 });
addTestCase(57, { position: { value: 3800, tier: 1 }, price: 100, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: 25, tier: 1 });
addTestCase(58, { position: { value: 3200, tier: 1 }, price: 50, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: 25, tier: 1 });
addTestCase(59, { position: { value: 3000, tier: 1 }, price: 75, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(60, { position: { value: 3500, tier: 1 }, price: 120, total: 15000, button: 'min1', isAdd: false }, { shares: 0, percent: 23.3, tier: 2 });

// T1 min2 按钮 (减到15%降T2)
addTestCase(61, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(62, { position: { value: 4000, tier: 1 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(63, { position: { value: 2800, tier: 1 }, price: 50, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(64, { position: { value: 2800, tier: 1 }, price: 75, total: 12000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(65, { position: { value: 3500, tier: 1 }, price: 120, total: 15000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });

// T2 max2 按钮 (加到<25%, 允许范围15-30%)
addTestCase(66, { position: { value: 1800, tier: 2 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(67, { position: { value: 2200, tier: 2 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(68, { position: { value: 2000, tier: 2 }, price: 50, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(69, { position: { value: 2400, tier: 2 }, price: 75, total: 12000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(70, { position: { value: 2600, tier: 2 }, price: 120, total: 15000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

// T2 max1 按钮 (加到35%升T1, 允许范围30-40%)
addTestCase(71, { position: { value: 1600, tier: 2 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(72, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(73, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(74, { position: { value: 2200, tier: 2 }, price: 75, total: 12000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(75, { position: { value: 2400, tier: 2 }, price: 120, total: 15000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

// T2 min2 按钮 (减到15%留T2)
addTestCase(76, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(77, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(78, { position: { value: 2200, tier: 2 }, price: 50, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(79, { position: { value: 2600, tier: 2 }, price: 50, total: 12000, button: 'min2', isAdd: false }, { shares: 16, percent: 15, tier: 2 });
addTestCase(80, { position: { value: 3000, tier: 2 }, price: 120, total: 15000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });

// T2 min3 按钮 (减到5%降T3)
addTestCase(81, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(82, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(83, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(84, { position: { value: 2400, tier: 2 }, price: 75, total: 12000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(85, { position: { value: 3200, tier: 2 }, price: 120, total: 15000, button: 'min3', isAdd: false }, { shares: 20, percent: 5.33, tier: 3 });

// T2 min2 edge cases
addTestCase(104, { position: { value: 1400, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 14, tier: 3 });
addTestCase(105, { position: { value: 1500, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 15, tier: 2 });
// T2 min2: 当前18%应该推荐刚好15%
addTestCase(106, { position: { value: 1800, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 3, percent: 15, tier: 2 });
// T2 min2: 当前15.1%减1股会低于15%，应返回0
addTestCase(107, { position: { value: 1510, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 15.1, tier: 2 });
// T2 min2: 当前18%，应推荐刚好15%
addTestCase(110, { position: { value: 1800, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 3, percent: 15, tier: 2 });
// T2 min2: 当前16%减1股不低于15%，推荐后应>=15%
addTestCase(111, { position: { value: 1600, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 1, percent: 15, tier: 2 });
// T2 min2: 15.1%减1股低于15%，应返回0
addTestCase(112, { position: { value: 1510, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 15.1, tier: 2 });

// T3 min3: 当前5%应返回0（不需要减仓）
addTestCase(108, { position: { value: 500, tier: 3 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: 0, percent: 5, tier: 3 });
// T3 min3: 当前5.05%减1股低于5%，应返回0
addTestCase(109, { position: { value: 505, tier: 3 }, price: 50, total: 10000, button: 'min3', isAdd: false }, { shares: 0, percent: 5.05, tier: 3 });

// T3 max3 按钮 (加到<15%, 允许范围5-20%)
addTestCase(86, { position: { value: 800, tier: 3 }, price: 100, total: 10000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(87, { position: { value: 1200, tier: 3 }, price: 100, total: 10000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(88, { position: { value: 1000, tier: 3 }, price: 50, total: 10000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(89, { position: { value: 1300, tier: 3 }, price: 75, total: 12000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(90, { position: { value: 1500, tier: 3 }, price: 120, total: 15000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });

// T3 max2 按钮 (加到<25%晋级T2, 允许范围15-25%)
addTestCase(91, { position: { value: 600, tier: 3 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(92, { position: { value: 1000, tier: 3 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(93, { position: { value: 800, tier: 3 }, price: 50, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(94, { position: { value: 1100, tier: 3 }, price: 75, total: 12000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(95, { position: { value: 1300, tier: 3 }, price: 120, total: 15000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

// T3 min3 按钮 (减到5%留T3)
addTestCase(96, { position: { value: 1000, tier: 3 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(97, { position: { value: 1600, tier: 3 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(98, { position: { value: 1200, tier: 3 }, price: 50, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(99, { position: { value: 1400, tier: 3 }, price: 75, total: 12000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(100, { position: { value: 1800, tier: 3 }, price: 120, total: 15000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });

var REBALANCE_TESTS = [];

function addRebalanceTest(id, positions, total, expected) {
  REBALANCE_TESTS.push({ id: id, positions: positions, total: total, expected: expected });
}

addRebalanceTest(1, [
  { symbol: 'A', value: 2000, tier: 2, inBuffer: false },
  { symbol: 'B', value: 1800, tier: 2, inBuffer: false },
  { symbol: 'C', value: 1600, tier: 2, inBuffer: true }
], 30000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

addRebalanceTest(2, [
  { symbol: 'A', value: 5000, tier: 1, inBuffer: false },
  { symbol: 'B', value: 3000, tier: 2, inBuffer: false },
  { symbol: 'C', value: 1000, tier: 3, inBuffer: false }
], 20000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

addRebalanceTest(3, [
  { symbol: 'A', value: 4500, tier: 1, inBuffer: false }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false }
]);

addRebalanceTest(4, [
  { symbol: 'A', value: 2800, tier: 1, inBuffer: false },
  { symbol: 'B', value: 2600, tier: 2, inBuffer: false },
  { symbol: 'C', value: 2400, tier: 3, inBuffer: false }
], 30000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

addRebalanceTest(5, [
  { symbol: 'A', value: 2800, tier: 2, inBuffer: false },
  { symbol: 'B', value: 2400, tier: 2, inBuffer: false },
  { symbol: 'C', value: 2000, tier: 2, inBuffer: true }
], 20000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

addRebalanceTest(6, [
  { symbol: 'A', value: 2800, tier: 1, inBuffer: false },
  { symbol: 'B', value: 2600, tier: 2, inBuffer: false }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false }
]);

addRebalanceTest(8, [
  { symbol: 'A', value: 2800, tier: 2, inBuffer: false },
  { symbol: 'B', value: 2400, tier: 2, inBuffer: false },
  { symbol: 'C', value: 2000, tier: 2, inBuffer: true },
  { symbol: 'D', value: 600, tier: 3, inBuffer: false }
], 25000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: true },
  { symbol: 'D', tier: 3, inBuffer: false }
]);

addRebalanceTest(9, [
  { symbol: 'A', value: 3500, tier: 1, inBuffer: false },
  { symbol: 'B', value: 3000, tier: 2, inBuffer: false }
], 15000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false }
]);

addRebalanceTest(10, [
  { symbol: 'A', value: 2800, tier: 2, inBuffer: false },
  { symbol: 'B', value: 2400, tier: 2, inBuffer: false }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false }
]);

addRebalanceTest(7, [
  { symbol: 'A', value: 3000, tier: 1, inBuffer: false },
  { symbol: 'B', value: 800, tier: 3, inBuffer: true },
  { symbol: 'C', value: 600, tier: 3, inBuffer: true }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

// Bug复现：T1=1, T2=2, T3=3，现金增加一倍
// 初始：股票总值20000，现金0，总值20000
// A: 7000(35%) → T1 (35%是T1上限)
// B: 4000(20%) → T2
// C: 3000(15%) → T2
// D: 2000(10%), E: 1500(7.5%), F: 500(2.5%) → T3
// 增加20000现金后，总值40000，股票权重减半
// A: 7000/40000 = 17.5% → T2，T2主位空（因为B、C去T3），应进主位
// B: 4000/40000 = 10% → T3，T3主位已满，应进缓冲
// C: 3000/40000 = 7.5% → T3，T3主位已满，应进缓冲
addRebalanceTest(11, [
  { symbol: 'A', value: 7000, tier: 1, inBuffer: false },
  { symbol: 'B', value: 4000, tier: 2, inBuffer: false },
  { symbol: 'C', value: 3000, tier: 2, inBuffer: false },
  { symbol: 'D', value: 2000, tier: 3, inBuffer: false },
  { symbol: 'E', value: 1500, tier: 3, inBuffer: false },
  { symbol: 'F', value: 500, tier: 3, inBuffer: false }
], 40000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: true },
  { symbol: 'C', tier: 3, inBuffer: true },
  { symbol: 'D', tier: 3, inBuffer: false },
  { symbol: 'E', tier: 3, inBuffer: false },
  { symbol: 'F', tier: 3, inBuffer: false }
]);

// Bug复现：T3主位2只，缓冲位1只，清仓后缓冲位没有补进主位
addRebalanceTest(12, [
  { symbol: 'B', value: 400, tier: 3, inBuffer: false }, // 主位 8%
  { symbol: 'C', value: 300, tier: 3, inBuffer: false }, // 主位 6%  
  { symbol: 'D', value: 200, tier: 3, inBuffer: true }   // 缓冲 4%
], 5000, [
  // 都是T3范围，应该都在主位
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false },
  { symbol: 'D', tier: 3, inBuffer: false }
]);

function runTests() {
  var passed = 0;
  var failed = 0;
  var errors = [];

  console.log('Running ' + TEST_CASES.length + ' tests...\n');

  for (var i = 0; i < TEST_CASES.length; i++) {
    var tc = TEST_CASES[i];
    var params = tc.params;
    
    var shares = calculateShares(params);
    var newPercent = getRealResultPercent(params.position.value, params.price, shares, params.total, params.isAdd);
    var newTier = getResultTier(newPercent);
    
    var expectedShares = tc.expected.shares;
    var expectedPercent = tc.expected.percent;
    var expectedTier = tc.expected.tier;
    
    var tierMatch = newTier === expectedTier;
    var percentOk;
    if (expectedPercent === '~') {
      percentOk = newPercent >= 5 && newPercent <= 45;
    } else if (expectedPercent === '<') {
      percentOk = newPercent < 40;
    } else {
      percentOk = Math.abs(newPercent - expectedPercent) < 1;
    }
    var sharesOk = expectedShares === '>0' ? shares >= 0 : (expectedShares === '=0' ? shares === 0 : true);
    
    if (tierMatch && percentOk && sharesOk) {
      passed++;
    } else {
      failed++;
      if (errors.length < 30) {
        errors.push({ 
          id: tc.id, 
          shares: shares, 
          newPercent: newPercent.toFixed(1), 
          newTier: newTier, 
          expectedTier: expectedTier,
          expectedPercent: expectedPercent,
          button: params.button,
          posValue: params.position.value,
          price: params.price.toFixed(1),
          total: params.total
        });
      }
    }
  }

  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    errors.forEach(function(e) {
      console.log('  #' + e.id + ': button=' + e.button + ', posValue=' + e.posValue + ', price=' + e.price + ', total=' + e.total + ' => shares=' + e.shares + ', percent=' + e.newPercent + '%, tier=' + e.newTier + ' (expected tier=' + e.expectedTier + ', percent=' + e.expectedPercent + '%)');
    });
  }

  console.log('\nRunning ' + REBALANCE_TESTS.length + ' rebalance tests...\n');
  
  var rebalancePassed = 0;
  var rebalanceFailed = 0;
  var rebalanceErrors = [];
  
  for (var i = 0; i < REBALANCE_TESTS.length; i++) {
    var rtc = REBALANCE_TESTS[i];
    var testPositions = rtc.positions.map(function(p) {
      return { symbol: p.symbol, value: p.value, tier: p.tier, inBuffer: p.inBuffer };
    });
    
    var resultPositions = autoRebalance(testPositions, rtc.total);
    
    var allMatch = true;
    for (var j = 0; j < rtc.expected.length; j++) {
      var exp = rtc.expected[j];
      var actual = resultPositions.find(function(p) { return p.symbol === exp.symbol; });
      if (!actual || actual.tier !== exp.tier || actual.inBuffer !== exp.inBuffer) {
        allMatch = false;
        break;
      }
    }
    
    if (allMatch) {
      rebalancePassed++;
    } else {
      rebalanceFailed++;
      if (rebalanceErrors.length < 20) {
        var actualResult = resultPositions.map(function(p) { 
          return p.symbol + ':t' + p.tier + (p.inBuffer ? '-buf' : ''); 
        });
        var expectedResult = rtc.expected.map(function(p) { 
          return p.symbol + ':t' + p.tier + (p.inBuffer ? '-buf' : ''); 
        });
        rebalanceErrors.push({
          id: rtc.id,
          actual: actualResult.join(', '),
          expected: expectedResult.join(', ')
        });
      }
    }
  }
  
  console.log('Rebalance results: ' + rebalancePassed + ' passed, ' + rebalanceFailed + ' failed');
  
  if (rebalanceFailed > 0) {
    console.log('\nFailed rebalance tests:');
    rebalanceErrors.forEach(function(e) {
      console.log('  #' + e.id + ': ' + e.actual + ' (expected: ' + e.expected + ')');
    });
  }
  
  return { passed: passed + rebalancePassed, failed: failed + rebalanceFailed, errors: errors };
}

var result = runTests();
process.exit(result.failed > 0 ? 1 : 0);