import { useState, useEffect } from 'react';
import { initManfolio, listPortfolios, createPortfolio, deletePortfolio, setActivePortfolio } from '../utils/manfolio';
import { useRouter } from '../utils/router';
import CreatePortfolioModal from './CreatePortfolioModal';

function ManfolioHome() {
  const [portfolios, setPortfolios] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { navigate } = useRouter();

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
    if (confirm('确认删除?')) {
      deletePortfolio(id);
      setPortfolios(listPortfolios());
    }
  };

  const handleEnter = (id) => {
    setActivePortfolio(id);
    navigate('/folio/' + id);
  };

  return (
    <div className="manfolio-home">
      <h1>Manfolio</h1>
      <div className="portfolio-list">
        {portfolios.map(p => (
          <div key={p.id} className="portfolio-card" onClick={() => handleEnter(p.id)}>
            <div className="portfolio-card-header">
              <span className="portfolio-name">{p.name}</span>
              <button className="btn-delete" onClick={(e) => handleDelete(e, p.id)}>×</button>
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