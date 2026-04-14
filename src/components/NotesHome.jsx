import { useState, useEffect, useMemo } from 'react';
import { getAllSymbols, exportNotes } from '../utils/notes';
import { setActivePortfolio } from '../utils/manfolio';
import { useRouter } from '../utils/router';

export default function NotesHome() {
  const { navigate } = useRouter();
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllSymbols();
      setSymbols(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleClick = (symbol, name, portfolioId) => {
    if (portfolioId) {
      setActivePortfolio(portfolioId);
      navigate(`/note/${symbol}?name=${encodeURIComponent(name)}&portfolioId=${portfolioId}`);
    } else {
      navigate(`/note/${symbol}?name=${encodeURIComponent(name)}`);
    }
  };

  const portfolioSymbols = useMemo(() => symbols.filter(s => s.portfolioId), [symbols]);
  const stockSymbols = useMemo(() => symbols.filter(s => !s.portfolioId), [symbols]);

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <h1>加载中...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1 
          style={{ cursor: 'pointer' }}
          title="切换到组合管理"
          onClick={() => navigate('/manfolio')}
        >
          Mannote
        </h1>
        <div className="header-buttons">
          <button className="btn btn-secondary" onClick={exportNotes}>导出全部</button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {symbols.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
            暂无评论
          </div>
        ) : (
          <>
            {portfolioSymbols.length > 0 && (
              <>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  组合评论区
                </div>
                <div className="portfolio-list" style={{ marginBottom: '24px' }}>
                  {portfolioSymbols.map(s => (
                    <div 
                      key={s.portfolioId} 
                      className="portfolio-card"
                      onClick={() => handleClick(s.symbol, s.name, s.portfolioId)}
                    >
                      <div className="portfolio-card-header">
                        <span className="portfolio-name" style={{ fontWeight: 'bold', color: 'var(--blue)' }}>
                          {s.portfolioId}
                        </span>
                      </div>
                      <div className="portfolio-stats">
                        <div className="stat-item">
                          <span className="stat-label">组合名</span>
                          <span className="stat-value">{s.name}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">评论数</span>
                          <span className="stat-value">{s.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {stockSymbols.length > 0 && (
              <>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  股票评论区
                </div>
                <div className="portfolio-list">
                  {stockSymbols.map(s => (
                    <div 
                      key={s.symbol} 
                      className="portfolio-card"
                      onClick={() => handleClick(s.symbol, s.name, s.portfolioId)}
                    >
                      <div className="portfolio-card-header">
                        <span className="portfolio-name" style={{ fontWeight: 'bold', color: 'var(--blue)' }}>
                          {s.symbol}
                        </span>
                      </div>
                      <div className="portfolio-stats">
                        <div className="stat-item">
                          <span className="stat-label">股票名</span>
                          <span className="stat-value">{s.name}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">评论数</span>
                          <span className="stat-value">{s.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}