import { useState } from 'react';
import { getConfig, getTierConfig } from '../utils/constants';
import { tierName, getUpperLimit, parseMarket, convertCurrency, getCurrencySymbol } from '../utils/helpers';

function PositionItem({ position, total, cash, isBuffer, onAdd, onReduce, onClear, onNote, confirmClear, displayCurrency, exchangeRates, cashCurrency, getDisplayValue, showToast, showProfit, onToggleStatus, pnlShowPercent = true }) {
  const tierIdx = position.tier - 1;
  const tierConfig = getConfig()[tierIdx] || getConfig()[2];
  
  const statusLabels = { observing: '观察中', verified: '已验证', core: '核心仓' };
  const statusColors = { observing: '#ff9800', verified: '#4caf50', core: '#2196f3' };
  
  // 只有观察中才能交易，兼容旧数据默认观察中
  const canTrade = position.status === 'observing' || !position.status;
  
  // 使用结算货币计算市值和占比
  const { currency } = parseMarket(position.symbol);
  const settleValue = convertCurrency(position.value, currency, cashCurrency, exchangeRates);
  const drift = total > 0 ? (settleValue / total) * 100 - tierConfig.target : 0;
  const percent = total > 0 ? (settleValue / total * 100).toFixed(2) : '0.00';
  const priceChange = position.priceChange || 0;
  const priceChangeClass = priceChange > 0 ? 'price-up' : priceChange < 0 ? 'price-down' : '';
  
  // 获取显示货币的值
  const displayValue = getDisplayValue ? getDisplayValue(position.value, position.symbol) : settleValue;
  const displaySymbol = getCurrencySymbol(displayCurrency);
  const showConvertedValue = currency !== displayCurrency;
  
  const driftClass = Math.abs(drift) <= 2 ? 'drift-normal' : Math.abs(drift) <= 5 ? 'drift-warning' : 'drift-critical';
  
  const tierUpperLimit = getUpperLimit(position.tier);
  const tierLowerLimit = tierConfig.min;
  const outOfTier = parseFloat(percent) > tierUpperLimit || parseFloat(percent) < tierLowerLimit;
  const isHighAllocation = parseFloat(percent) > tierUpperLimit;

  let recommendation = null;
  if (Math.abs(drift) > 5) {
    if (drift > 0 && position.tier > 1) {
      recommendation = '有晋级风险';
    } else if (drift < 0 && position.tier < getConfig().length) {
      recommendation = '有降级风险';
    }
  }

  // 获取市场标识
  const { market } = parseMarket(position.symbol);
  const marketLabels = { US: '美', HK: '港', SH: '沪', SZ: '深' };
  
  // 货币符号
  const currencySymbol = getCurrencySymbol(currency);

  // 最新交易时间
  let lastTradeColor = null;
  if (position.lastTradeTime) {
    try {
      const tradeDate = new Date(position.lastTradeTime);
      const now = new Date();
      const daysDiff = (now - tradeDate) / (1000 * 60 * 60 * 24);
      lastTradeColor = daysDiff <= 7 ? 'var(--red)' : 'var(--text-secondary)';
    } catch (e) {}
  }

  return (
    <div 
      className={`position-item ${isBuffer ? 'position-buffer' : ''}`}
      onClick={() => onNote?.(position.symbol, position.name)}
      style={{ cursor: 'pointer' }}
    >
      <div className="position-info">
        <div className="position-code">
          {position?.symbol || ''} 
          <span className="market-tag">{marketLabels[market] || ''}</span>
          <span 
            className="position-name-text" 
            title={position?.name || ''}
            style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {position?.name || ''}
          </span>
          {(() => {
            const lastDate = position.lastTradeTime ? new Date(position.lastTradeTime).toDateString() : null;
            const today = new Date().toDateString();
            const tradedToday = lastDate === today;
            return (
              <span 
                style={{ 
                  marginLeft: '6px', 
                  fontSize: '10px', 
                  color: statusColors[position.status] || statusColors.observing,
                  cursor: tradedToday ? 'not-allowed' : 'pointer',
                  textDecoration: tradedToday ? 'none' : 'underline'
                }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (!tradedToday) onToggleStatus?.(position.symbol); 
                }}
                title={tradedToday ? '今日已交易，明天才能修改状态' : '点击切换状态'}
              >
                {statusLabels[position.status] || statusLabels.observing}
              </span>
            );
          })()}
        </div>
        <div className="position-name">
          {position?.shares || 0}股 · {currencySymbol}{position?.price || 0}
          {priceChange !== 0 && (
            <span 
              className={`price-change-tag ${priceChangeClass}`}
            >
              {pnlShowPercent ? (
                <>
                  {(() => {
                    const profitPercent = position.avgCost > 0 ? ((position.price - position.avgCost) / position.avgCost * 100) : 0;
                    return (
                      <span className={profitPercent >= 0 ? 'price-up' : 'price-down'}>
                        {profitPercent > 0 ? '+' : ''}{profitPercent.toFixed(1)}%
                      </span>
                    );
                  })()}
                </>
              ) : (
                <>
                  {priceChange > 0 ? '+' : ''}{priceChange}%
                </>
              )}
            </span>
          )}
        </div>
        <div className="position-value-display">
          {currencySymbol}{(position?.value || 0).toLocaleString()}
          {showConvertedValue && <span className="converted-value"> ≈ {displaySymbol}{displayValue.toLocaleString()}</span>}
        </div>
        {lastTradeColor && (
          <div style={{ fontSize: '10px', color: lastTradeColor }}>
            ⇄ {position.lastTradeTime}
          </div>
        )}
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
        <button className="btn-small btn-primary" onClick={(e) => { e.stopPropagation(); onAdd(position.symbol); }} disabled={!canTrade} title={!canTrade ? '只有"观察中"状态才能交易' : ''}>加仓</button>
        <button 
          className="btn-small btn-danger" 
          onClick={(e) => { e.stopPropagation(); onReduce(position.symbol); }}
          disabled={!canTrade}
          title={!canTrade ? '只有"观察中"状态才能交易' : ''}
        >减仓</button>
        {position.tier === getConfig().length && (
          <button 
            className="btn-small btn-secondary" 
            onClick={(e) => { e.stopPropagation(); onClear(position.symbol); }}
            disabled={!canTrade}
            title={!canTrade ? '只有"观察中"状态才能交易' : ''}
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

export default function TierCard({ tier, positions, cash, total, onAdd, onReduce, onClear, onNote, confirmClear, displayCurrency, exchangeRates, cashCurrency, getDisplayValue, getDisplayTotalWithCash, showToast, onToggleStatus, pnlShowPercent = true }) {
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
            onNote={() => onNote?.(p.symbol, p.name)}
            confirmClear={confirmClear}
            displayCurrency={displayCurrency}
            exchangeRates={exchangeRates}
            cashCurrency={cashCurrency}
            getDisplayValue={getDisplayValue}
            showToast={showToast}
            onToggleStatus={onToggleStatus}
            pnlShowPercent={pnlShowPercent}
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
                onNote={() => onNote?.(p.symbol, p.name)}
                confirmClear={confirmClear}
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRates}
                cashCurrency={cashCurrency}
                getDisplayValue={getDisplayValue}
                showToast={showToast}
                onToggleStatus={onToggleStatus}
                pnlShowPercent={pnlShowPercent}
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