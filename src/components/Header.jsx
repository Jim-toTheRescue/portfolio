import { useRef } from 'react';

function Header({ onRefresh, onClearHistory, onToggleHistory, onExport, onImport, onMockPrice, onConfig }) {
  const fileInputRef = useRef(null);

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

  return (
    <div className="header">
      <h1>Portfolio</h1>
      <div className="header-buttons">
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

function Summary({ stockValue = 0, cash = 0, total = 0, priceTime, onCashClick }) {
  const cashPercent = total > 0 ? ((cash / total) * 100).toFixed(1) : 0;

  return (
    <div className="summary">
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div className="summary-item">
          <span className="summary-label">总市值</span>
          <span className="summary-value">${(stockValue || 0).toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">现金</span>
          <span className="summary-value clickable" onClick={onCashClick}>
            ${(cash || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({cashPercent}%)</span>
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">合计</span>
          <span className="summary-value">${(total || 0).toLocaleString()}</span>
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