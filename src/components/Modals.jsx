import { useState, useEffect } from 'react';
import { TIER } from '../utils/constants';
import { getUpperLimit, totalWithCash } from '../utils/helpers';
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
      
      // 新建仓检查单笔不超过15%
      if (!existing && newPercent > 15) {
        setWarning('单笔超过15%将跳级，请减少股数');
      } else if (!existing) {
        // tier3主位是否已满
        const tier3MainCount = positions.filter(p => p.tier === 3 && !p.inBuffer).length;
        if (tier3MainCount >= 3) {
          setWarning('第三梯队已满');
        } else {
          setWarning('');
        }
      } else if (existing) {
        // 加仓超过15%跳级
        const newValue = existing.value + costVal;
        const newValuePercent = (newValue / newTotal) * 100;
        if (existing.tier === 3 && newValuePercent > 15) {
          setWarning('持仓超过15%将跳级，请减少股数');
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
    const t3Config = TIER[2];
    
    // 使用与 calculateShares 相同的逻辑
    let button;
    let isAdd = true;
    
    if (type === 'reset') button = '=';      // T3 目标
    else if (type === 'min') button = 'min3'; // T3 下限
    else if (type === 'max') button = 'max3'; // T3 上限
    
    const posValue = 0;
    const price = fetchedPrice;
    let shares = 0;
    
    // 新仓位 max3：加到刚好低于15%（留在T3）
    if (button === 'max3') {
      const limit = getUpperLimit(3);
      
      if (total <= 0 || price <= 0) {
        shares = 0;
      } else {
        // 找最接近15%但小于15%的股数
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
    } else if (button === 'min3') {
      // 新仓位：推荐刚好5%的股数（ >= 5%）
      const limit = t3Config.min;
      
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
      const targetPercent = t3Config.target;
      
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
        let newTier;
        if (newPNum >= 25) newTier = 1;
        else if (newPNum >= 15) newTier = 2;
        else newTier = 3;
        
        const currentTier = position.tier;
        // 超出目标梯队上限检查
        if (newTier >= 1 && newTier <= 3) {
          const upperLimit = newTier === 1 ? 35 : newTier === 2 ? 25 : 15;
          if (newP > upperLimit) {
            setWarning('超出上限' + upperLimit + '%');
          } else if (newP > TIER[newTier - 1].target + 5) {
            setWarning('仓位将超过目标，建议减少股数');
          } else {
            // 目标梯队已满检查 - 只有晋级时才检查，原地加仓不检查
            if (newTier !== currentTier) {
              const mainCount = positions.filter(p => p.tier === newTier && !p.inBuffer).length;
              const bufferCount = positions.filter(p => p.tier === newTier && p.inBuffer).length;
              if (mainCount >= TIER[newTier - 1].limit) {
                if (bufferCount < TIER[newTier - 1].buffer) {
                  if (newTier === 2 && currentTier === 3) {
                    const t1t2Main = positions.filter(p => (p.tier === 1 || p.tier === 2) && !p.inBuffer).length;
                    if (t1t2Main >= 3) {
                      setWarning('目标梯队已满');
                    } else {
                      setWarning('');
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
              {/* T2: ↑, =, max1, max2 */}
              {tier === 2 && (
                <>
                  <button onClick={() => handleButtonClick('UP')}>↑</button>
                  <button onClick={() => handleButtonClick('=')}>=</button>
                  <button onClick={() => handleButtonClick('max1')}>max1</button>
                  <button onClick={() => handleButtonClick('max2')}>max2</button>
                </>
              )}
              {/* T3: ↑, =, max2, max3 */}
              {tier === 3 && (
                <>
                  <button onClick={() => handleButtonClick('UP')}>↑</button>
                  <button onClick={() => handleButtonClick('=')}>=</button>
                  <button onClick={() => handleButtonClick('max2')}>max2</button>
                  <button onClick={() => handleButtonClick('max3')}>max3</button>
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
        if (newTier >= 1 && newTier <= 3 && newP < TIER[newTier - 1].target - 5) {
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
              {/* T1: =, min1, min2, ↓ (减仓操作) */}
              {tier === 1 && (
                <>
                  <button onClick={() => handleButtonClick('=', false)}>=</button>
                  <button onClick={() => handleButtonClick('min1', false)}>min1</button>
                  <button onClick={() => handleButtonClick('min2', false)}>min2</button>
                  <button onClick={() => handleButtonClick('DOWN', false)}>↓</button>
                </>
              )}
              {/* T2: =, min2, min3, ↓ (减仓操作) */}
              {tier === 2 && (
                <>
                  <button onClick={() => handleButtonClick('=', false)}>=</button>
                  <button onClick={() => handleButtonClick('min2', false)}>min2</button>
                  <button onClick={() => handleButtonClick('min3', false)}>min3</button>
                  <button onClick={() => handleButtonClick('DOWN', false)}>↓</button>
                </>
              )}
              {/* T3: =, min3 (减仓操作) */}
              {tier === 3 && (
                <>
                  <button onClick={() => handleButtonClick('=', false)}>=</button>
                  <button onClick={() => handleButtonClick('min3', false)}>min3</button>
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

function CashModal({ show, onClose, cash, onConfirm }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (show) {
      setValue(cash.toString());
    }
  }, [show, cash]);

  const handleConfirm = () => {
    const newCash = parseFloat(value) || 0;
    onConfirm(newCash);
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
          <button className="btn btn-primary" onClick={handleConfirm}>确认</button>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
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