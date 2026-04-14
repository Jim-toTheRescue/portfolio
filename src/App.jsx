import { useState, useEffect, useRef } from 'react';
import { usePortfolio } from './hooks/usePortfolio';
import { Header, Summary } from './components/Header';
import TierCard from './components/TierCard';
import { AddModal, AddPositionModal, ReducePositionModal, ClearPositionModal, CashModal, MockPriceModal, RatesModal } from './components/Modals';
import { HistoryPanel, Toast } from './components/History';
import ConfigModal from './components/ConfigModal';
import { getConfig } from './utils/constants';
import { parseMarket, convertCurrency } from './utils/helpers';
import { useRouter } from './utils/router';
import { initManfolio, setActivePortfolio, getActivePortfolio, getClosedPositions } from './utils/manfolio';
import ManfolioHome from './components/ManfolioHome';
import NotesHome from './components/NotesHome';
import PortfolioApp from './PortfolioApp';
import NotesPage from './components/NotesPage';
import './styles/App.css';

function App() {
  const { path, navigate } = useRouter();

  useEffect(() => {
    initManfolio();
  }, []);

  // 如果是首页路由，显示 ManfolioHome
  if (path === '/manfolio' || path === '/') {
    return <ManfolioHome />;
  }

  // 如果是笔记首页
  if (path === '/notes') {
    return <NotesHome />;
  }

  // 如果是笔记页面
  if (path.startsWith('/note/')) {
    // 保存返回路径
    const referrer = document.referrer;
    let backUrl = '/notes';
    if (referrer) {
      const referrerPath = referrer.split('#')[1];
      if (referrerPath && (referrerPath.startsWith('/folio/') || referrerPath.startsWith('/notes'))) {
        backUrl = referrerPath;
        // 如果是从portfolio页面跳转，设置active portfolio
        if (referrerPath.startsWith('/folio/')) {
          const portfolioId = referrerPath.split('/folio/')[1];
          if (portfolioId) {
            setActivePortfolio(portfolioId);
          }
        }
      }
    }
    window.sessionStorage.setItem('backUrl', backUrl);
    return <NotesPage />;
  }

  // 如果是 portfolio 页面，使用 PortfolioApp
  if (path.startsWith('/folio/')) {
    const id = path.split('/folio/')[1];
    if (id) {
      setActivePortfolio(id);
      window.sessionStorage.setItem('backUrl', path);
      return <PortfolioAppWrapper folioId={id} navigate={navigate} />;
    }
  }

  return <ManfolioHome />;
}

function PortfolioAppWrapper({ folioId, navigate }) {
  const [nameKey, setNameKey] = useState(0);
  const portfolio = getActivePortfolio();
  const portfolioName = portfolio?.name || '';
  const {
    positions,
    cash,
    history,
    priceTime,
    toast,
    total,
    stockValue,
    displayCurrency,
    exchangeRates,
    cashCurrency,
    addPosition,
    adjustPosition,
    clearPosition,
    fixCash,
    moveCash,
    refreshPrices,
    applyMockPrice,
    exportData,
    importData,
    clearHistory,
    getRecommendation,
    showToast,
    fetchExchangeRates,
    changeDisplayCurrency,
    setManualRate,
    getDisplayTotalWithCash,
    getDisplayStockValue,
    getDisplayCash,
    getDisplayValue,
    total: totalSettle,
  } = usePortfolio();

  // 进入页面时自动刷新价格
  useEffect(() => {
    if (positions.length > 0) {
      refreshPrices();
    }
  }, []);

  // 计算组合盈亏
  const closedPositions = getClosedPositions();
  const pnlTotal = getDisplayTotalWithCash();
  
  const realizedSettle = closedPositions.reduce((sum, p) => {
    const rawPnl = p.pnl || 0;
    return sum + convertCurrency(rawPnl, p.currency, cashCurrency, exchangeRates);
  }, 0);
  const unrealizedSettle = positions.reduce((sum, p) => {
    const { currency } = parseMarket(p.symbol);
    const rawUnrealized = p.shares * (p.price - p.avgCost);
    return sum + convertCurrency(rawUnrealized, currency, cashCurrency, exchangeRates);
  }, 0);
  
  const realizedPnL = convertCurrency(realizedSettle, cashCurrency, displayCurrency, exchangeRates);
  const unrealizedPnL = convertCurrency(unrealizedSettle, cashCurrency, displayCurrency, exchangeRates);
  const totalPnL = realizedPnL + unrealizedPnL;
  const pnlPercent = pnlTotal > 0 ? ((totalPnL / pnlTotal) * 100).toFixed(1) + '%' : '0.0%';

  const handleBack = () => {
    navigate('/manfolio');
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showReducePositionModal, setShowReducePositionModal] = useState(false);
  const [showClearPositionModal, setShowClearPositionModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showMockPriceModal, setShowMockPriceModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);

  useEffect(() => {
    const handleImport = (e) => {
      importData(e.detail);
    };
    window.addEventListener('import-data', handleImport);
    return () => window.removeEventListener('import-data', handleImport);
  }, [importData]);

  const handleAdd = (symbol) => {
    const pos = positions.find(p => p.symbol === symbol);
    if (pos) {
      setSelectedPosition(pos);
      setShowAddPositionModal(true);
    }
  };

  const handleReduce = (symbol) => {
    const pos = positions.find(p => p.symbol === symbol);
    if (pos) {
      setSelectedPosition(pos);
      setShowReducePositionModal(true);
    }
  };

  const handleClear = (symbol) => {
    const pos = positions.find(p => p.symbol === symbol);
    if (pos) {
      setSelectedPosition(pos);
      setShowClearPositionModal(true);
    }
  };

  const [confirmClear, setConfirmClear] = useState(null);

  return (
    <div className="app">
      <Header
        key={nameKey}
        onBack={handleBack}
        onRefresh={refreshPrices}
        onClearHistory={() => {
          if (confirm('确认清空历史记录?')) {
            clearHistory();
          }
        }}
        onToggleHistory={() => setShowHistory(!showHistory)}
        onExport={exportData}
        onMockPrice={() => setShowMockPriceModal(true)}
        onConfig={() => setShowConfigModal(true)}
        onRates={() => setShowRatesModal(true)}
        portfolioName={portfolioName}
        onNameChange={() => setNameKey(k => k + 1)}
      />

      <Summary
        stockValue={getDisplayStockValue()}
        cash={getDisplayCash()}
        total={getDisplayTotalWithCash()}
        totalInCashCurrency={totalSettle}
        priceTime={priceTime}
        onCashClick={() => setShowCashModal(true)}
        displayCurrency={displayCurrency}
        cashCurrency={cashCurrency}
        onCurrencyChange={changeDisplayCurrency}
        history={history}
        exchangeRates={exchangeRates}
        pnl={totalPnL}
        pnlPercent={pnlPercent}
        realizedPnL={realizedPnL}
        unrealizedPnL={unrealizedPnL}
      />

      <div className="add-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + 建仓
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate(`/note/${folioId}?name=${encodeURIComponent(portfolioName)}&isPortfolio=true`)}
        >
          💬 评论
        </button>
      </div>

      <div className="main-content">
        {getConfig().map((_, i) => (
          <TierCard
            key={i + 1}
            tier={i + 1}
            positions={positions}
            cash={cash}
            total={getDisplayTotalWithCash()}
            onAdd={handleAdd}
            onReduce={handleReduce}
            onClear={handleClear}
            onNote={(symbol, name) => navigate(`/note/${symbol}?name=${encodeURIComponent(name)}`)}
            confirmClear={confirmClear}
            displayCurrency={displayCurrency}
            exchangeRates={exchangeRates}
            cashCurrency={cashCurrency}
            getDisplayValue={getDisplayValue}
            getDisplayTotalWithCash={getDisplayTotalWithCash}
            history={history}
          />
        ))}
      </div>

      <HistoryPanel
        show={showHistory}
        history={history}
        onToggle={() => setShowHistory(!showHistory)}
        onClear={clearHistory}
      />

      <AddModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        positions={positions}
        cash={cash}
        cashCurrency={cashCurrency}
        onAdd={addPosition}
        getRecommendation={getRecommendation}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
      />

      <AddPositionModal
        show={showAddPositionModal}
        onClose={() => {
          setShowAddPositionModal(false);
          setSelectedPosition(null);
        }}
        position={selectedPosition}
        positions={positions}
        cash={cash}
        cashCurrency={cashCurrency}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        onAdjust={adjustPosition}
        getRecommendation={getRecommendation}
      />

      <ReducePositionModal
        show={showReducePositionModal}
        onClose={() => {
          setShowReducePositionModal(false);
          setSelectedPosition(null);
        }}
        position={selectedPosition}
        positions={positions}
        cash={cash}
        cashCurrency={cashCurrency}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        onAdjust={adjustPosition}
        getRecommendation={getRecommendation}
      />

      <ClearPositionModal
        show={showClearPositionModal}
        onClose={() => {
          setShowClearPositionModal(false);
          setSelectedPosition(null);
        }}
        position={selectedPosition}
        cash={cash}
        cashCurrency={cashCurrency}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        onClear={clearPosition}
      />

      <CashModal
        show={showCashModal}
        onClose={() => setShowCashModal(false)}
        cash={cash}
        onConfirm={fixCash}
        onConfirmWithLog={moveCash}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        cashCurrency={cashCurrency}
      />

      <MockPriceModal
        show={showMockPriceModal}
        onClose={() => setShowMockPriceModal(false)}
        onConfirm={applyMockPrice}
      />

      <ConfigModal
        show={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        readOnly={true}
        cashCurrency={cashCurrency}
      />

      <RatesModal
        show={showRatesModal}
        onClose={() => setShowRatesModal(false)}
        exchangeRates={exchangeRates}
        onFetchRates={fetchExchangeRates}
      />

      <Toast message={toast} />
    </div>
  );
}

export default App;
export { PortfolioAppWrapper };