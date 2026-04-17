import { useState, useRef, useEffect } from 'react';
import { useRouter } from '../utils/router';
import { runBacktest, formatStats } from '../utils/backtest';
import { getPortfolio, getExchangeRates } from '../utils/manfolio';
import BacktestCharts from './BacktestCharts';

const STRATEGIES = {
  fixed_shares: {
    name: '固定股数',
    description: '用你当前的持仓股数，回测"买了这些股票一直持有到现在"的表现',
    icon: '📦'
  },
  fixed_weight: {
    name: '固定权重 + 调仓',
    description: '用期末权重作为目标，定期调仓维持目标权重，实现"高卖低买"',
    icon: '⚖️'
  },
  decision: {
    name: '决策回测',
    description: '用期末权重做决策，假设2016年按这个比例分配现金买入并持有',
    icon: '📊'
  }
};

const REBALANCE_PERIODS = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
  semi_annual: '每半年',
  annual: '每年'
};

function BacktestPage({ portfolioId }) {
  const { navigate } = useRouter();
  const [positions, setPositions] = useState([]);
  const [cash, setCash] = useState(0);
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, CNY: 7.1, HKD: 7.75 });
  const [cashCurrency, setCashCurrency] = useState('USD');
  const [klineData, setKlineData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [strategy, setStrategy] = useState('fixed_shares');
  const [rebalancePeriod, setRebalancePeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadPortfolioData();
  }, [portfolioId]);

  const loadPortfolioData = () => {
    const portfolio = getPortfolio();
    if (portfolio) {
      setPositions(portfolio.positions || []);
      setCash(portfolio.cash || 0);
      setCashCurrency(portfolio.cashCurrency || 'USD');
      setPortfolioName(portfolio.name || 'portfolio');
    }
    const rates = getExchangeRates();
    if (rates) {
      setExchangeRates(rates);
    }
  };

  useEffect(() => {
    if (positions.length > 0) {
      const today = new Date();
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(yearAgo.toISOString().split('T')[0]);
    }
  }, [positions]);

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

            const dateSets = [];
            Object.keys(data).forEach(symbol => {
              if (Array.isArray(data[symbol])) {
                const dates = new Set();
                data[symbol].forEach(r => {
                  if (r.date) {
                    dates.add(r.date.split('T')[0]);
                  }
                });
                dateSets.push(dates);
              }
            });

            if (dateSets.length > 0) {
              let intersection = dateSets[0];
              for (let i = 1; i < dateSets.length; i++) {
                intersection = new Set([...intersection].filter(x => dateSets[i].has(x)));
              }

              const sortedDates = Array.from(intersection).sort();
              if (sortedDates.length > 0) {
                setStartDate(sortedDates[0]);
                setEndDate(sortedDates[sortedDates.length - 1]);
              }
            }

            setError('');
          } else {
            setError('数据格式错误');
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
      console.log('回测参数:', { strategy, rebalancePeriod, startDate, endDate });
      const backtestResult = runBacktest(
        positions,
        cash,
        klineData,
        startDate,
        endDate,
        exchangeRates,
        cashCurrency,
        {
          strategy,
          rebalancePeriod: strategy === 'fixed_weight' ? rebalancePeriod : undefined
        }
      );
      console.log('回测结果:', backtestResult);

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

  const handleBack = () => {
    navigate(`/folio/${portfolioId}`);
  };

  const symbolsInData = klineData ? Object.keys(klineData) : [];
  const symbolsInPosition = positions?.map(p => p.symbol) || [];
  const matchedSymbols = symbolsInData.filter(s => symbolsInPosition.includes(s));

  const safeName = portfolioName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') || 'portfolio';
  const fetchCommand = positions?.length > 0
    ? `python fetch_kline.py --symbols ${positions.map(p => p.symbol).join(' ')} --start ${startDate} --end ${endDate} --filename ${safeName}_kline.json`
    : 'python fetch_kline.py --symbols <股票代码>';

  const currentStrategy = STRATEGIES[strategy];

  return (
    <div className="app">
      <div className="header">
        <h1>
          <span onClick={handleBack} style={{ cursor: 'pointer' }}>← 回测</span>
        </h1>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '0.8rem' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>获取K线数据命令:</div>
          <code style={{ display: 'block', color: '#98c379', fontSize: '0.75rem', wordBreak: 'break-all' }}>
            {fetchCommand}
          </code>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>K线数据文件</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <button
              className="btn btn-primary"
              onClick={handleRunBacktest}
              disabled={loading || !klineData}
            >
              {loading ? '计算中...' : '开始回测'}
            </button>
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

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>回测策略</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(STRATEGIES).map(([key, s]) => (
              <div
                key={key}
                onClick={() => setStrategy(key)}
                style={{
                  padding: '12px',
                  background: strategy === key ? 'rgba(88,166,255,0.15)' : 'var(--bg-tertiary)',
                  border: `1px solid ${strategy === key ? 'var(--accent)' : 'transparent'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                  <span style={{ fontWeight: '600', color: strategy === key ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {s.name}
                  </span>
                  {strategy === key && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--accent)' }}>已选择</span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '32px' }}>
                  {s.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {strategy === 'fixed_weight' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>调仓周期</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.entries(REBALANCE_PERIODS).map(([key, label]) => (
                <button
                  key={key}
                  className={`btn ${rebalancePeriod === key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRebalancePeriod(key)}
                  style={{ cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {strategy === 'fixed_weight' && (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,200,0,0.1)', borderRadius: '6px', fontSize: '0.85rem' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>
              💡 固定权重策略说明
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>用期末股价计算目标权重（如NVDA 20%, AAPL 30%）</li>
              <li>回测开始时按当时股价买入，使各股票达到目标权重</li>
              <li>定期调仓：涨多的卖出、跌多的买入，维持目标权重</li>
              <li>优势：控制单一股票仓位，实现"高卖低买"</li>
              <li>注意：需要实际执行买卖操作，小资金更可行</li>
            </ul>
          </div>
        )}

        {strategy === 'fixed_shares' && (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,200,0,0.1)', borderRadius: '6px', fontSize: '0.85rem' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>
              💡 固定股数策略说明
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>直接用你当前的持仓股数（如AAPL 1126股, NVDA 1006股）</li>
              <li>假设从回测开始日就持有这些股票，一直持有到结束</li>
              <li>股票仓位会随价格变化而变化（涨了占比变大）</li>
              <li>这是最简单的"买入持有"策略</li>
              <li>反映你真实持仓的历史表现</li>
            </ul>
          </div>
        )}

        {strategy === 'decision' && (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,200,0,0.1)', borderRadius: '6px', fontSize: '0.85rem' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '500' }}>
              💡 决策回测策略说明
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>用期末股价算出你当前的目标权重</li>
              <li>假设在回测开始日，按这个权重分配现金买入股票</li>
              <li>买定离手，不再调仓，权重随价格自然变化</li>
              <li>例如：期末NVDA占20%，期初也按20%买，2016年NVDA才$0.73要买很多股</li>
              <li>测试"如果当时就知道现在的权重分配，收益如何"</li>
            </ul>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(255,82,82,0.1)', borderRadius: '4px', color: 'var(--red)', marginBottom: '16px', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {result && (
          <div>
            <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(88,166,255,0.1)', borderRadius: '4px', fontSize: '0.85rem' }}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {currentStrategy.icon} {currentStrategy.name} | 实际回测范围：{result.dailyData[0]?.date} ~ {result.dailyData[result.dailyData.length - 1]?.date}（共{result.stats.tradingDays}天）
              </div>
              {result.strategy === 'fixed_weight' && result.rebalancePeriod && (
                <div style={{ color: 'var(--text-secondary)' }}>
                  调仓周期：{REBALANCE_PERIODS[result.rebalancePeriod]}
                </div>
              )}
            </div>

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
          
            <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)', marginTop: '24px' }}>权重变化</h4>
            <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', background: 'var(--bg-secondary)' }}>股票</th>
                    <th style={{ padding: '8px', textAlign: 'right', background: 'var(--bg-secondary)' }}>期初权重</th>
                    <th style={{ padding: '8px', textAlign: 'right', background: 'var(--bg-secondary)' }}>期末权重</th>
                    <th style={{ padding: '8px', textAlign: 'right', background: 'var(--bg-secondary)' }}>权重变化</th>
                    <th style={{ padding: '8px', textAlign: 'right', background: 'var(--bg-secondary)' }}>贡献收益</th>
                  </tr>
                </thead>
                <tbody>
                  {result.positions.filter(pos => pos.symbol !== 'CASH').map(pos => (
                    <tr key={pos.symbol} style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                      <td style={{ padding: '8px' }}>{pos.symbol}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{(pos.initWeight * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--green)' }}>{(pos.endWeight * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: pos.endWeight > pos.initWeight ? 'var(--green)' : 'var(--red)' }}>
                        {((pos.endWeight - pos.initWeight) * 100 > 0 ? '+' : '')}{((pos.endWeight - pos.initWeight) * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: pos.contribution > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {pos.contribution > 0 ? '+' : ''}{pos.contribution.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                    <td style={{ padding: '8px', fontWeight: '500' }}>CASH</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{(result.cashInitWeight * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--green)' }}>{(result.cashEndWeight * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: result.cashEndWeight > result.cashInitWeight ? 'var(--green)' : 'var(--red)' }}>
                      {((result.cashEndWeight - result.cashInitWeight) * 100 > 0 ? '+' : '')}{((result.cashEndWeight - result.cashInitWeight) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: (result.cashInitWeight - result.cashEndWeight) > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {(result.cashInitWeight - result.cashEndWeight).toFixed(2)}
                    </td>
                  </tr>
                  <tr style={{ background: 'var(--bg-tertiary)', fontWeight: '600' }}>
                    <td style={{ padding: '8px' }}>合计</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>100%</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>100%</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>-</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: result.totalContribution > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {result.totalContribution > 0 ? '+' : ''}{result.totalContribution.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                贡献收益 = 期末NAV × 期末权重 - 100 × 期初权重，合计 = 期末NAV - 100 = 总收益
              </div>
            </div>

            <BacktestCharts dailyData={result.dailyData} />

            {result.dailyData.length > 0 && (
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>日期</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>净值</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>日收益率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.dailyData.slice(-50).reverse().map((d, i) => (
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
    </div>
  );
}

export default BacktestPage;
