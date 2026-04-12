import { useState, useEffect, useCallback } from 'react';
import { getPortfolio, updatePositions, updateCash as saveCashToStorage, updateHistory, updatePriceTime, updateConfig } from '../utils/manfolio';
import { getConfig } from '../utils/constants';
import { totalWithCash, getTargetTier, getUpperLimit } from '../utils/helpers';
import { autoRebalance, makeLog, calculateShares } from '../utils/portfolio';

export function usePortfolio() {
  const [positions, setPositions] = useState([]);
  const [cash, setCash] = useState(0);
  const [history, setHistory] = useState([]);
  const [priceTime, setPriceTime] = useState(null);
  const [toast, setToast] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 显示Toast
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // 记录日志
  const log = (entry) => {
    setHistory((prev) => {
      const newHistory = [entry, ...prev].slice(0, 100);
      return newHistory;
    });
  };

  // 初始化
  useEffect(() => {
    const p = getPortfolio();
    if (p) {
      setPositions(p.positions || []);
      setCash(p.cash || 0);
      setHistory(p.history || []);
      setPriceTime(p.priceTime || null);
      setIsInitialized(true);
    }
  }, []);

  // 保存数据变化
  useEffect(() => {
    if (isInitialized) {
      updatePositions(positions);
    }
  }, [positions]);

  useEffect(() => {
    if (isInitialized) {
      saveCashToStorage(cash);
    }
  }, [cash]);

  useEffect(() => {
    if (isInitialized) {
      updateHistory(history);
    }
  }, [history]);

  useEffect(() => {
    if (isInitialized) {
      updatePriceTime(priceTime);
    }
  }, [priceTime]);

  // 统一触发 autoRebalance
  useEffect(() => {
    if (positions.length > 0) {
      const rebalanced = autoRebalance(positions, totalWithCash(positions, cash));
      if (JSON.stringify(rebalanced) !== JSON.stringify(positions)) {
        // 记录梯队变动
        rebalanced.forEach((newPos) => {
          const oldPos = positions.find(p => p.symbol === newPos.symbol);
          if (oldPos && (oldPos.tier !== newPos.tier || oldPos.inBuffer !== newPos.inBuffer)) {
            const action = oldPos.tier > newPos.tier 
              ? `晋级 T${oldPos.tier}→T${newPos.tier}`
              : `降级 T${oldPos.tier}→T${newPos.tier}`;
            log(makeLog('rebalance', newPos.symbol, newPos.name, action, 0, newPos.shares, newPos.price, oldPos.tier, newPos.tier));
          }
        });
        setPositions(rebalanced);
      }
    }
  }, [positions, cash]);

  // 辅助函数
  const roundCurrency = (value) => Math.round(value * 100) / 100;

  // 建仓
  const addPosition = useCallback((symbol, name, shares, price) => {
    const cost = shares * price;
    const total = totalWithCash(positions, cash);
    if (cost > cash) {
      showToast('资金不足');
      return false;
    }

    const existing = positions.find((p) => p.symbol === symbol);
    let shouldUseBuffer = false;
    if (!existing && total > 0) {
      const newPercent = (cost / total) * 100;
      const lastTier = getConfig().length;
      const maxNewPercent = getUpperLimit(lastTier);
      if (newPercent > maxNewPercent) {
        showToast(`单笔超过${maxNewPercent}%将跳级，请减少股数`);
        return false;
      }
      const lastTierMainCount = positions.filter(p => p.tier === lastTier && !p.inBuffer).length;
      const lastTierConfig = getConfig()[lastTier - 1];
      if (lastTierMainCount >= lastTierConfig.limit) {
        const lastTierBufferCount = positions.filter(p => p.tier === lastTier && p.inBuffer).length;
        if (lastTierBufferCount < lastTierConfig.buffer) {
          let freeSlots = 0;
          for (let t = 1; t < lastTier; t++) {
            const tConfig = getConfig()[t - 1];
            const tMainCount = positions.filter(p => p.tier === t && !p.inBuffer).length;
            freeSlots += Math.max(0, tConfig.limit - tMainCount);
          }
          if (freeSlots <= 0) {
            showToast(`第${lastTier}梯队已满`);
            return false;
          }
          shouldUseBuffer = true;
        } else {
          showToast(`第${lastTier}梯队已满`);
          return false;
        }
      }
    }

    if (existing && total > 0) {
      const newValue = existing.value + cost;
      const newPercent = (newValue / total) * 100;
      const existingUpperLimit = getUpperLimit(existing.tier);
      if (newPercent > existingUpperLimit) {
        showToast(`持仓超过${existingUpperLimit}%将跳级，请减少股数`);
        return false;
      }
    }

    let newPositions;
    let newCash;

    if (existing) {
      const ns = existing.shares + shares;
      const nc = existing.shares * existing.avgCost + cost;
      newPositions = positions.map((p) =>
        p.symbol === symbol
          ? {
              ...p,
              shares: ns,
              avgCost: roundCurrency(nc / ns),
              price,
              value: roundCurrency(ns * price),
              tier: p.tier,
              inBuffer: p.inBuffer
            }
          : p
      );
      newCash = roundCurrency(cash - cost);
    } else {
      newPositions = [
        ...positions,
        {
          symbol,
          name: name || symbol,
          shares,
          avgCost: price,
          price,
          value: roundCurrency(shares * price),
          tier: getConfig().length,
          inBuffer: shouldUseBuffer,
          priceChange: 0
        }
      ];
      newCash = roundCurrency(cash - cost);
      log(
        makeLog(
          'buy',
          symbol,
          name || symbol,
          '建仓',
          shares,
          shares,
          price,
          0,
          3
        )
      );
    }

    setPositions(newPositions);
    setCash(newCash);
    return true;
  }, [positions, cash, log, showToast]);

  // 调仓
  const adjustPosition = useCallback((symbol, adjShares, isAdd) => {
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) return false;

    const cost = adjShares * pos.price;
    const total = totalWithCash(positions, cash);
    const newValue = pos.value + cost;
    const newPercent = (newValue / total) * 100;

    const newTier = getTargetTier(newPercent);
    const currentTier = pos.tier;

    let newPositions, newCash;

    if (isAdd) {
      if (cost > cash) {
        showToast('资金不足');
        return false;
      }

      if (newTier >= 1 && newTier <= getConfig().length) {
        const upperLimit = getUpperLimit(newTier);
        if (newPercent > upperLimit) {
          showToast('超出上限' + upperLimit + '%');
          return false;
        }
        // 只有晋级时才检查目标梯队是否已满
        if (newTier !== currentTier) {
          const mainCount = positions.filter(p => p.tier === newTier && !p.inBuffer).length;
          const bufferCount = positions.filter(p => p.tier === newTier && p.inBuffer).length;
          const tierConfig = getConfig()[newTier - 1];
          if (mainCount >= tierConfig.limit) {
            if (bufferCount < tierConfig.buffer) {
              // 检查缓冲位可用性：更高梯队主位空位之和
              let freeSlots = 0;
              for (let t = 1; t < newTier; t++) {
                const tConfig = getConfig()[t - 1];
                const tMainCount = positions.filter(p => p.tier === t && !p.inBuffer).length;
                freeSlots += Math.max(0, tConfig.limit - tMainCount);
              }
              if (freeSlots <= 0) {
                showToast('目标梯队已满');
                return false;
              }
            } else {
              showToast('目标梯队已满');
              return false;
            }
          }
        }
      }

      const ns = pos.shares + adjShares;
      const nc = pos.shares * pos.avgCost + cost;
      const finalVal = roundCurrency(ns * pos.price);
      newPositions = positions.map((p) =>
        p.symbol === symbol
          ? {
              ...p,
              shares: ns,
              avgCost: roundCurrency(nc / ns),
              value: finalVal,
              tier: p.tier,
              inBuffer: p.inBuffer
            }
          : p
      );
      newCash = roundCurrency(cash - cost);
      setPositions(newPositions);
      setCash(newCash);
      log(
        makeLog(
          'adj',
          symbol,
          pos.name,
          '加仓',
          adjShares,
          ns,
          pos.price,
          pos.tier,
          pos.tier
        )
      );
    } else {
      const ns = pos.shares - adjShares;

      if (ns <= 0) {
        newPositions = positions.filter((p) => p.symbol !== symbol);
        newCash = roundCurrency(cash + pos.value);
        log(
          makeLog(
            'sell',
            symbol,
            pos.name,
            '清仓',
            adjShares,
            0,
            pos.price,
            pos.tier,
            0
          )
        );
      } else {
        newPositions = positions.map((p) =>
          p.symbol === symbol
            ? {
                ...p,
                shares: ns,
                value: roundCurrency(ns * pos.price)
              }
            : p
        );
        newCash = roundCurrency(cash + cost);
        log(
          makeLog(
            'adj',
            symbol,
            pos.name,
            '减仓',
            adjShares,
            ns,
            pos.price,
            pos.tier,
            pos.tier
          )
        );
      }
      setPositions(newPositions);
      setCash(newCash);
    }
    return true;
  }, [positions, cash, log, showToast]);

  // 清仓
  const clearPosition = useCallback((symbol) => {
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) return false;

    const newPositions = positions.filter((p) => p.symbol !== symbol);
    const newCash = roundCurrency(cash + pos.value);

    setPositions(newPositions);
    setCash(newCash);
    log(makeLog('clear', pos.symbol, pos.name, '清仓', pos.shares, 0, pos.price, pos.tier, 0));
    return true;
  }, [positions, cash, log]);

  // 校正现金（不记录日志）
  const fixCash = useCallback((newCash) => {
    setCash(roundCurrency(newCash));
    saveCashToStorage(roundCurrency(newCash));
  }, []);

  // 出入金（记录日志）
  const moveCash = useCallback((newCash) => {
    const oldCash = cash;
    const diff = newCash - oldCash;
    setCash(roundCurrency(newCash));
    saveCashToStorage(roundCurrency(newCash));
    
    if (diff !== 0) {
      const action = diff > 0 ? '入金' : '出金';
      log(makeLog('cash', '-', '-', action, Math.abs(diff), roundCurrency(newCash), 0, 0, 0));
    }
  }, [cash]);

  // 刷新价格
  const refreshPrices = useCallback(async () => {
    if (positions.length === 0) {
      showToast('暂无持仓');
      return;
    }

    const symbols = positions.map((p) => `us${p.symbol}`).join(',');
    const url = `https://qt.gtimg.cn/q=${symbols}`;

    try {
      const response = await fetch(url);
      const text = await response.text();
      const stocks = text.split(';');
      let updated = false;
      let priceTime = null;

      const newPositions = [...positions];

      stocks.forEach((stockData) => {
        if (!stockData || stockData.indexOf('~') < 0) return;
        const fields = stockData.split('~');
        if (fields.length < 10) return;

        const symbol = fields[0].replace('v_us', '').toUpperCase();
        const price = parseFloat(fields[3]);
        const change = parseFloat(fields[31]);
        const timeStr = fields[30];

        if (timeStr && timeStr.length >= 19) {
          priceTime = timeStr.substring(0, 19);
        }

        if (!isNaN(price) && price > 0) {
          newPositions.forEach((p) => {
            if (p.symbol === symbol && price !== p.price) {
              p.price = price;
              p.priceChange = change;
              p.value = roundCurrency(p.shares * price);
              updated = true;
            }
          });
        }
      });

      if (priceTime) {
        setPriceTime(priceTime);
      }

      if (updated) {
        setPositions(newPositions);
        showToast('价格已更新');
      } else {
        showToast('价格未更新');
      }
    } catch (e) {
      showToast('获取价格失败');
    }
  }, [positions, showToast]);

  // 设置Mock价格
  const applyMockPrice = useCallback((prices) => {
    const newPositions = [...positions];
    const updated = [];

    Object.keys(prices).forEach((symbol) => {
      const pos = newPositions.find(
        (p) => p.symbol.toUpperCase() === symbol.toUpperCase()
      );
      if (pos) {
        const oldPrice = pos.price;
        pos.price = parseFloat(prices[symbol]);
        pos.priceChange = ((pos.price - oldPrice) / oldPrice * 100).toFixed(2);
        pos.value = roundCurrency(pos.shares * pos.price);
        updated.push(symbol);
      }
    });

    if (updated.length > 0) {
      setPositions(newPositions);
      setPriceTime(new Date().toLocaleString());
      showToast(`更新了 ${updated.length} 个股票价格`);
    } else {
      showToast('未找到匹配的持仓股票');
    }
  }, [positions, showToast]);

  // 导出数据
  const exportData = useCallback(() => {
    const exportData = {
      positions,
      cash,
      priceTime,
      history
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
  }, [positions, cash, priceTime, history, showToast]);

  // 导入数据
  const importData = useCallback((importedData) => {
    try {
      const data = importedData.data || importedData;
      const importedPositions = data.positions || [];
      const importedCash = data.cash || 0;

      setPositions(importedPositions);
      setCash(importedCash);
      setPriceTime(data.priceTime || null);

      if (importedData.history) {
        setHistory(importedData.history);
      }
      showToast('导入成功');
    } catch (err) {
      showToast(`导入失败: ${err.message}`);
    }
  }, [showToast]);

  // 清除历史
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // 获取推荐股数
  const getRecommendation = useCallback((symbol, tier, button, isAdd) => {
    const pos = positions.find(p => p.symbol === symbol);
    const price = pos ? pos.price : 0;
    const total = totalWithCash(positions, cash);
    return calculateShares({
      position: pos || { value: 0, tier: getConfig().length },
      price,
      total,
      tier: tier || getConfig().length,
      button,
      isAdd
    });
  }, [positions, cash]);

  // 计算总市值
  const stockValue = positions.reduce((sum, p) => sum + p.value, 0);
  const total = stockValue + cash;

  return {
    positions,
    cash,
    history,
    priceTime,
    toast,
    isInitialized,
    total,
    stockValue,
    addPosition,
    adjustPosition,
    clearPosition,
    fixCash,
    moveCash,
    refreshPrices,
    applyMockPrice,
    exportData,
    importData,
    clearHistory,
    getRecommendation,
    showToast
  };
}