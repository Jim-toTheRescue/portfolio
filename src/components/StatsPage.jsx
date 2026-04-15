import { useState, useEffect, useRef } from 'react';
import { useRouter } from '../utils/router';
import { getActivePortfolio, setActivePortfolio, getNetValueHistory, canRecordNetValue, saveNetValue, getExchangeRates } from '../utils/manfolio';
import { parseMarket, convertCurrency, getCurrencySymbol } from '../utils/helpers';
import Chart from 'chart.js/auto';
import zoom from 'chartjs-plugin-zoom';
Chart.register(zoom);

export default function StatsPage({ portfolioId: propPortfolioId }) {
  const { navigate } = useRouter();
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const isInternalUpdating = useRef(false);
  const displayDataRef = useRef([]);
  const currentDisplayDataRef = useRef([]);
  const [stats, setStats] = useState(null);
  const [netValueData, setNetValueData] = useState([]);
  const [portfolioId, setPortfolioId] = useState(propPortfolioId || null);
  const [canRecord, setCanRecord] = useState(false);
  const [recording, setRecording] = useState(false);
  const [indexPrices, setIndexPrices] = useState({ nasdaq100: null, hsi: null, sp500: null });
  const [lastRecordInfo, setLastRecordInfo] = useState(null);
  const [isSunday] = useState(() => new Date().getDay() === 0);
  const [timeRange, setTimeRange] = useState('all');
  const [isRendering, setIsRendering] = useState(false);
  const [showFill, setShowFill] = useState(false);
  const [lineWidth, setLineWidth] = useState(1);
  const [displayCurrency, setDisplayCurrency] = useState('CNY');

  useEffect(() => {
    const id = propPortfolioId || getActivePortfolio()?.name || 'default';
    setPortfolioId(id);
    setActivePortfolio(id);
    
    const portfolio = getActivePortfolio();
    const history = getNetValueHistory(id);
    setNetValueData(history);
    setCanRecord(canRecordNetValue(id));
    setDisplayCurrency(portfolio.cashCurrency || 'CNY');
    
    if (history.length > 0) {
      const last = history[history.length - 1];
      setLastRecordInfo(last);
    }
    
    calculateStats(portfolio);
    fetchIndexPrices();
  }, [propPortfolioId]);

  useEffect(() => {
    if (netValueData.length > 0 && chartRef.current) {
      renderChart();
    }
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [netValueData, timeRange, showFill, lineWidth]);

  const fetchIndexPrices = async () => {
    try {
      const response = await fetch('https://qt.gtimg.cn/q=usNDX,hkHSI,us.INX');
      const text = await response.text();
      const stocks = text.split(';');
      
      let nasdaq100 = null, hsi = null, sp500 = null;
      stocks.forEach(stockData => {
        if (!stockData || stockData.indexOf('~') < 0) return;
        const fields = stockData.split('~');
        if (fields[0].includes('NDX')) {
          nasdaq100 = parseFloat(fields[3]);
        } else if (fields[0].includes('HSI')) {
          hsi = parseFloat(fields[3]);
        } else if (fields[0].includes('INX')) {
          sp500 = parseFloat(fields[3]);
        }
      });
      
      setIndexPrices({ nasdaq100, hsi, sp500 });
    } catch (e) {
      console.error('Failed to fetch index prices:', e);
    }
  };

  const calculateStats = (portfolio) => {
    if (!portfolio) return;

    const rates = getExchangeRates() || { USD: 1, CNY: 7.1, HKD: 7.75 };
    const settleCurrency = getActivePortfolio()?.cashCurrency || 'CNY';
    
    // 计算未实现盈亏
    let unrealizedPnl = 0;
    portfolio.positions.forEach(pos => {
      const { currency } = parseMarket(pos.symbol);
      const cost = pos.shares * pos.avgCost;
      const value = pos.shares * pos.price;
      const costInSettle = convertCurrency(cost, currency, settleCurrency, rates);
      const valueInSettle = convertCurrency(value, currency, settleCurrency, rates);
      unrealizedPnl += valueInSettle - costInSettle;
    });

    // 计算已实现盈亏
    let realizedPnl = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    let buyCount = 0;
    let sellCount = 0;
    let profitableSellCount = 0;
    
    (portfolio.closedPositions || []).forEach(pos => {
      const pnl = convertCurrency(pos.pnl, pos.currency || 'USD', settleCurrency, rates);
      realizedPnl += pnl;
    });

    // 从历史记录计算交易统计
    const holdDaysMap = {};
    (portfolio.history || []).forEach(h => {
      const { currency } = parseMarket(h.symbol || '.US');
      if (h.action === '建仓' || h.action === '加仓') {
        const amount = convertCurrency((h.adjShares || 0) * (h.price || 0), currency, settleCurrency, rates);
        totalBuyAmount += amount;
        buyCount++;
        if (!holdDaysMap[h.symbol]) {
          holdDaysMap[h.symbol] = { buyDate: h.time, shares: 0 };
        }
        holdDaysMap[h.symbol].shares += (h.adjShares || 0);
      } else if (h.action === '减仓' || h.action === '清仓') {
        const amount = convertCurrency((h.adjShares || 0) * (h.price || 0), currency, settleCurrency, rates);
        totalSellAmount += amount;
        sellCount++;
        if (holdDaysMap[h.symbol]) {
          const costBasis = holdDaysMap[h.symbol].shares * (h.price || 0) * 0.95;
          if (amount > costBasis) {
            profitableSellCount++;
          }
        }
      }
    });

    // 计算市场分布
    let usValue = 0, hkValue = 0, cnValue = 0;
    portfolio.positions.forEach(pos => {
      const { currency, market } = parseMarket(pos.symbol);
      const valueInSettle = convertCurrency(pos.value, currency, settleCurrency, rates);
      if (market === 'US') usValue += valueInSettle;
      else if (market === 'HK') hkValue += valueInSettle;
      else cnValue += valueInSettle;
    });
    const totalStockValue = usValue + hkValue + cnValue;

    // 计算梯队分布
    const tierDist = {};
    portfolio.positions.forEach(pos => {
      const tier = pos.tier || 3;
      const { currency } = parseMarket(pos.symbol);
      const value = convertCurrency(pos.value, currency, settleCurrency, rates);
      tierDist[tier] = (tierDist[tier] || 0) + value;
    });

    // 计算现金占比
    const cash = convertCurrency(portfolio.cash || 0, settleCurrency, settleCurrency, rates);
    const totalValue = totalStockValue + cash;

    setStats({
      realizedPnl,
      unrealizedPnl,
      totalPnl: realizedPnl + unrealizedPnl,
      totalBuyAmount,
      totalSellAmount,
      buyCount,
      sellCount,
      profitableSellCount,
      profitableSellRatio: sellCount > 0 ? (profitableSellCount / sellCount * 100).toFixed(1) : '0',
      marketDist: {
        US: totalStockValue > 0 ? (usValue / totalStockValue * 100).toFixed(1) : '0',
        HK: totalStockValue > 0 ? (hkValue / totalStockValue * 100).toFixed(1) : '0',
        CN: totalStockValue > 0 ? (cnValue / totalStockValue * 100).toFixed(1) : '0'
      },
      tierDist,
      cashRatio: totalValue > 0 ? (cash / totalValue * 100).toFixed(1) : '0',
      totalValue,
      cash,
      stockValue: totalStockValue,
      settleCurrency,
      exchangeRates: rates
    });
  };

  const handleZoomComplete = ({ chart }) => {
    if (isInternalUpdating.current) return;
    isInternalUpdating.current = true;

    try {
      const xScale = chart.scales.x;
      const currentData = displayDataRef.current;

      const startIdx = Math.max(0, Math.ceil(xScale.min));
      const endIdx = Math.min(currentData.length - 1, Math.floor(xScale.max));

      if (startIdx >= endIdx) return;

      const startDate = currentData[startIdx].date;
      const endDate = currentData[endIdx].date;

      const sliced = netValueData.filter(d => d.date >= startDate && d.date <= endDate);

      if (sliced.length < 2) return;

      currentDisplayDataRef.current = sliced;
      const base = sliced[0];

      chart.destroy();

      const labels = sliced.map(d => d.date);
      const datasets = [
        {
          label: '组合',
          data: sliced.map(d => Number((d.value / base.value).toFixed(4))),
          borderColor: '#34c759',
          backgroundColor: 'rgba(66, 133, 244, 0.1)',
          tension: 0.4,
          fill: showFill,
          borderWidth: lineWidth,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true
        }
      ];

      if (sliced.some(d => d.nasdaq100)) {
        datasets.push({
          label: '纳斯达克100',
          data: sliced.map(d => base.nasdaq100 && d.nasdaq100 ? Number((d.nasdaq100 / base.nasdaq100).toFixed(4)) : null),
          borderColor: '#f44242',
          backgroundColor: 'transparent',
          tension: 0.4,
          fill: false,
          borderWidth: lineWidth,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true
        });
      }

      if (sliced.some(d => d.hsi)) {
        datasets.push({
          label: '恒生指数',
          data: sliced.map(d => base.hsi && d.hsi ? Number((d.hsi / base.hsi).toFixed(4)) : null),
          borderColor: '#4285f4',
          backgroundColor: 'transparent',
          tension: 0.4,
          fill: false,
          borderWidth: lineWidth,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true
        });
      }

      if (sliced.some(d => d.sp500)) {
        datasets.push({
          label: '标普500',
          data: sliced.map(d => base.sp500 && d.sp500 ? Number((d.sp500 / base.sp500).toFixed(4)) : null),
          borderColor: '#ff9500',
          backgroundColor: 'transparent',
          tension: 0.4,
          fill: false,
          borderWidth: lineWidth,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: true
        });
      }

      const newChart = new Chart(chartRef.current, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 12, padding: 8 } },
            title: { display: true, text: '净值曲线（归一化）' },
            zoom: {
              zoom: {
                drag: { enabled: true, backgroundColor: 'rgba(66, 133, 244, 0.1)' },
                mode: 'x',
                onZoomComplete: handleZoomComplete
              }
            }
          },
          scales: {
            x: { ticks: { maxTicksLimit: 20 } },
            y: { beginAtZero: false }
          }
        }
      });

      chartInstance.current = newChart;

    } finally {
      isInternalUpdating.current = false;
    }
  };

  const renderChart = async () => {
    if (isRendering) return;
    setIsRendering(true);
    
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
    
    const existingChart = Chart.getChart(chartRef.current);
    if (existingChart) {
      existingChart.destroy();
    }
    
    let data = netValueData;
    if (data.length < 2) {
      setIsRendering(false);
      return;
    }

    let displayData = data;
    
    if (currentDisplayDataRef.current.length > 0) {
      displayData = currentDisplayDataRef.current;
    } else {
      if (timeRange !== 'all') {
        const now = new Date();
        const weeks = parseInt(timeRange);
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - weeks * 7);
        displayData = data.filter(d => new Date(d.date) >= cutoff);
        
        if (displayData.length < 2) {
          displayData = data;
        }
      }
    }

    if (currentDisplayDataRef.current.length === 0) {
      const totalPoints = displayData.length;
      let sampleRate = 1;
      if (totalPoints > 200) sampleRate = 2;
      if (totalPoints > 400) sampleRate = 4;
      if (totalPoints > 600) sampleRate = 8;
      
      if (sampleRate > 1) {
        const sampled = [];
        const step = Math.ceil(totalPoints / (200 / sampleRate));
        for (let i = totalPoints - 1; i >= 0; i -= step) {
          sampled.unshift(displayData[i]);
        }
        if (sampled[0] !== displayData[0]) {
          sampled.unshift(displayData[0]);
        }
        displayData = sampled;
      }
    }

    displayDataRef.current = displayData;
    currentDisplayDataRef.current = displayData;

    // 归一化：以第一天的值为基准
    const baseValue = displayData[0].value;
    const baseNasdaq100 = displayData[0].nasdaq100;
    const baseHSI = displayData[0].hsi;
    const baseSP500 = displayData[0].sp500;

    const labels = displayData.map(d => d.date);
    const portfolioValues = displayData.map(d => (d.value / baseValue).toFixed(4));
    const nasdaq100Values = displayData.map(d => baseNasdaq100 && d.nasdaq100 ? (d.nasdaq100 / baseNasdaq100).toFixed(4) : null);
    const hsiValues = displayData.map(d => baseHSI && d.hsi ? (d.hsi / baseHSI).toFixed(4) : null);
    const sp500Values = displayData.map(d => baseSP500 && d.sp500 ? (d.sp500 / baseSP500).toFixed(4) : null);

    const datasets = [
      {
        label: '组合',
        data: portfolioValues,
        borderColor: '#34c759',
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        tension: 0.4,
        fill: showFill,
        borderWidth: lineWidth,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true
      }
    ];
    
    if (nasdaq100Values.some(v => v !== null)) {
      datasets.push({
        label: '纳斯达克100',
        data: nasdaq100Values,
        borderColor: '#f44242',
        backgroundColor: 'transparent',
        tension: 0.4,
        fill: false,
        borderWidth: lineWidth,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true
      });
    }
    
    if (hsiValues.some(v => v !== null)) {
      datasets.push({
        label: '恒生指数',
        data: hsiValues,
        borderColor: '#4285f4',
        backgroundColor: 'transparent',
        tension: 0.4,
        fill: false,
        borderWidth: lineWidth,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true
      });
    }
    
    if (sp500Values.some(v => v !== null)) {
      datasets.push({
        label: '标普500',
        data: sp500Values,
        borderColor: '#ff9500',
        backgroundColor: 'transparent',
        tension: 0.4,
        fill: false,
        borderWidth: lineWidth,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: true
      });
    }

    const chart = new Chart(chartRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                size: 10
              },
              boxWidth: 12,
              padding: 8
            }
          },
          title: {
            display: true,
            text: '净值曲线（归一化）'
          },
          zoom: {
            zoom: {
              drag: {
                enabled: true,
                backgroundColor: 'rgba(66, 133, 244, 0.1)',
              },
              mode: 'x',
              onZoomComplete: handleZoomComplete
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 20
            }
          },
          y: {
            beginAtZero: false
          }
        }
      }
    });
    chartInstance.current = chart;
    setIsRendering(false);
  };

  const handleRecordNetValue = async () => {
    if (!canRecord || recording || !stats) return;
    
    setRecording(true);
    
    try {
      // 获取最新指数价格
      await fetchIndexPrices();
      
      const portfolio = getActivePortfolio();
      const rates = getExchangeRates() || { USD: 1, CNY: 7.1, HKD: 7.75 };
      const settleCurrency = getActivePortfolio()?.cashCurrency || 'CNY';
      
      // 计算总价值
      let totalValue = portfolio.cash || 0;
      portfolio.positions.forEach(pos => {
        const { currency } = parseMarket(pos.symbol);
        totalValue += convertCurrency(pos.value, currency, settleCurrency, rates);
      });
      
      saveNetValue(
        portfolioId,
        totalValue,
        indexPrices.nasdaq100,
        indexPrices.hsi,
        indexPrices.sp500
      );
      
      const history = getNetValueHistory(portfolioId);
      setNetValueData(history);
      setCanRecord(false);
      setLastRecordInfo(history[history.length - 1]);
      
      // 重新渲染图表
      setTimeout(() => renderChart(), 100);
    } catch (e) {
      console.error('Failed to record net value:', e);
    }
    
    setRecording(false);
  };

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/manfolio');
    }
  };

  const handleResetZoom = () => {
    currentDisplayDataRef.current = [];
    renderChart();
  };

  if (!stats) {
    return <div className="app"><div className="header"><h1>加载中...</h1></div></div>;
  }

  const currencySymbol = getCurrencySymbol(displayCurrency);
  
  const formatValue = (value) => {
    const converted = convertCurrency(value, stats.settleCurrency, displayCurrency, stats.exchangeRates);
    return `${currencySymbol}${converted.toFixed(0)}`;
  };

  return (
    <div className="app">
<div className="header">
        <h1>
          <span onClick={() => window.history.back()} style={{ cursor: 'pointer' }}>Stats</span>
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Liquidity Matters!</span>
        </div>
        <div className="header-buttons">
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              const currencies = ['CNY', 'USD', 'HKD'];
              const currentIdx = currencies.indexOf(displayCurrency);
              const nextIdx = (currentIdx + 1) % currencies.length;
              setDisplayCurrency(currencies[nextIdx]);
            }}
          >
            {currencySymbol} {displayCurrency}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* 采集按钮 */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className={`btn ${canRecord ? 'btn-primary' : 'btn-secondary'}`}
            style={canRecord ? { border: '2px solid var(--blue)', fontWeight: 'bold' } : {}}
            onClick={handleRecordNetValue}
            disabled={!canRecord || recording}
          >
            {recording ? '采集中...' : canRecord ? '采集本周净值' : (isSunday ? '本周已采集' : '每周日采集')}
          </button>
          {lastRecordInfo && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {lastRecordInfo.date} | 组合: {lastRecordInfo.value?.toLocaleString()} | 
              纳斯达克100: {indexPrices.nasdaq100?.toFixed(2) || lastRecordInfo.nasdaq100?.toFixed(2)} | 
              恒生: {indexPrices.hsi?.toFixed(2) || lastRecordInfo.hsi?.toFixed(2)} | 
              标普500: {indexPrices.sp500?.toFixed(2) || lastRecordInfo.sp500?.toFixed(2)}
            </span>
          )}
        </div>

        {/* 净值曲线图 */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '48px',
          height: '300px',
          position: 'relative'
        }}>
          {netValueData.length < 2 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', paddingTop: '100px' }}>
              需要至少2条数据才能显示曲线图
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                {[
                  { value: '52', label: '1年' },
                  { value: '156', label: '3年' },
                  { value: '260', label: '5年' },
                  { value: 'all', label: '全部' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      currentDisplayDataRef.current = [];
                      setTimeRange(opt.value);
                    }}
                    style={{
                      fontSize: '10px',
                      padding: '4px 8px',
                      background: timeRange === opt.value ? 'var(--blue)' : 'var(--bg-tertiary)',
                      color: timeRange === opt.value ? '#fff' : 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                <button 
                  onClick={handleResetZoom}
                  style={{ 
                    fontSize: '10px',
                    padding: '4px 8px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  重置
                </button>
                <button 
                  onClick={() => setShowFill(!showFill)}
                  style={{ 
                    fontSize: '10px',
                    padding: '4px 8px',
                    background: showFill ? 'var(--blue)' : 'var(--bg-tertiary)',
                    color: showFill ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  填充
                </button>
                <span style={{ fontSize: '10px', marginLeft: '8px' }}>粗细</span>
                <button onClick={() => setLineWidth(Math.max(0.5, lineWidth - 0.5))} style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>-</button>
                <span style={{ fontSize: '10px', margin: '0 4px' }}>{lineWidth}</span>
                <button onClick={() => setLineWidth(lineWidth + 0.5)} style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>+</button>
              </div>
              <canvas ref={chartRef}></canvas>
            </>
          )}
        </div>

        {/* 收益统计 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>收益统计</h3>
          <div style={gridStyle}>
            <StatCard label="已实现盈亏" value={formatValue(stats.realizedPnl)} color={stats.realizedPnl >= 0} />
            <StatCard label="未实现盈亏" value={formatValue(stats.unrealizedPnl)} color={stats.unrealizedPnl >= 0} />
            <StatCard label="总盈亏" value={formatValue(stats.totalPnl)} color={stats.totalPnl >= 0} />
          </div>
        </div>

        {/* 交易统计 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>交易统计</h3>
          <div style={gridStyle}>
            <StatCard label="累计买入" value={`${stats.buyCount}次`} sub={formatValue(stats.totalBuyAmount)} />
            <StatCard label="累计卖出" value={`${stats.sellCount}次`} sub={formatValue(stats.totalSellAmount)} />
            <StatCard label="盈利卖出占比" value={`${stats.profitableSellRatio}%`} color={parseFloat(stats.profitableSellRatio) >= 50} />
          </div>
        </div>

        {/* 持仓分布 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>持仓分布</h3>
          <div style={gridStyle}>
            <StatCard label="美股占比" value={`${stats.marketDist.US}%`} />
            <StatCard label="港股占比" value={`${stats.marketDist.HK}%`} />
            <StatCard label="A股占比" value={`${stats.marketDist.CN}%`} />
            <StatCard label="现金占比" value={`${stats.cashRatio}%`} />
          </div>
        </div>

        {/* 梯队分布 */}
        <div style={sectionStyle}>
          <h3 style={titleStyle}>梯队分布</h3>
          <div style={gridStyle}>
            {Object.entries(stats.tierDist).map(([tier, value]) => (
              <StatCard 
                key={tier} 
                label={`T${tier}`} 
                value={formatValue(value)}
                sub={`${((value / stats.stockValue) * 100).toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  const valueColor = color === undefined ? 'inherit' : (color ? 'var(--green)' : 'var(--red)');
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      padding: '12px',
      borderRadius: '6px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: valueColor }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

const sectionStyle = {
  marginBottom: '32px'
};

const titleStyle = {
  fontSize: '0.9rem',
  marginBottom: '12px',
  color: 'var(--text-primary)'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '12px'
};
