import { useState, useRef } from 'react';
import { updatePortfolioName } from '../utils/manfolio';

function Header({ onBack, onRefresh, onClearHistory, onToggleHistory, onExport, onImport, onMockPrice, onConfig, onRates, portfolioName, onNameChange }) {
  const fileInputRef = useRef(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result);
          window.dispatchEvent(new CustomEvent('import-data', { detail: data }));
        } catch (err) {
          alert('文件格式错误');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleNameClick = () => {
    setNameValue(portfolioName || '');
    setEditingName(true);
  };

  const handleNameSubmit = () => {
    const newName = nameValue.trim();
    if (newName) {
      updatePortfolioName(newName);
      onNameChange?.(newName);
    }
    setEditingName(false);
  };

  return (
    <div className="header">
      <h1>
        <span onClick={onBack} style={{ cursor: onBack ? 'pointer' : 'default' }}>Portfolio</span>
        {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              style={{
                marginLeft: '8px',
                fontSize: 'inherit',
                fontWeight: 'normal',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '4px',
                padding: '2px 8px',
                color: '#fff'
              }}
            />
          ) : (
            <span 
              onClick={handleNameClick}
              style={{ 
                marginLeft: '12px', 
                fontSize: '0.8em', 
                fontWeight: 'normal',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                borderBottom: '1px dashed var(--text-secondary)'
              }}
            >
              {portfolioName || '未命名'}
            </span>
          )}
      </h1>
      <div className="header-buttons">
        <button className="btn btn-secondary" onClick={onRates}>汇率</button>
        <button className="btn btn-secondary" onClick={onRefresh}>刷新价格</button>
        <button className="btn btn-secondary" onClick={onClearHistory}>清历史</button>
        <button className="btn btn-secondary" onClick={onToggleHistory}>历史</button>
        <button className="btn btn-secondary" onClick={onExport}>导出</button>
        <button className="btn btn-secondary" onClick={handleImportClick}>导入</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden-input"
          onChange={handleFileChange}
        />
        <button className="btn btn-secondary" onClick={onMockPrice}>Mock价格</button>
        <button className="btn btn-secondary" onClick={onConfig}>配置</button>
      </div>
    </div>
  );
}

function Summary({ stockValue = 0, cash = 0, total = 0, priceTime, onCashClick, displayCurrency, cashCurrency, onCurrencyChange, history = [] }) {
  const [showTip, setShowTip] = useState(false);
  const cashPercent = total > 0 ? ((cash / total) * 100).toFixed(1) : 0;
  const symbolMap = { USD: '$', HKD: 'hk$', CNY: '¥' };
  const displaySymbol = symbolMap[displayCurrency] || '$';
  const effectiveCash = cash + stockValue * 0.7;

  // 计算年换手率（按自然年，只看卖出）
  let yearlyTurnover = '0%';
  let turnoverColor = 'inherit';
  if (history.length > 0 && total > 0) {
    const currentYear = new Date().getFullYear();
    const yearTradeAmount = history.reduce((sum, h) => {
      if (h.time && (h.action === '减仓' || h.action === '清仓')) {
        try {
          const tradeYear = new Date(h.time).getFullYear();
          if (tradeYear === currentYear) {
            if (h.adjShares && h.price) {
              return sum + h.adjShares * h.price;
            }
          }
        } catch (e) {}
      }
      return sum;
    }, 0);
    const turnoverValue = (yearTradeAmount / total) * 100;
    yearlyTurnover = turnoverValue.toFixed(1) + '%';
    if (turnoverValue > 100) {
      turnoverColor = 'var(--red)';
    } else if (turnoverValue > 60) {
      turnoverColor = '#f5a623';
    }
  }

  return (
    <div className="summary">
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div className="summary-item">
          <span className="summary-label">显示货币</span>
          <span 
            className="summary-value clickable" 
            style={{ cursor: 'pointer', fontWeight: 600 }}
            onClick={() => {
              const currencies = ['USD', 'CNY', 'HKD'];
              const currentIdx = currencies.indexOf(displayCurrency);
              const nextIdx = (currentIdx + 1) % currencies.length;
              onCurrencyChange?.(currencies[nextIdx]);
            }}
          >
            {displaySymbol} {displayCurrency}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">总市值</span>
          <span className="summary-value">{displaySymbol}{(stockValue || 0).toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">现金</span>
          <span className="summary-value clickable" onClick={onCashClick}>
            {displaySymbol}{(cash || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({cashPercent}%)</span>
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setShowTip(!showTip)}>
            合计 ⓘ
            {showTip && (
              <span style={{ 
                position: 'absolute', 
                left: '0', 
                bottom: '100%',
                marginBottom: '4px',
                background: '#333', 
                color: '#fff', 
                padding: '8px 12px', 
                borderRadius: '4px', 
                fontSize: '12px',
                whiteSpace: 'nowrap',
                zIndex: 1000
              }}>
                有效现金: {displaySymbol}{Math.round(effectiveCash || 0).toLocaleString()}<br/>
                (股票按0.7折算)
              </span>
            )}
          </span>
          <span className="summary-value">
            {displaySymbol}{(total || 0).toLocaleString()}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">年换手率</span>
          <span className="summary-value" style={{ color: turnoverColor }}>{yearlyTurnover}</span>
        </div>
      </div>
      {priceTime && (
        <div className="summary-item">
          <span className="summary-label">刷新时间</span>
          <span className="summary-value" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {priceTime}
          </span>
        </div>
      )}
    </div>
  );
}

export { Header, Summary };