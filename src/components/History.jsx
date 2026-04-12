import { tierName } from '../utils/helpers';

function HistoryPanel({ show, history, onToggle, onClear }) {
  if (!show) return null;

  const getActionClass = (action) => {
    if (!action) return '';
    if (action === '加仓') return 'add';
    if (action === '减仓') return 'reduce';
    if (action === '清仓') return 'clear';
    return 'build';
  };

  const formatAction = (h) => {
    if (!h) return '';
    let result = '';
    if (h.action === '清仓') {
      result = '清仓';
    } else if (h.action === '建仓') {
      result = `建仓 ${tierName(h.toTier)}`;
    } else if (h.toTier && h.toTier !== h.fromTier) {
      if (h.toTier < h.fromTier) {
        result = `晋级 ${tierName(h.toTier)}`;
      } else {
        result = `降级 ${tierName(h.toTier)}`;
      }
    } else if (h.fromTier) {
      result = tierName(h.fromTier);
    }
    return result;
  };

  return (
    <div className={`history-panel ${show ? 'show' : ''}`}>
      <div className="history-header" onClick={onToggle}>
        <span>历史记录</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>点击收起</span>
      </div>
      <div className="history-content">
        {history.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>
            暂无记录
          </div>
        ) : (
          history.slice(0, 20).map((h, i) => (
            <div key={i} className="history-item">
              <span className={`history-action ${getActionClass(h?.action || '')}`}>
                [{h?.action || '?'}]
              </span>
              {' '}{h?.symbol || '?'} {h?.adjShares || 0}股 @ ${h?.price || 0}
              {' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatAction(h)}
              </span>
              <div className="history-time">{h?.time || '-'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast show">{message}</div>;
}

export { HistoryPanel, Toast };