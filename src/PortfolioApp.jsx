import { useState, useEffect, useRef } from 'react';
import { usePortfolio } from './hooks/usePortfolio';
import { Header, Summary } from './components/Header';
import TierCard from './components/TierCard';
import { AddModal, AddPositionModal, ReducePositionModal, CashModal, MockPriceModal } from './components/Modals';
import { HistoryPanel, Toast } from './components/History';
import ConfigModal from './components/ConfigModal';
import { getConfig } from './utils/constants';
import { useRouter } from './utils/router';
import './styles/App.css';
function PortfolioApp() {
  const { navigate } = useRouter();
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showReducePositionModal, setShowReducePositionModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showMockPriceModal, setShowMockPriceModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);

  // 监听导入事件
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
    if (confirm(`确认清仓 ${symbol}?`)) {
      clearPosition(symbol);
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

      <div className="tier-list">
        {getConfig().map((tier, i) => (
          <TierCard
            key={i}
            tier={i + 1}
            positions={positions.filter(p => p.tier === i + 1 && !p.inBuffer)}
            bufferPositions={positions.filter(p => p.tier === i + 1 && p.inBuffer)}
            total={total}
            onAdd={handleAdd}
            onReduce={handleReduce}
            onClear={handleClear}
          />
        ))}
      </div>

      <HistoryPanel show={showHistory} history={history} onToggle={() => setShowHistory(false)} onClear={clearHistory} />

      <Toast message={toast} />

      <AddModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        positions={positions}
        cash={cash}
        onAdd={addPosition}
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
        onConfirm={(prices) => {
          applyMockPrice(prices);
          setShowMockPriceModal(false);
        }}
      />

      <ConfigModal
        show={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        readOnly={true}
      />
    </div>
  );
}

export default PortfolioApp;