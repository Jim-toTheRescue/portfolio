import { getConfig, getTierConfig } from '../utils/constants';
import { tierName, getUpperLimit, parseMarket, convertCurrency } from '../utils/helpers';

function PositionItem({ position, total, cash, isBuffer, onAdd, onReduce, onClear, confirmClear, displayCurrency, exchangeRates, cashCurrency, getDisplayValue }) {
  const tierIdx = position.tier - 1;
  const tierConfig = getConfig()[tierIdx] || getConfig()[2];
  
  // 使用结算货币计算市值和占比
  const { currency } = parseMarket(position.symbol);
  const settleValue = convertCurrency(position.value, currency, cashCurrency, exchangeRates);
  const drift = total > 0 ? (settleValue / total) * 100 - tierConfig.target : 0;
  const percent = total > 0 ? (settleValue / total * 100).toFixed(2) : '0.00';
  const priceChange = position.priceChange || 0;
  const priceChangeClass = priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : '';
  
  // 获取显示货币的值
  const displayValue = getDisplayValue ? getDisplayValue(position.value, position.symbol) : settleValue;
  const displayCurrencySymbols = { USD: '$', HKD: 'hk$', CNY: '¥' };
  const displaySymbol = displayCurrencySymbols[displayCurrency] || '$';
  const showConvertedValue = currency !== displayCurrency;
  
  const driftClass = Math.abs(drift) <= 2 ? 'drift-normal' : Math.abs(drift) <= 5 ? 'drift-warning' : 'drift-critical';
  
  const tierUpperLimit = getUpperLimit(position.tier);
  const tierLowerLimit = tierConfig.min;
  const outOfTier = parseFloat(percent) > tierUpperLimit || parseFloat(percent) < tierLowerLimit;
  const isHighAllocation = parseFloat(percent) > tierUpperLimit;

  let recommendation = null;
  if (Math.abs(drift) > 5) {
    if (drift > 0 && position.tier > 1) {
      const targetTier = Math.max(1, position.tier - 1);
      recommendation = `建议升${tierName(targetTier)}`;
    } else if (drift < 0 && position.tier < getConfig().length) {
      const targetTier = Math.min(getConfig().length, position.tier + 1);
      recommendation = `建议降${tierName(targetTier)}`;
    }
  }

  // 获取市场标识
  const { market } = parseMarket(position.symbol);
  const marketLabels = { US: '美', HK: '港', SH: '沪', SZ: '深' };
  
  // 货币符号
  const currencySymbols = { USD: '$', HKD: 'hk$', CNY: '¥' };
  const currencySymbol = currencySymbols[currency] || '$';

  return (
    <div className={`position-item ${isBuffer ? 'position-buffer' : ''}`}>
      <div className="position-info">
        <div className="position-code">
          {position?.symbol || ''} 
          <span className="market-tag">{marketLabels[market] || ''}</span>
          <span className="position-name-text">{position?.name || ''}</span>
        </div>
        <div className="position-name">
          {position?.shares || 0}股 · {currencySymbol}{position?.price || 0}
        </div>
        <div className="position-value-display">
          {currencySymbol}{(position?.value || 0).toLocaleString()}
          {showConvertedValue && <span className="converted-value"> ≈ {displaySymbol}{displayValue.toLocaleString()}</span>}
        </div>
      </div>
<div className="position-value">
        <div className="position-percent">{percent}%</div>
        {(driftClass !== 'drift-normal' && drift !== 0) && (
          <div className={`drift ${driftClass}`} style={{ fontSize: '10px' }}>
            {drift > 0 ? '偏高' : '偏低'} {Math.abs(drift || 0).toFixed(1)}%
          </div>
        )}
        {recommendation && <div className="recommendation">{recommendation}</div>}
      </div>
      <div className="position-actions">
        <button className="btn-small btn-primary" onClick={() => onAdd(position.symbol)}>加仓</button>
        <button className="btn-small btn-danger" onClick={() => onReduce(position.symbol)}>减仓</button>
        {position.tier === getConfig().length && (
          <button 
            className="btn-small btn-secondary" 
            onClick={() => onClear(position.symbol)}
            style={confirmClear === position.symbol ? { borderColor: 'var(--red)', color: 'var(--red)' } : {}}
          >
            {confirmClear === position.symbol ? '确认' : '清仓'}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptySlot({ isBuffer }) {
  return <div className={`empty-slot ${isBuffer ? 'buffer' : ''}`}>{isBuffer ? '缓冲' : '空位'}</div>;
}

export default function TierCard({ tier, positions, cash, total, onAdd, onReduce, onClear, confirmClear, displayCurrency, exchangeRates, cashCurrency, getDisplayValue, getDisplayTotalWithCash }) {
  const tierConfig = getConfig()[tier - 1] || getConfig()[0];
  const mainPositions = positions.filter(p => p.tier === tier && !p.inBuffer);
  const bufferPositions = positions.filter(p => p.tier === tier && p.inBuffer);
  
  // 基于结算货币计算总价值
  const settleCash = positions.length > 0 ? positions.reduce((sum, p) => {
    const { currency } = parseMarket(p.symbol);
    return sum + convertCurrency(p.value, currency, cashCurrency, exchangeRates);
  }, 0) : 0;
  const totalSettleValue = settleCash + cash;
  
  const displayTotal = getDisplayTotalWithCash();
  
  const tierNeedsRebalance = mainPositions.some(p => {
    const { currency } = parseMarket(p.symbol);
    const settleValue = convertCurrency(p.value, currency, cashCurrency, exchangeRates);
    const drift = totalSettleValue > 0 ? (settleValue / totalSettleValue) * 100 - tierConfig.target : 0;
    return Math.abs(drift) > 5;
  });
  
  const tierNeedsUpgrade = mainPositions.some(p => {
    const { currency } = parseMarket(p.symbol);
    const settleValue = convertCurrency(p.value, currency, cashCurrency, exchangeRates);
    const drift = totalSettleValue > 0 ? (settleValue / totalSettleValue) * 100 - tierConfig.target : 0;
    return drift > 5 && p.tier > 1;
  });
  
  const alerts = [];
  if (tierNeedsRebalance) alerts.push('需要调整');
  if (bufferPositions.length > 0) alerts.push(`有${bufferPositions.length}个缓冲仓位`);
  if (tierNeedsUpgrade) alerts.push('有股票仓位过高');

  return (
    <div className={`tier-card tier-${tier}`}>
      <div className="tier-header">
        <span className="tier-title">{tierConfig.name}</span>
        <span>{tierConfig.target}%</span>
      </div>
      <div className="tier-content">
        {alerts.length > 0 && (
          <div className="tier-alert">{alerts.join('，')}</div>
        )}
        
        {mainPositions.map(p => (
          <PositionItem
            key={p.symbol}
            position={p}
            total={totalSettleValue}
            cash={cash}
            isBuffer={false}
            onAdd={onAdd}
            onReduce={onReduce}
            onClear={onClear}
            confirmClear={confirmClear}
            displayCurrency={displayCurrency}
            exchangeRates={exchangeRates}
            getDisplayValue={getDisplayValue}
          />
        ))}
        
        {mainPositions.length < tierConfig.limit && (
          Array.from({ length: tierConfig.limit - mainPositions.length }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} isBuffer={false} />
          ))
        )}
        
        {tierConfig.buffer > 0 && (
          <div className="buffer-section">
            <div style={{ margin: '12px 0 8px 0', borderTop: '1px dashed var(--border)' }}></div>
            <div className="buffer-label">缓冲位 ({bufferPositions.length}/{tierConfig.buffer})</div>
            
            {bufferPositions.map(p => (
              <PositionItem
                key={p.symbol}
                position={p}
                total={totalSettleValue}
                cash={cash}
                isBuffer={true}
                onAdd={onAdd}
                onReduce={onReduce}
                onClear={onClear}
                confirmClear={confirmClear}
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRates}
                getDisplayValue={getDisplayValue}
              />
            ))}
            
            {bufferPositions.length < tierConfig.buffer && (
              Array.from({ length: tierConfig.buffer - bufferPositions.length }).map((_, i) => (
                <EmptySlot key={`buffer-empty-${i}`} isBuffer={true} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}