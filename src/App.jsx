import { useState, useEffect, useRef } from 'react';
import { usePortfolio } from './hooks/usePortfolio';
import { Header, Summary } from './components/Header';
import TierCard from './components/TierCard';
import { AddModal, AddPositionModal, ReducePositionModal, CashModal, MockPriceModal } from './components/Modals';
import { HistoryPanel, Toast } from './components/History';
import ConfigModal from './components/ConfigModal';
import { getConfig } from './utils/constants';
import { useRouter } from './utils/router';
import { initManfolio, setActivePortfolio, getActivePortfolio } from './utils/manfolio';
import ManfolioHome from './components/ManfolioHome';
import PortfolioApp from './PortfolioApp';
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

  // 如果是 portfolio 页面，使用 PortfolioApp
  if (path.startsWith('/folio/')) {
    const id = path.split('/folio/')[1];
    if (id) {
      setActivePortfolio(id);
      return <PortfolioAppWrapper folioId={id} navigate={navigate} />;
    }
  }

  return <ManfolioHome />;
}

function PortfolioAppWrapper({ folioId, navigate }) {
  const {
    positions,
    cash,
    history,
    priceTime,
    toast,
    total,
    stockValue,
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
    showToast
  } = usePortfolio();

  // 进入页面时自动刷新价格
  useEffect(() => {
    if (positions.length > 0) {
      refreshPrices();
    }
  }, []);

  const handleBack = () => {
    navigate('/manfolio');
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showReducePositionModal, setShowReducePositionModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showMockPriceModal, setShowMockPriceModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
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

  const [confirmClear, setConfirmClear] = useState(null);

  const handleClear = (symbol) => {
    if (confirmClear === symbol) {
      clearPosition(symbol);
      setConfirmClear(null);
    } else {
      setConfirmClear(symbol);
      setTimeout(() => setConfirmClear(null), 3000);
    }
  };

  return (
    <div className="app">
      <Header
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
      />

      <Summary
        stockValue={stockValue}
        cash={cash}
        total={total}
        priceTime={priceTime}
        onCashClick={() => setShowCashModal(true)}
      />

      <div className="add-section">
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + 建仓
        </button>
      </div>

      <div className="main-content">
        {getConfig().map((_, i) => (
          <TierCard
            key={i + 1}
            tier={i + 1}
            positions={positions}
            total={total}
            onAdd={handleAdd}
            onReduce={handleReduce}
            onClear={handleClear}
            confirmClear={confirmClear}
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
        onAdd={addPosition}
        getRecommendation={getRecommendation}
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
        onAdjust={adjustPosition}
        getRecommendation={getRecommendation}
      />

      <CashModal
        show={showCashModal}
        onClose={() => setShowCashModal(false)}
        cash={cash}
        onConfirm={fixCash}
        onConfirmWithLog={moveCash}
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
      />

      <Toast message={toast} />
    </div>
  );
}

export default App;
export { PortfolioAppWrapper };