import { useState, useEffect, useRef } from 'react';
import { initManfolio, listPortfolios, createPortfolio, deletePortfolio, setActivePortfolio, exportAllData, importAllData } from '../utils/manfolio';
import { useRouter } from '../utils/router';
import CreatePortfolioModal from './CreatePortfolioModal';

function ManfolioHome() {
  const [portfolios, setPortfolios] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { navigate } = useRouter();
  const fileInputRef = useRef(null);

  const handleExportAll = () => {
    exportAllData();
  };

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
          importAllData(data);
          setPortfolios(listPortfolios());
        } catch (err) {
          alert('文件格式错误');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  useEffect(() => {
    initManfolio();
    setPortfolios(listPortfolios());
  }, []);

  const handleCreate = (name, config) => {
    const id = createPortfolio(name, config);
    setPortfolios(listPortfolios());
    navigate('/folio/' + id);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirmDelete === id) {
      deletePortfolio(id);
      setPortfolios(listPortfolios());
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleEnter = (id) => {
    setActivePortfolio(id);
    navigate('/folio/' + id);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Manfolio</h1>
        <div className="header-buttons">
          <button className="btn btn-secondary" onClick={handleExportAll}>导出全部</button>
          <button className="btn btn-secondary" onClick={handleImportClick}>导入全部</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden-input"
            onChange={handleFileChange}
          />
        </div>
      </div>
      <div className="portfolio-list">
        {portfolios.map(p => (
          <div key={p.id} className="portfolio-card" onClick={() => handleEnter(p.id)}>
            <button className="btn-delete" onClick={(e) => handleDelete(e, p.id)}>×</button>
            <div className="portfolio-card-header">
              <span className="portfolio-name">{p.name}</span>
            </div>
            <div className="portfolio-stats">
              <div className="stat-item">
                <span className="stat-label">市值</span>
                <span className="stat-value">${(p.value || 0).toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">现金</span>
                <span className="stat-value">${(p.cash || 0).toLocaleString()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">总计</span>
                <span className="stat-value">${(p.total || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="portfolio-card create-new" onClick={() => setShowCreateModal(true)}>
          + 创建新 portfolio
        </div>
      </div>

      <CreatePortfolioModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

export default ManfolioHome;