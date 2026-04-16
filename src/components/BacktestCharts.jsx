import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

function BacktestCharts({ dailyData }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const navRef = useRef(null);
  const drawdownRef = useRef(null);
  const weightRef = useRef(null);
  const rollingRef = useRef(null);
  const navChartRef = useRef(null);
  const drawdownChartRef = useRef(null);
  const weightChartRef = useRef(null);
  const rollingChartRef = useRef(null);

  useEffect(() => {
    if (!dailyData || dailyData.length === 0) return;

    const dates = dailyData.map(d => d.date);
    const navs = dailyData.map(d => d.nav);

    const drawdowns = [];
    let peak = dailyData[0].nav;
    dailyData.forEach(d => {
      if (d.nav > peak) peak = d.nav;
      const dd = (peak - d.nav) / peak * 100;
      drawdowns.push(-dd);
    });

    const rollingReturns = [];
    const rollingWindow = 20;
    for (let i = 0; i < dailyData.length; i++) {
      if (i < rollingWindow) {
        rollingReturns.push(null);
      } else {
        const startNav = dailyData[i - rollingWindow].nav;
        const endNav = dailyData[i].nav;
        const ret = (endNav - startNav) / startNav * 100;
        rollingReturns.push(ret);
      }
    }

    const baseOptions = {
      responsive: false,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
        },
        zoom: {
          zoom: {
            drag: {
              enabled: true,
              backgroundColor: 'rgba(88, 166, 255, 0.1)',
            },
            mode: 'x',
            onZoomComplete: ({ chart }) => {
              setTimeout(() => {
                if (chart._syncCharts) chart._syncCharts(chart);
              }, 0);
            },
          },
          pan: {
            enabled: true,
            mode: 'x',
          },
        },
      },
      events: ['mousemove', 'mouseout'],
      scales: {
        x: {
          display: true,
          ticks: { maxTicksLimit: 20 },
        },
        y: {
          display: true,
        },
      },
    };

    if (navChartRef.current) navChartRef.current.destroy();
    const navContainer = navRef.current.parentElement;
    navRef.current.width = navContainer.clientWidth;
    navRef.current.height = 200;
    navChartRef.current = new Chart(navRef.current, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          data: navs,
          borderColor: '#10b981',
          borderWidth: 1,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          title: { display: true, text: '累计收益率曲线' },
        },
        scales: {
          ...baseOptions.scales,
          y: {
            ...baseOptions.scales.y,
            ticks: { callback: v => v.toFixed(0) },
          },
        },
      },
    });
    navChartRef.current.options._syncZoom = true;

    if (drawdownChartRef.current) drawdownChartRef.current.destroy();
    const drawdownContainer = drawdownRef.current.parentElement;
    drawdownRef.current.width = drawdownContainer.clientWidth;
    drawdownRef.current.height = 200;
    drawdownChartRef.current = new Chart(drawdownRef.current, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          data: drawdowns,
          borderColor: '#ef4444',
          borderWidth: 1,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          title: { display: true, text: '回撤曲线' },
        },
        scales: {
          ...baseOptions.scales,
          y: {
            ...baseOptions.scales.y,
            ticks: { callback: v => v.toFixed(0) + '%' },
            max: 0,
          },
        },
      },
    });

    if (weightChartRef.current) weightChartRef.current.destroy();
    const weightContainer = weightRef.current.parentElement;
    weightRef.current.width = weightContainer.clientWidth;
    weightRef.current.height = 200;
    const symbols = [...new Set(dailyData.flatMap(d => d.weights.map(w => w.symbol)))];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    weightChartRef.current = new Chart(weightRef.current, {
      type: 'line',
      data: {
        labels: dates,
        datasets: symbols.map((sym, i) => ({
          label: sym,
          data: dailyData.map(d => {
            const w = d.weights.find(w => w.symbol === sym);
            return w ? w.weight * 100 : null;
          }),
          borderColor: colors[i % colors.length],
          borderWidth: 1,
          backgroundColor: 'transparent',
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        })),
      },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          title: { display: true, text: '权重变化' },
          legend: {
            display: true,
            position: 'bottom',
            labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
          },
        },
        scales: {
          ...baseOptions.scales,
          y: {
            ...baseOptions.scales.y,
            stacked: false,
            ticks: { callback: v => v.toFixed(0) + '%' },
            min: 0,
            max: 100,
          },
        },
      },
    });

    if (rollingChartRef.current) rollingChartRef.current.destroy();
    const rollingContainer = rollingRef.current.parentElement;
    rollingRef.current.width = rollingContainer.clientWidth;
    rollingRef.current.height = 200;
    rollingChartRef.current = new Chart(rollingRef.current, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          data: rollingReturns,
          borderColor: '#8b5cf6',
          borderWidth: 1,
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          title: { display: true, text: '20日滚动收益率' },
        },
        scales: {
          ...baseOptions.scales,
          y: {
            ...baseOptions.scales.y,
            ticks: { callback: v => v !== null ? v.toFixed(0) + '%' : '' },
          },
        },
      },
    });

    const allCharts = [navChartRef, drawdownChartRef, weightChartRef, rollingChartRef];

    const syncCharts = (sourceChart) => {
      if (sourceChart._syncing) return;
      sourceChart._syncing = true;
      
      const xScale = sourceChart.scales.x;
      const chartArea = sourceChart.chartArea;
      const minIndex = Math.round(xScale.getValueForPixel(chartArea.left));
      const maxIndex = Math.round(xScale.getValueForPixel(chartArea.right));

      allCharts.forEach(chartRef => {
        if (chartRef.current && chartRef.current !== sourceChart) {
          chartRef.current._syncing = true;
          chartRef.current.zoomScale('x', { min: minIndex, max: maxIndex });
          chartRef.current._syncing = false;
        }
      });
      
      sourceChart._syncing = false;
    };

    allCharts.forEach(chartRef => {
      if (chartRef.current) {
        chartRef.current._syncCharts = syncCharts;
      }
    });

    return () => {
      if (navChartRef.current) navChartRef.current.destroy();
      if (drawdownChartRef.current) drawdownChartRef.current.destroy();
      if (weightChartRef.current) weightChartRef.current.destroy();
      if (rollingChartRef.current) rollingChartRef.current.destroy();
    };
  }, [dailyData]);

  const filteredData = (() => {
    if (!dailyData || dailyData.length === 0) return dailyData;
    if (!startDate && !endDate) return dailyData;
    return dailyData.filter(d => {
      const date = d.date;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });
  })();

  useEffect(() => {
    const charts = [navChartRef, drawdownChartRef, weightChartRef, rollingChartRef];
    const data = filteredData || dailyData;
    if (!data || data.length === 0) return;

    const dates = data.map(d => d.date);
    const navs = data.map(d => d.nav);
    const drawdowns = [];
    let peak = data[0].nav;
    data.forEach(d => {
      if (d.nav > peak) peak = d.nav;
      drawdowns.push(-(peak - d.nav) / peak * 100);
    });
    const rollingReturns = [];
    const rollingWindow = 20;
    for (let i = 0; i < data.length; i++) {
      if (i < rollingWindow) {
        rollingReturns.push(null);
      } else {
        rollingReturns.push((data[i].nav - data[i - rollingWindow].nav) / data[i - rollingWindow].nav * 100);
      }
    }

    if (navChartRef.current) {
      navChartRef.current.data.labels = dates;
      navChartRef.current.data.datasets[0].data = navs;
      navChartRef.current.update();
    }
    if (drawdownChartRef.current) {
      drawdownChartRef.current.data.labels = dates;
      drawdownChartRef.current.data.datasets[0].data = drawdowns;
      drawdownChartRef.current.update();
    }
    if (weightChartRef.current) {
      const symbols = [...new Set(data.flatMap(d => d.weights.map(w => w.symbol)))];
      weightChartRef.current.data.labels = dates;
      weightChartRef.current.data.datasets = symbols.map((sym, i) => ({
        label: sym,
        data: data.map(d => {
          const w = d.weights.find(w => w.symbol === sym);
          return w ? w.weight * 100 : null;
        }),
        borderColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
        borderWidth: 1,
        backgroundColor: 'transparent',
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4,
      }));
      weightChartRef.current.update();
    }
    if (rollingChartRef.current) {
      rollingChartRef.current.data.labels = dates;
      rollingChartRef.current.data.datasets[0].data = rollingReturns;
      rollingChartRef.current.update();
    }
  }, [filteredData]);

  if (!dailyData || dailyData.length === 0) return null;

  const chartList = [
    { canvasRef: navRef, title: '累计收益率曲线' },
    { canvasRef: drawdownRef, title: '回撤曲线' },
    { canvasRef: weightRef, title: '权重变化' },
    { canvasRef: rollingRef, title: '20日滚动收益率' },
  ];

  const handleResetZoom = () => {
    navChartRef.current?.resetZoom();
    drawdownChartRef.current?.resetZoom();
    weightChartRef.current?.resetZoom();
    rollingChartRef.current?.resetZoom();
    setStartDate('');
    setEndDate('');
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>时间范围:</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>~</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <button
          onClick={handleResetZoom}
          style={{
            padding: '4px 12px',
            fontSize: '0.75rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          重置
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {chartList.map((chart, index) => (
          <div key={index} style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', position: 'relative' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '8px', color: 'var(--text-primary)' }}>
              {chart.title}
            </div>
            <div style={{ height: '200px' }}>
              <canvas ref={chart.canvasRef}></canvas>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BacktestCharts;
