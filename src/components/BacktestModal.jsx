import { useState, useRef, useEffect } from 'react';
import { runBacktest, formatStats } from '../utils/backtest';

function BacktestModal({ show, onClose, positions, exchangeRates, cashCurrency, portfolioName = 'portfolio' }) {
  const [klineData, setKlineData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (show) {
      const today = new Date();
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(yearAgo.toISOString().split('T')[0]);
      setResult(null);
      setError('');
    }
  }, [show]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      setError('');
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result);
          if (typeof data === 'object' && !Array.isArray(data)) {
            setKlineData(data);
            setError('');
          } else {
            setError('数据格式错误，应该是包含股票代码key的对象');
          }
        } catch (err) {
          setError('JSON解析失败');
        }
        setLoading(false);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleRunBacktest = () => {
    if (!klineData) {
      setError('请先导入K线数据');
      return;
    }

    if (!startDate || !endDate) {
      setError('请选择日期范围');
      return;
    }

    if (!positions || positions.length === 0) {
      setError('当前组合没有持仓');
      return;
    }

    setLoading(true);
    setError('');

    setTimeout(() => {
      const backtestResult = runBacktest(
        positions,
        klineData,
        startDate,
        endDate,
        exchangeRates,
        cashCurrency
      );

      setLoading(false);

      if (backtestResult.error) {
        setError(backtestResult.error);
        setResult(null);
      } else {
        setResult(backtestResult);
        setError('');
      }
    }, 100);
  };

  const handleClose = () => {
    setKlineData(null);
    setResult(null);
    setError('');
    onClose();
  };

  if (!show) return null;

  const symbolsInData = klineData ? Object.keys(klineData) : [];
  const symbolsInPosition = positions?.map(p => p.symbol) || [];
  const matchedSymbols = symbolsInData.filter(s => symbolsInPosition.includes(s));

  const safeName = (portfolioName || 'portfolio').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  const fetchCommand = positions?.length > 0
    ? `python fetch_kline.py --symbols ${positions.map(p => p.symbol).join(' ')} --start ${startDate} --end ${endDate} --filename ${safeName}_kline.json`
    : 'python fetch_kline.py --symbols <股票代码> --start <开始日期> --end <结束日期>';

  return (
    <div className={`modal-overlay ${show ? 'show' : ''}`} onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>组合回测</h3>
          <button className="btn-close" onClick={handleClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '0.8rem' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>获取K线数据命令:</div>
            <code style={{ display: 'block', color: '#98c379', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {fetchCommand}
            </code>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              K线数据文件 (from Python)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                选择JSON文件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              {symbolsInData.length > 0 && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  已加载 {symbolsInData.length} 只股票
                </span>
              )}
            </div>
          </div>

          {symbolsInData.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'rgba(88,166,255,0.1)', borderRadius: '4px', fontSize: '0.85rem' }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>数据中的股票:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {symbolsInData.map(s => (
                  <span
                    key={s}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '0.75rem',
                      background: matchedSymbols.includes(s) ? 'var(--green)' : 'var(--bg-tertiary)',
                      color: matchedSymbols.includes(s) ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    {s} {matchedSymbols.includes(s) ? '✓' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(255,82,82,0.1)', borderRadius: '4px', color: 'var(--red)', marginBottom: '16px', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {result && (
            <div>
              <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>回测结果</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
                {formatStats(result.stats).map(stat => (
                  <div
                    key={stat.label}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{stat.label}</span>
                    <span style={{ fontWeight: '600', color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {result.dailyData.length > 0 && (
                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>日期</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>净值</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>日收益率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.dailyData.slice(-20).reverse().map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                          <td style={{ padding: '4px 8px' }}>{d.date}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.nav.toFixed(2)}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: d.dailyReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {(d.dailyReturn * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>关闭</button>
          <button
            className="btn btn-primary"
            onClick={handleRunBacktest}
            disabled={loading || !klineData}
          >
            {loading ? '计算中...' : '开始回测'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BacktestModal;
