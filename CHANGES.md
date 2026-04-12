# 代码修改记录

## 2026-04-12

### autoRebalance 统一触发机制

#### 问题

之前每个操作函数（addPosition/adjustPosition/clearPosition/refreshPrices等）都单独调用 autoRebalance，代码冗余且容易遗漏。导致：
1. 加仓后不能立即看到调整到正确位置
2. 刷新价格后需要手动调整
3. 修改现金后没有自动平衡

#### 修复方案

统一用 React useEffect 监听 `[positions, cash]` 变化，自动触发 autoRebalance：

```javascript
// 统一触发 autoRebalance
useEffect(() => {
  if (positions.length > 0) {
    const rebalanced = autoRebalance(positions, totalWithCash(positions, cash));
    if (JSON.stringify(rebalanced) !== JSON.stringify(positions)) {
      setPositions(rebalanced);
    }
  }
}, [positions, cash]);
```

关键点：
1. 只有当 rebalanced 结果与原数据不同时才更新 state，避免死循环
2. autoRebalance 内部加了 drift > 5% 阈值判断，和 alert 逻辑一致

#### 代码变更

- **usePortfolio.js**: 删除所有单独的 autoRebalance 调用，统一用 useEffect 触发
- **usePortfolio.js**: 添加 total 和 stockValue 到返回值，供组件使用

---

### 修复：TierCard percent 显示

#### 问题

```javascript
const percentRaw = total > 0 ? (position.value / total) * 100 : 0;
const percent = Math.floor(percentRaw * 100) / 100;  // 错误！
```

percentRaw 已经是百分比（如 44.02），不需要再乘100。导致显示为 0%。

#### 修复

```javascript
const percent = total > 0 ? (position.value / total * 100).toFixed(2) : '0.00';
```

---

### 修复：drift 显示箭头逻辑

#### 问题

drift 为 0 时显示 "0% ↑0.0%"，不应该显示箭头。

#### 修复

```javascript
{percent}% {drift !== 0 ? (drift >= 0 ? '↑' : '↓') + Math.abs(drift || 0).toFixed(1) + '%' : ''}
```

---

### 修复：priceChange toFixed 报错

#### 问题

priceChange 可能是字符串（如 "216.74"），直接调用 toFixed 报错。

#### 修复

```javascript
const priceChangeStr = priceChange !== 0 
  ? (priceChange > 0 ? '+' : '') + (Number(priceChange) || 0).toFixed(2) + '%' 
  : '';
```

---

### 修复：加仓保持原 tier

#### 问题

加仓后立即显示新股票进入主位（把原来的挤到buffer），刷新后才正确。

#### 原因

addPosition 函数在更新持仓时立即计算新的 tier，导致传给 autoRebalance 时 tier 已经是新值。

#### 修复

加仓时保持原来的 tier 和 inBuffer，让 autoRebalance 重新判断是否晋级。

```javascript
// 加仓时保持原 tier
newPositions = positions.map((p) =>
  p.symbol === symbol
    ? {
        ...p,
        shares: ns,
        value: finalVal,
        tier: p.tier,        // 保持原值
        inBuffer: p.inBuffer  // 保持原值
      }
    : p
);
```

---

### 用例设计指南（REBALANCE.md）

**真实数据场景**:
- 原始数据: NVDA 53股, value=9997.39, tier=3
- 加仓53股后: NVDA 106股, value=19994.78, tier保持3（不是自动计算的2）
- 传给autoRebalance: NVDA tier=3（加仓前的值）

**测试用例**:
```javascript
addRebalanceTest('ADD_NVDA', [
  { symbol: 'GOOG', value: 19890.36, tier: 2, inBuffer: false },
  { symbol: 'AAPL', value: 20056.96, tier: 2, inBuffer: false },
  { symbol: 'NVDA', value: 19994.78, tier: 3, inBuffer: false }
], 100000, [
  { symbol: 'GOOG', tier: 2, inBuffer: false },
  { symbol: 'AAPL', tier: 2, inBuffer: false },
  { symbol: 'NVDA', tier: 2, inBuffer: true }  // NVDA晋级进缓冲位
]);
```

---

### 修复：目标梯队满了的处理

#### 问题

当持仓的目标梯队主位和缓冲位都满了时，之前直接保持原 tier 不变。

例如：AAPL 占比 33%，目标 T1（已满），应该移到 T2，但之前仍留在 T3。

#### 修复

目标梯队满了时，尝试放到次优梯队（target + 1）：

```javascript
// 目标梯队满了，尝试放到次优梯队（target + 1）
if (targetFull) {
  const tryTier = target + 1;
  if (tryTier <= 3 && !tryFull) {
    pos.p.tier = tryTier;
    // 放入 tryTier 的主位或缓冲位
  }
}
```

示例：
- AAPL 占比 33%，目标 T1 已满 → 移到 T2
- GOOG 占比 28.2%，目标 T1 已满，T2 有空位 → 移到 T2

#### 术语说明

- T1、T2、T3 数字越小级别越高（T1 > T2 > T3）
- 为避免混淆，文档中用"移到"代替"升级"，例如"T3移到T2"而不是"T3升级到T2"