import { useState, useEffect } from 'react';
import { getConfig, getTierConfig } from '../utils/constants';
import { getUpperLimit, getTargetTier, totalWithCash } from '../utils/helpers';
import { calculateShares } from '../utils/portfolio';

// 新建仓位弹窗
function AddModal({ show, onClose, positions, cash, onAdd, getRecommendation }) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('输入代码后自动获取');
  const [fetchedPrice, setFetchedPrice] = useState(0);
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState(0);
  const [costPercent, setCostPercent] = useState(0);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!show) {
      setSymbol('');
      setName('输入代码后自动获取');
      setFetchedPrice(0);
      setShares('');
      setCost(0);
      setCostPercent(0);
      setWarning('');
    }
  }, [show]);

  const handleSymbolChange = (e) => {
    const value = e.target.value.trim().toUpperCase();
    setSymbol(value);
    if (value) {
      setName('获取中...');
      fetchQuote(value);
    } else {
      setName('输入代码后自动获取');
      setFetchedPrice(0);
    }
  };

  const fetchQuote = async (sym) => {
    try {
      const response = await fetch(`https://qt.gtimg.cn/q=us${sym}`);
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('GBK');
      const text = decoder.decode(arrayBuffer);
      if (text && text.indexOf('~') > 0) {
        const fields = text.split('~');
        setName(fields[1] || sym);
        setFetchedPrice(parseFloat(fields[3]));
      } else {
        setName('未找到');
      }
    } catch (e) {
      setName('获取失败');
    }
  };

  const updateCost = (sharesVal) => {
    const sharesNum = parseInt(sharesVal) || 0;
    const total = totalWithCash(positions, cash);
    const costVal = sharesNum * fetchedPrice;
    const percent = total > 0 ? ((costVal / total) * 100).toFixed(2) : 0;
    setCost(costVal);
    setCostPercent(percent);
    
    const existing = positions.find(p => p.symbol === symbol);
    if (existing) {
      setWarning('该股票已存在持仓，请使用加仓功能');
      return;
    }
    
    if (costVal > cash) {
      setWarning('资金不足');
    } else if (fetchedPrice > 0 && sharesNum > 0) {
      const newTotal = total + costVal;
      const newPercent = (costVal / newTotal) * 100;
      
      // 新建仓检查：单笔不超过最低梯队上限
      const lastTier = getConfig().length;
      const lastTierConfig = getConfig()[lastTier - 1];
      const maxNewPercent = getUpperLimit(lastTier);
      
      if (!existing && newPercent > maxNewPercent) {
        setWarning(`单笔超过${maxNewPercent}%将跳级，请减少股数`);
      } else if (!existing) {
        // 最低梯队主位是否已满
        const lastTier = getConfig().length;
        const lastTierConfig = getConfig()[lastTier - 1];
        const lastTierMainCount = positions.filter(p => p.tier === lastTier && !p.inBuffer).length;
        const lastTierBufferCount = positions.filter(p => p.tier === lastTier && p.inBuffer).length;
        
        if (lastTierMainCount >= lastTierConfig.limit) {
          // 主位满了，检查缓冲位
          // 缓冲位可用 = 所有更高梯队的主位空位之和
          let freeSlots = 0;
          for (let t = 1; t < lastTier; t++) {
            const tierConfig = getConfig()[t - 1];
            const tierMainCount = positions.filter(p => p.tier === t && !p.inBuffer).length;
            freeSlots += Math.max(0, tierConfig.limit - tierMainCount);
          }
          const canUseBuffer = lastTierBufferCount < lastTierConfig.buffer && freeSlots > 0;
          if (canUseBuffer) {
            setWarning('');
          } else {
            setWarning(`第${lastTier}梯队已满`);
          }
        } else {
          setWarning('');
        }
      } else if (existing) {
        // 加仓超过当前梯队上限跳级
        const newValue = existing.value + costVal;
        const newValuePercent = (newValue / newTotal) * 100;
        const existingUpperLimit = getUpperLimit(existing.tier);
        if (newValuePercent > existingUpperLimit) {
          setWarning(`持仓超过${existingUpperLimit}%将跳级，请减少股数`);
        } else {
          setWarning('');
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
    const total = totalWithCash(positions, cash);
    const lastTierConfig = getConfig()[getConfig().length - 1];
    
    // 使用与 calculateShares 相同的逻辑
    let button;
    let isAdd = true;
    
    const lastTier = getConfig().length;
    
    if (type === 'reset') button = '=';      // 最低梯队目标
    else if (type === 'min') button = `min${lastTier}`; // 最低梯队下限
    else if (type === 'max') button = `max${lastTier}`; // 最低梯队上限
    
    const posValue = 0;
    const price = fetchedPrice;
    let shares = 0;
    
    // 新仓位 maxX：加到刚好低于最低梯队上限
    if (button === `max${lastTier}`) {
      const limit = getUpperLimit(lastTier);
      
      if (total <= 0 || price <= 0) {
        shares = 0;
      } else {
        // 找最接近最低梯队上限但小于该上限的股数
        let bestShares = 0;
        let bestDiff = Infinity;
        for (let s = 1; s <= 10000; s++) {
          const newValue = s * price;
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
    } else if (button === `min${lastTier}`) {
      // 新仓位：推荐刚好最低梯队最小值的股数
      const limit = lastTierConfig.min;
      
      if (total <= 0 || price <= 0) {
        shares = 0;
      } else {
        // 找 >= 5% 中最接近5%的股数
        let bestShares = 0;
        let bestDiff = Infinity;
        for (let s = 1; s <= 10000; s++) {
          const newValue = s * price;
          const newPercent = (newValue / total) * 100;
          
          if (newPercent < limit) continue;
          
          const diff = newPercent - limit;
          if (diff < bestDiff) {
            bestDiff = diff;
            bestShares = s;
          }
        }
        shares = bestShares > 0 ? bestShares : 1;
      }
    } else if (button === '=') {
      // 新仓位：推荐刚好10%的股数
      const targetPercent = lastTierConfig.target;
      
      if (total <= 0 || price <= 0) {
        shares = 0;
      } else {
        // 找最接近10%的股数
        let bestShares = 0;
        let bestDiff = Infinity;
        for (let s = 1; s <= 10000; s++) {
          const newValue = s * price;
          const newPercent = (newValue / total) * 100;
          const diff = Math.abs(newPercent - targetPercent);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestShares = s;
          }
        }
        shares = bestShares > 0 ? bestShares : 1;
      }
    }
    
    setShares(shares > 0 ? shares.toString() : '');
    updateCost(shares > 0 ? shares : '');
  };

  const handleConfirm = () => {
    const sharesNum = parseInt(shares) || 0;
    if (!symbol || sharesNum <= 0 || fetchedPrice <= 0) return;
    onAdd(symbol, name, sharesNum, fetchedPrice);
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
              {['GOOG', 'AAPL', 'NVDA', 'MSFT', 'AMZN', 'META'].map(s => (
                <button key={s} onClick={() => handleSymbolChange({ target: { value: s } })}>{s}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">股票代码 *</label>
            <input className="form-input" value={symbol} onChange={handleSymbolChange} placeholder="AAPL" />
          </div>
          <div className="form-group">
            <label className="form-label">名称</label>
            <div className="form-text">{name}</div>
          </div>
          <div className="form-group">
            <label className="form-label">当前价格</label>
            <div className="form-text">{fetchedPrice > 0 ? `$${fetchedPrice}` : '-'}</div>
          </div>
          <div className="form-group">
            <label className="form-label">股数 *</label>
            <div className="input-with-buttons">
              <input type="number" className="form-input" value={shares} onChange={handleSharesChange} placeholder="100" />
              <button onClick={() => handleRecommend('reset')}>↻</button>
              <button onClick={() => handleRecommend('min')}>min</button>
              <button onClick={() => handleRecommend('max')}>max</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">交易金额</label>
            <div className="cost-display">${(cost || 0).toLocaleString()} <span className="percent">({costPercent || 0}%)</span></div>
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

function AddPositionModal({ show, onClose, position, positions, cash, onAdjust, getRecommendation }) {
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState(0);
  const [costPercent, setCostPercent] = useState(0);
  const [newPercent, setNewPercent] = useState(0);
  const [newShares, setNewShares] = useState(0);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!show || !position) {
      setShares('');
      setWarning('');
    } else {
      setShares('');
    }
  }, [show, position]);

  useEffect(() => {
    if (position && show) {
      const total = totalWithCash(positions, cash);
      const sharesNum = parseInt(shares) || 0;
      const costVal = sharesNum * position.price;
      const percent = total > 0 ? ((costVal / total) * 100).toFixed(2) : 0;
      setCost(costVal);
      setCostPercent(percent);
      
      const newValue = position.value + costVal;
      const newP = total > 0 ? ((newValue / total) * 100).toFixed(1) : 0;
      setNewPercent(newP);
      setNewShares(position.shares + sharesNum);
      
      if (costVal > cash) {
        setWarning('资金不足');
      } else if (sharesNum > 0) {
        const newPNum = parseFloat(newP);
        const newTier = getTargetTier(newPNum);
        
        const currentTier = position.tier;
        // 超出目标梯队上限检查
        if (newTier >= 1 && newTier <= getConfig().length) {
          const upperLimit = getUpperLimit(newTier);
          if (newP > upperLimit) {
            setWarning('超出上限' + upperLimit + '%');
          } else if (newP > (getConfig()[newTier - 1]?.target || getConfig()[0]?.target || 0) + 5) {
            setWarning('仓位将超过目标，建议减少股数');
          } else {
            // 目标梯队已满检查 - 只有晋级时才检查，原地加仓不检查
            if (newTier !== currentTier) {
              const mainCount = positions.filter(p => p.tier === newTier && !p.inBuffer).length;
              const bufferCount = positions.filter(p => p.tier === newTier && p.inBuffer).length;
              const tierConfig = getConfig()[newTier - 1];
              
              if (mainCount >= tierConfig.limit) {
                if (bufferCount < tierConfig.buffer) {
                  // 检查能否进缓冲位：所有更高梯队主位空位之和
                  if (newTier === getConfig().length && !existing) {
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
                    setWarning('');
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
  }, [shares, position, positions, cash, show]);

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
    if (sharesNum <= 0) return;
    onAdjust(position.symbol, sharesNum, true);
    onClose();
  };

  if (!show || !position) return null;

  const total = totalWithCash(positions, cash);
  const currentPercent = total > 0 ? (position.value / total * 100).toFixed(1) : 0;
  const tier = position.tier;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>加仓 {position.symbol}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            当前: {position?.shares || 0}股 ${(position?.value || 0).toLocaleString()} ({currentPercent || 0}%)
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
              ${(cost || 0).toLocaleString()} <span className="percent">({costPercent || 0}%)</span>
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

function ReducePositionModal({ show, onClose, position, positions, cash, onAdjust, getRecommendation }) {
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState(0);
  const [costPercent, setCostPercent] = useState(0);
  const [newPercent, setNewPercent] = useState(0);
  const [newShares, setNewShares] = useState(0);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!show || !position) {
      setShares('');
      setWarning('');
    } else {
      setShares('');
      setWarning('');
    }
  }, [show, position]);

  useEffect(() => {
    if (position && show) {
      const total = totalWithCash(positions, cash);
      const sharesNum = parseInt(shares) || 0;
      const costVal = sharesNum * position.price;
      const percent = total > 0 ? ((costVal / total) * 100).toFixed(2) : 0;
      setCost(costVal);
      setCostPercent(percent);
      
      const newValue = position.value - costVal;
      const newP = total > 0 ? ((newValue / total) * 100).toFixed(1) : 0;
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
  }, [shares, position, positions, cash, show]);

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
    if (sharesNum <= 0) return;
    onAdjust(position.symbol, sharesNum, false);
    onClose();
  };

  if (!show || !position) return null;

  const total = totalWithCash(positions, cash);
  const currentPercent = total > 0 ? (position.value / total * 100).toFixed(1) : 0;
  const tier = position.tier;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>减仓 {position.symbol}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
            当前: {position?.shares || 0}股 ${(position?.value || 0).toLocaleString()} ({currentPercent || 0}%)
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
              ${(cost || 0).toLocaleString()} <span className="percent">({costPercent || 0}%)</span>
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

function CashModal({ show, onClose, cash, onConfirm, onConfirmWithLog }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (show) {
      setValue(cash.toString());
    }
  }, [show, cash]);

  const handleConfirm = (withLog = false) => {
    const newCash = parseFloat(value) || 0;
    if (withLog && onConfirmWithLog) {
      onConfirmWithLog(newCash);
    } else {
      onConfirm(newCash);
    }
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>修改现金</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">现金 (美元)</label>
            <input
              type="number"
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="100000"
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

export { AddModal, AddPositionModal, ReducePositionModal, CashModal, MockPriceModal };