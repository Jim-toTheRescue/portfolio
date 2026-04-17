import { useState, useEffect, useRef } from 'react';
import { getConfig, getTierConfig, getTopTierAllowBuy } from '../utils/constants';
import { getUpperLimit, getTargetTier, totalWithCash, detectMarket, toApiSymbol, parseMarket, convertCurrency, getCurrencySymbol } from '../utils/helpers';
import { calculateShares } from '../utils/portfolio';

// 新建仓位弹窗
function AddModal({ show, onClose, positions, cash, cashCurrency, onAdd, getRecommendation, displayCurrency, exchangeRates }) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('输入代码后自动获取');
  const [fetchedPrice, setFetchedPrice] = useState(0);
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState(0);
  const [costPercent, setCostPercent] = useState(0);
  const [warning, setWarning] = useState('');
  const [market, setMarket] = useState('US');
  const symbolInputRef = useRef(null);

  useEffect(() => {
    if (!show) {
      setSymbol('');
      setName('输入代码后自动获取');
      setFetchedPrice(0);
      setPrice('');
      setShares('');
      setCost(0);
      setCostPercent(0);
      setWarning('');
      setMarket('US');
    }
  }, [show]);

  const handleSymbolChange = (e) => {
    const value = e.target.value.trim().toUpperCase();
    setSymbol(value);
    
    // 自动识别市场
    const detectedMarket = detectMarket(value);
    setMarket(detectedMarket);
    
    if (!value) {
      setName('输入代码后自动获取');
      setFetchedPrice(0);
    }
  };

  const handleSymbolBlur = () => {
    if (symbol) {
      setName('获取中...');
      fetchQuote(symbol, market);
    }
  };

  const fetchQuote = async (code, detectedMarket) => {
    try {
      const apiSymbol = toApiSymbol(code, detectedMarket);
      const response = await fetch(`https://qt.gtimg.cn/q=${apiSymbol}`);
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('GBK');
      const text = decoder.decode(arrayBuffer);
      if (text && text.indexOf('~') > 0) {
        const fields = text.split('~');
        setName(fields[1] || code);
        setFetchedPrice(parseFloat(fields[3]));
      } else {
        setName('未找到');
      }
    } catch (e) {
      setName('获取失败');
    }
  };

  useEffect(() => {
    if (fetchedPrice > 0) {
      handleRecommend('target');
    }
  }, [fetchedPrice]);

  // 计算转换后的金额（转换为显示货币）
  const getDisplayCost = () => {
    if (!fetchedPrice || !shares) return null;
    const { currency } = parseMarket('.' + market);
    const converted = convertCurrency(cost, currency, displayCurrency, exchangeRates);
    const symbols = { USD: '$', HKD: 'hk$', CNY: '¥' };
    const symbol = symbols[displayCurrency] || '$';
    return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getRate = () => {
    const { currency } = parseMarket('.' + market);
    if (currency === displayCurrency) return null;
    const fromRate = exchangeRates[currency] || 1;
    const toRate = exchangeRates[displayCurrency] || 1;
    return (toRate / fromRate).toFixed(4);
  };

  const updateCost = (sharesVal) => {
    const sharesNum = parseInt(sharesVal) || 0;
    // 使用结算货币计算总价值（现金已经是结算货币）
    const totalSettleCash = cash;
    const totalPositionsValue = positions.reduce((sum, p) => {
      const { currency } = parseMarket(p.symbol);
      return sum + convertCurrency(p.value, currency, cashCurrency, exchangeRates);
    }, 0);
    const total = totalSettleCash + totalPositionsValue;
    const rawCostVal = sharesNum * fetchedPrice;
    const { currency } = parseMarket('.' + market);
    const costVal = convertCurrency(rawCostVal, currency, cashCurrency, exchangeRates);
    const percentValue = total > 0 ? (costVal / total) * 100 : 0;
    const percent = (Math.floor(percentValue * 100) / 100).toFixed(2);
    setCost(rawCostVal);
    setCostPercent(percent);
    
    const fullSymbol = symbol + '.' + market;
    const existing = positions.find(p => p.symbol === fullSymbol);
    if (existing) {
      setWarning('该股票已存在持仓，请使用加仓功能');
      return;
    }
    
    // 股票数检查（仅新建仓）
    const config = getConfig();
    const totalMainSlots = config.reduce((sum, t) => sum + t.limit, 0);
    if (positions.length >= totalMainSlots) {
      setWarning(`股票数已满${positions.length}/${totalMainSlots}`);
      return;
    }
    
    if (costVal > cash) {
      setWarning('资金不足');
    } else if (fetchedPrice > 0 && sharesNum > 0) {
      const newPercent = (costVal / total) * 100;
      
      const fullSymbol = symbol + '.' + market;
      const existing = positions.find(p => p.symbol === fullSymbol);
      
      if (existing) {
        const newValue = existing.value + costVal;
        const newValuePercent = (newValue / newTotal) * 100;
        const existingUpperLimit = getUpperLimit(existing.tier);
        if (newValuePercent > existingUpperLimit) {
          setWarning(`持仓超过${existingUpperLimit}%将跳级，请减少股数`);
        } else {
          setWarning('');
        }
      } else {
        // 新建仓检查（tier数字越小=越高梯队，maxTier=3表示只能买到第3梯队(最低)）
        const calculatedTier = getTargetTier(newPercent);
        const maxTier = getTopTierAllowBuy();
        // 如果计算的梯队高于允许的最高梯队，直接拦截
        if (calculatedTier < maxTier) {
          setWarning(`第${calculatedTier}梯队高于允许的第${maxTier}梯队，无法建仓`);
          return;
        }
        const targetTier = calculatedTier;
        
        const targetTierConfig = getConfig()[targetTier - 1];
        const maxNewPercent = getUpperLimit(targetTier);
        
        if (newPercent > maxNewPercent) {
          setWarning(`单笔超过${maxNewPercent}%将跳级，请减少股数`);
        } else {
          const targetTierMainCount = positions.filter(p => p.tier === targetTier && !p.inBuffer).length;
          
          let freeSlots = 0;
          for (let t = 1; t < targetTier; t++) {
            const tierConfig = getConfig()[t - 1];
            const tierMainCount = positions.filter(p => p.tier === t && !p.inBuffer).length;
            freeSlots += Math.max(0, tierConfig.limit - tierMainCount);
          }
          
          if (targetTierMainCount >= targetTierConfig.limit) {
            if (freeSlots <= 0) {
              setWarning(`第${targetTier}梯队已满`);
            } else {
              const targetTierBufferCount = positions.filter(p => p.tier === targetTier && p.inBuffer).length;
              if (targetTierBufferCount >= freeSlots) {
                setWarning(`第${targetTier}梯队缓冲位已满`);
              } else {
                setWarning('');
              }
            }
          } else {
            setWarning('');
          }
        }
      }
    } else {
      setWarning('');
    }
  };

  const handleSharesChange = (e) => {
    setShares(e.target.value);
    updateCost(e.target.value);
  };

  const handleRecommend = (type) => {
    if (fetchedPrice <= 0) return;
    // 使用结算货币计算总价值
    const totalSettleCash = cash;
    const totalPositionsValue = positions.reduce((sum, p) => {
      const { currency } = parseMarket(p.symbol);
      return sum + convertCurrency(p.value, currency, cashCurrency, exchangeRates);
    }, 0);
    const total = totalSettleCash + totalPositionsValue;
    const config = getConfig();
    const lastTierConfig = config[config.length - 1];
    const topTier = getTopTierAllowBuy();
    const topTierConfig = config[topTier - 1] || lastTierConfig;
    
    const price = fetchedPrice;
    const priceCurrency = market === 'US' ? 'USD' : market === 'HK' ? 'HKD' : 'CNY';
    let shares = 0;
    
    if (type === 'target') {
      // ↑：最后一个梯队 target
      const targetPercent = lastTierConfig.target;
      if (total <= 0 || price <= 0) {
        shares = 0;
      } else {
        const priceInSettle = convertCurrency(price, priceCurrency, cashCurrency, exchangeRates);
        const targetValue = total * targetPercent / 100;
        shares = Math.floor(targetValue / priceInSettle);
      }
    } else if (type === 'maxBuy') {
      // max：topTierAllowBuy 梯队的 target
      const maxPercent = topTierConfig.target;
      if (total <= 0 || price <= 0) {
        shares = 0;
      } else {
        const priceInSettle = convertCurrency(price, priceCurrency, cashCurrency, exchangeRates);
        const targetValue = total * maxPercent / 100;
        shares = Math.floor(targetValue / priceInSettle);
      }
    }
    
    setShares(shares > 0 ? shares.toString() : '');
    updateCost(shares > 0 ? shares : '');
  };

  const handleConfirm = () => {
    const sharesNum = parseInt(shares) || 0;
    const priceVal = parseFloat(price) || fetchedPrice;
    if (!symbol || sharesNum <= 0 || priceVal <= 0) return;
    if (warning) return;
    
    const fullSymbol = symbol + '.' + market;
    onAdd(fullSymbol, name, sharesNum, priceVal);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>建仓</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">快速选择</label>
            <div className="quick-buttons">
              {['GOOG', 'AAPL', 'NVDA', 'MSFT', 'AMZN', 'META', '00700', '300750', '600519'].map(s => (
                <button key={s} onClick={() => {
                  handleSymbolChange({ target: { value: s } });
                  symbolInputRef.current?.focus();
                }}>{s}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label"></label>
            <div style={{ color: '#666', fontSize: '12px' }}>
              最高建仓比例：{getConfig()[getTopTierAllowBuy() - 1]?.max || 15}%
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">股票代码 *</label>
            <input ref={symbolInputRef} className="form-input" value={symbol} onChange={handleSymbolChange} onBlur={handleSymbolBlur} placeholder="AAPL" />
          </div>
          <div className="form-group">
            <label className="form-label">名称</label>
            <div className="form-text">{name}</div>
          </div>
          <div className="form-group">
            <label className="form-label">股价</label>
            <input
              type="number"
              className="form-input"
              value={price.length == 0 ? fetchedPrice > 0 ? fetchedPrice.toString() : '' : price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={fetchedPrice > 0 ? fetchedPrice.toString() : '输入或默认实时价'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">股数 *</label>
            <div className="input-with-buttons">
              <input type="number" className="form-input" value={shares} onChange={handleSharesChange} placeholder="100" />
              <button onClick={() => handleRecommend('target')}>↑</button>
              <button onClick={() => handleRecommend('maxBuy')}>max</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">交易金额</label>
            <div className="cost-display">
              {market === 'SH' || market === 'SZ' ? '¥' : market === 'US' ? '$' : market === 'HK' ? 'hk$' : '$'}{(cost || 0).toLocaleString()} 
              {getDisplayCost() && (
                <span className="percent"> ≈ {getDisplayCost()}</span>
              )}
              <span className="percent"> ({costPercent || 0}%)</span>
            </div>
          </div>
          {warning && (
            <div className="form-group">
              <label className="form-label"></label>
              <div className="form-input form-warning">{warning}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>确认</button>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

function AddPositionModal({ show, onClose, position, positions, cash, cashCurrency, displayCurrency, exchangeRates, onAdjust, getRecommendation }) {
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState(0);
  const [costPercent, setCostPercent] = useState(0);
  const [newPercent, setNewPercent] = useState(0);
  const [newShares, setNewShares] = useState(0);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!show || !position) {
      setShares('');
      setPrice('');
      setWarning('');
    } else {
      setShares('');
      setPrice(position.price?.toString() || '');
      if (getRecommendation) {
        const tier = position.tier || 3;
        const button = tier >= 2 ? 'UP' : '=';
        const rec = getRecommendation(position.symbol, tier, button, true);
        if (rec > 0) {
          setShares(rec.toString());
        }
      }
    }
  }, [show, position]);

  useEffect(() => {
    if (position && show) {
      // 使用结算货币计算总价值
      const totalSettleCash = cash;
      const totalPositionsValue = positions.reduce((sum, p) => {
        const { currency } = parseMarket(p.symbol);
        return sum + convertCurrency(p.value, currency, cashCurrency, exchangeRates);
      }, 0);
      const total = totalSettleCash + totalPositionsValue;
      
      const sharesNum = parseInt(shares) || 0;
      const rawCostVal = sharesNum * position.price;
      const { currency } = parseMarket(position.symbol);
      const costVal = convertCurrency(rawCostVal, currency, cashCurrency, exchangeRates);
      const percentValue = total > 0 ? (costVal / total) * 100 : 0;
      const percent = (Math.floor(percentValue * 100) / 100).toFixed(2);
      
      const rawNewValue = position.value + rawCostVal;
      const newValue = convertCurrency(rawNewValue, currency, cashCurrency, exchangeRates);
      const newPercentValue = total > 0 ? (newValue / total) * 100 : 0;
      const newP = (Math.floor(newPercentValue * 100) / 100).toFixed(2);
      
      setCost(rawCostVal);
      setCostPercent(percent);
      setNewPercent(newP);
      setNewShares(position.shares + sharesNum);
      
      if (costVal > totalSettleCash) {
        setWarning('资金不足');
      } else if (sharesNum > 0) {
        const newPNum = newPercentValue;
        const newTier = getTargetTier(newPNum);
        
        const currentTier = position.tier;
        // 超出目标梯队上限检查
        if (newTier >= 1 && newTier <= getConfig().length) {
          const upperLimit = getUpperLimit(newTier);
          if (newPercentValue > upperLimit) {
            setWarning('超出上限' + upperLimit + '%');
          } else if (newPercentValue > getConfig()[0]?.max) {
            setWarning('仓位将超过准入梯队目标，建议减少股数');
          } else {
            // 目标梯队已满检查 - 只有晋级时才检查，原地加仓不检查
            if (newTier !== currentTier) {
              const mainCount = positions.filter(p => p.tier === newTier && !p.inBuffer).length;
              const bufferCount = positions.filter(p => p.tier === newTier && p.inBuffer).length;
              const tierConfig = getConfig()[newTier - 1];
              
              if (mainCount >= tierConfig.limit) {
                if (bufferCount < tierConfig.buffer) {
                  // 检查能否进缓冲位：更高梯队主位空位之和
                  let freeSlots = 0;
                  for (let t = 1; t < newTier; t++) {
                    const config = getConfig()[t - 1];
                    const count = positions.filter(p => p.tier === t && !p.inBuffer).length;
                    freeSlots += Math.max(0, config.limit - count);
                  }
                  if (freeSlots > 0) {
                    setWarning('');
                  } else {
                    setWarning('目标梯队已满');
                  }
                } else {
                  setWarning('目标梯队已满');
                }
              } else {
                setWarning('');
              }
            } else {
              setWarning('');
            }
          }
        } else {
          setWarning('');
        }
      } else {
        setWarning('');
      }
    }
  }, [shares, position, positions, cash, show, cashCurrency, exchangeRates]);

  const handleSharesChange = (e) => {
    setShares(e.target.value);
  };

  const handleButtonClick = (button, isAdd = true) => {
    const tier = position.tier || 3;
    const rec = getRecommendation(position.symbol, tier, button, isAdd);
    setShares(rec.toString());
  };

  const handleConfirm = () => {
    const sharesNum = parseInt(shares) || 0;
    const priceVal = parseFloat(price) || position.price;
    if (sharesNum <= 0 || !priceVal) return;
    onAdjust(position.symbol, sharesNum, priceVal, true);
    onClose();
  };

  // 计算转换后的金额（转换为显示货币）
  const getDisplayCost = () => {
    if (!cost) return null;
    const converted = convertCurrency(cost, posCurrency, displayCurrency, exchangeRates);
    return `${displaySymbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!show || !position) return null;

  // 使用结算货币计算总价值和当前占比
  const totalSettleCash = cash;
  const totalPositionsValue = positions.reduce((sum, p) => {
    const { currency } = parseMarket(p.symbol);
    return sum + convertCurrency(p.value, currency, cashCurrency, exchangeRates);
  }, 0);
  const total = totalSettleCash + totalPositionsValue;
  const { currency: posCurrency } = parseMarket(position.symbol);
  const posValueSettle = convertCurrency(position.value, posCurrency, cashCurrency, exchangeRates);
  const currentPercent = total > 0 ? (Math.floor((posValueSettle / total) * 10000) / 100).toFixed(2) : '0.00';
  const tier = position.tier;
  // 显示用原生货币符号
  const posSymbol = getCurrencySymbol(posCurrency);
  // 显示货币转换
  const displaySymbol = getCurrencySymbol(displayCurrency);
  const displayValue = convertCurrency(position.value, posCurrency, displayCurrency, exchangeRates);

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>加仓 {position.symbol} {position.name}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            当前: {position?.shares || 0}股 · {posSymbol}{(position?.value || 0).toLocaleString()}{posCurrency !== displayCurrency ? ` ≈ ${displaySymbol}${displayValue.toLocaleString()}` : ''} ({currentPercent || 0}%)
          </div>
          
          <div className="form-group">
            <label className="form-label">股价</label>
            <input
              type="number"
              className="form-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={position.price?.toString() || ''}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">操作股数 *</label>
            <div className="adj-buttons">
              <input
                type="number"
                className="form-input"
                value={shares}
                onChange={handleSharesChange}
                placeholder="输入股数"
              />
              {/* T1: =, max1 */}
              {tier === 1 && (
                <>
                  <button onClick={() => handleButtonClick('=')}>=</button>
                  <button onClick={() => handleButtonClick('max1')}>max1</button>
                </>
              )}
              {/* T2: ↑, =, max1, max2 (减仓操作) */}
              {tier === 2 && (
                <>
                  <button onClick={() => handleButtonClick('UP')}>↑</button>
                  <button onClick={() => handleButtonClick('=')}>=</button>
                  <button onClick={() => handleButtonClick('max1')}>max1</button>
                  <button onClick={() => handleButtonClick('max2')}>max2</button>
                </>
              )}
              {/* T3+: ↑, =, maxN (dynamic) */}
              {tier >= 3 && (
                <>
                  <button onClick={() => handleButtonClick('UP')}>↑</button>
                  <button onClick={() => handleButtonClick('=')}>=</button>
                  <button onClick={() => handleButtonClick(`max${tier}`)}>max{tier}</button>
                </>
              )}
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">交易金额</label>
            <div className="cost-display">
              {posSymbol}{(cost || 0).toLocaleString()}
              {posCurrency !== displayCurrency && getDisplayCost() && (
                <span className="percent"> ≈ {getDisplayCost()}</span>
              )}
              <span className="percent"> ({costPercent || 0}%)</span>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">交易后仓位</label>
            <div className="result-display">
              {newShares}股 · {newPercent}%
            </div>
          </div>
          
          {warning && (
            <div className="form-group">
              <label className="form-label"></label>
              <div className="form-input form-warning">{warning}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>确认</button>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

function ReducePositionModal({ show, onClose, position, positions, cash, cashCurrency, displayCurrency, exchangeRates, onAdjust, getRecommendation }) {
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState(0);
  const [costPercent, setCostPercent] = useState(0);
  const [newPercent, setNewPercent] = useState(0);
  const [newShares, setNewShares] = useState(0);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!show || !position) {
      setShares('');
      setPrice('');
      setWarning('');
    } else {
      setShares('');
      setPrice(position.price?.toString() || '');
      if (getRecommendation) {
        const tier = position.tier || 3;
        const rec = getRecommendation(position.symbol, tier, 'DOWN', false);
        if (rec > 0) {
          setShares(rec.toString());
        }
      }
    }
  }, [show, position]);

  useEffect(() => {
    if (position && show) {
      // 使用结算货币计算总价值
      const totalSettleCash = cash;
      const totalPositionsValue = positions.reduce((sum, p) => {
        const { currency } = parseMarket(p.symbol);
        return sum + convertCurrency(p.value, currency, cashCurrency, exchangeRates);
      }, 0);
      const total = totalSettleCash + totalPositionsValue;
      
      const sharesNum = parseInt(shares) || 0;
      const rawCostVal = sharesNum * position.price;
      const { currency } = parseMarket(position.symbol);
      const costVal = convertCurrency(rawCostVal, currency, cashCurrency, exchangeRates);
      const percentValue = total > 0 ? (costVal / total) * 100 : 0;
      const percent = (Math.floor(percentValue * 100) / 100).toFixed(2);
      
      const rawNewValue = position.value - rawCostVal;
      const newValue = convertCurrency(rawNewValue, currency, cashCurrency, exchangeRates);
      const newPercentValue = total > 0 ? (newValue / total) * 100 : 0;
      const newP = (Math.floor(newPercentValue * 100) / 100).toFixed(2);
      
      setCost(rawCostVal);
      setCostPercent(percent);
      setNewPercent(newP);
      setNewShares(position.shares - sharesNum);
      
      // 减仓低于目标警告
      if (sharesNum > 0) {
        const newTier = position.tier + 1;
        if (newTier >= 1 && newTier <= getConfig().length && newP < (getConfig()[newTier - 1]?.target || 0) - 5) {
          setWarning('仓位将低于目标，建议减少股数');
        } else {
          setWarning('');
        }
      } else {
        setWarning('');
      }
    }
  }, [shares, position, positions, cash, show, cashCurrency, exchangeRates]);

  const handleSharesChange = (e) => {
    setShares(e.target.value);
  };

  const handleButtonClick = (button, isAdd = false) => {
    const tier = position.tier || 3;
    const rec = getRecommendation(position.symbol, tier, button, isAdd);
    setShares(rec.toString());
  };

  const handleConfirm = () => {
    const sharesNum = parseInt(shares) || 0;
    const priceVal = parseFloat(price) || position.price;
    if (sharesNum <= 0 || !priceVal) return;
    onAdjust(position.symbol, sharesNum, priceVal, false);
    onClose();
  };

  // 计算转换后的金额（转换为显示货币）
  const getDisplayCost = () => {
    if (!cost) return null;
    const converted = convertCurrency(cost, posCurrency, displayCurrency, exchangeRates);
    return `${displaySymbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!show || !position) return null;

  // 使用结算货币计算总价值和当前占比
  const totalSettleCash = cash;
  const totalPositionsValue = positions.reduce((sum, p) => {
    const { currency } = parseMarket(p.symbol);
    return sum + convertCurrency(p.value, currency, cashCurrency, exchangeRates);
  }, 0);
  const total = totalSettleCash + totalPositionsValue;
  const { currency: posCurrency } = parseMarket(position.symbol);
  const posValueSettle = convertCurrency(position.value, posCurrency, cashCurrency, exchangeRates);
  const currentPercent = total > 0 ? (Math.floor((posValueSettle / total) * 10000) / 100).toFixed(2) : '0.00';
  const tier = position.tier;
  // 显示用原生货币符号
  const posSymbol = getCurrencySymbol(posCurrency);
  // 显示货币转换
  const displaySymbol = getCurrencySymbol(displayCurrency);
  const displayValue = convertCurrency(position.value, posCurrency, displayCurrency, exchangeRates);

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>减仓 {position.symbol} {position.name}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            当前: {position?.shares || 0}股 · {posSymbol}{(position?.value || 0).toLocaleString()}{posCurrency !== displayCurrency ? ` ≈ ${displaySymbol}${displayValue.toLocaleString()}` : ''} ({currentPercent || 0}%)
          </div>
          
          <div className="form-group">
            <label className="form-label">股价</label>
            <input
              type="number"
              className="form-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={position.price?.toString() || ''}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">操作股数 *</label>
            <div className="adj-buttons">
              <input
                type="number"
                className="form-input"
                value={shares}
                onChange={handleSharesChange}
                placeholder="输入股数"
              />
              {/* 减仓按钮: ↓放前面, =放后面, minX最后 */}
              {tier >= 1 && (
                <>
                  {tier < getConfig().length && <button onClick={() => handleButtonClick('DOWN', false)}>↓</button>}
                  <button onClick={() => handleButtonClick('=', false)}>=</button>
                  <button onClick={() => handleButtonClick(`min${tier}`, false)}>min{tier}</button>
                </>
              )}
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">交易金额</label>
            <div className="cost-display">
              {posSymbol}{(cost || 0).toLocaleString()}
              {posCurrency !== displayCurrency && getDisplayCost() && (
                <span className="percent"> ≈ {getDisplayCost()}</span>
              )}
              <span className="percent"> ({costPercent || 0}%)</span>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">交易后仓位</label>
            <div className="result-display">
              {newShares}股 · {newPercent}%
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>确认</button>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

function CashModal({ show, onClose, cash, onConfirm, onConfirmWithLog, displayCurrency, exchangeRates, cashCurrency }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (show) {
      setValue(cash.toString());
    }
  }, [show, cash]);

  const handleConfirm = (withLog = false) => {
    const inputValue = parseFloat(value) || 0;
    // 直接按结算货币存储，不转换
    if (withLog && onConfirmWithLog) {
      onConfirmWithLog(inputValue);
    } else {
      onConfirm(inputValue);
    }
    onClose();
  };

  if (!show) return null;

  const symbol = getCurrencySymbol(cashCurrency);

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>修改现金 ({cashCurrency})</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">现金 ({symbol})</label>
            <input
              type="number"
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => handleConfirm(false)}>校正</button>
          <button className="btn btn-secondary" onClick={() => handleConfirm(true)}>出入金</button>
        </div>
      </div>
    </div>
  );
}

function MockPriceModal({ show, onClose, onConfirm }) {
  const [json, setJson] = useState('');

  useEffect(() => {
    if (!show) {
      setJson('');
    }
  }, [show]);

  const handleConfirm = () => {
    try {
      const prices = JSON.parse(json);
      onConfirm(prices);
      onClose();
    } catch (e) {
      alert(`JSON 格式错误: ${e.message}`);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Mock 价格</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">输入 JSON</label>
            <textarea
              className="form-input"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder='{"AAPL": 200}'
              style={{ height: '120px', resize: 'none' }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>应用</button>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

// 汇率显示弹窗
function RatesModal({ show, onClose, exchangeRates, onFetchRates }) {
  if (!show) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>汇率</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <button className="btn btn-primary" onClick={onFetchRates}>
              刷新汇率
            </button>
          </div>
          <div className="form-group">
            <label>USD/CNY</label>
            <div style={{ fontSize: '1.2rem' }}>{exchangeRates?.CNY?.toFixed(4) || '-'}</div>
          </div>
          <div className="form-group">
            <label>USD/HKD</label>
            <div style={{ fontSize: '1.2rem' }}>{exchangeRates?.HKD?.toFixed(4) || '-'}</div>
          </div>
          <div className="form-group">
            <label>CNY/HKD</label>
            <div style={{ fontSize: '1.2rem' }}>
              {exchangeRates?.CNY && exchangeRates?.HKD 
                ? (exchangeRates.HKD / exchangeRates.CNY).toFixed(4) 
                : '-'}
            </div>
          </div>
          {exchangeRates?.lastUpdate && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '16px' }}>
              更新时间：{exchangeRates.lastUpdate}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClearPositionModal({ show, onClose, position, cash, cashCurrency, displayCurrency, exchangeRates, onClear }) {
  const [price, setPrice] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!show || !position) {
      setPrice('');
      setWarning('');
    } else {
      setPrice(position.price?.toString() || '');
    }
  }, [show, position]);

  const handleConfirm = () => {
    const priceVal = parseFloat(price) || position.price;
    if (!priceVal) return;
    onClear(position.symbol, priceVal);
    onClose();
  };

  if (!show || !position) return null;

  const { currency: posCurrency } = parseMarket(position.symbol);
  const posSymbol = getCurrencySymbol(posCurrency);
  const cashSymbol = getCurrencySymbol(cashCurrency);
  const displaySymbol = getCurrencySymbol(displayCurrency);
  
  const rawValue = position.shares * (parseFloat(price) || position.price);
  const settleValue = convertCurrency(rawValue, posCurrency, cashCurrency, exchangeRates);
  const currentValue = convertCurrency(position.value, posCurrency, displayCurrency, exchangeRates);
  const displayValue = convertCurrency(settleValue, cashCurrency, displayCurrency, exchangeRates);
  const costSettle = convertCurrency(position.shares * position.avgCost, posCurrency, cashCurrency, exchangeRates);
  const pnlSettle = settleValue - costSettle;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>清仓 {position.symbol} {position.name}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            当前: {position?.shares || 0}股 · {posSymbol}{(position?.value || 0).toLocaleString()}{displayCurrency !== posCurrency ? ` ≈ ${displaySymbol}${currentValue.toLocaleString()}` : ''}
          </div>
          
          <div className="form-group">
            <label className="form-label">股价</label>
            <input
              type="number"
              className="form-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={position.price?.toString() || ''}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">清仓金额</label>
            <div className="cost-display">
              {cashSymbol}{(settleValue || 0).toLocaleString()}
              {displayCurrency !== cashCurrency && (
                <span className="percent"> ≈ {displaySymbol}{displayValue.toLocaleString()}</span>
              )}
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">成本</label>
            <div className="cost-display">
              {cashSymbol}{(costSettle || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">预计盈亏</label>
            <div className="cost-display" style={{ color: pnlSettle >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {cashSymbol}{(pnlSettle || 0).toLocaleString()}
            </div>
          </div>
          
          {warning && (
            <div className="form-group">
              <label className="form-label"></label>
              <div className="form-input form-warning">{warning}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleConfirm}>确认清仓</button>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

export { AddModal, AddPositionModal, ReducePositionModal, ClearPositionModal, CashModal, MockPriceModal, RatesModal };