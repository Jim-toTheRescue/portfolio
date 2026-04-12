import { useState, useEffect } from 'react';

function CreatePortfolioModal({ show, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [config, setConfig] = useState([]);

  const getBuffer = (config, index) => {
    if (index === 0) return 0;
    return config.slice(0, index).reduce((sum, t) => sum + t.limit, 0);
  };

  useEffect(() => {
    if (show) {
      setName('');
      const initialConfig = [
        { name: '第一梯队', target: 30, limit: 1, min: 0, max: 0 },
        { name: '第二梯队', target: 20, limit: 2, min: 0, max: 0 },
        { name: '第三梯队', target: 10, limit: 3, min: 0, max: 0 }
      ];
      initialConfig.forEach((t, i) => {
        t.min = t.target - 5;
        t.max = t.target + 5;
        t.buffer = getBuffer(initialConfig, i);
      });
      setConfig(initialConfig);
    }
  }, [show]);

  const handleChange = (index, field, value) => {
    const newConfig = [...config];
    newConfig[index] = { ...newConfig[index], [field]: value };
    if (field === 'limit') {
      newConfig.forEach((t, i) => t.buffer = getBuffer(newConfig, i));
    }
    if (field === 'target') {
      newConfig[index].min = value - 5;
      newConfig[index].max = value + 5;
    }
    setConfig(newConfig);
  };

  const handleAdd = () => {
    const nextNum = config.length + 1;
    const lastTier = config[config.length - 1];
    const newTarget = lastTier ? Math.round(lastTier.target / 2) : 10;
    const newConfig = [...config, { 
      name: `第${nextNum}梯队`, 
      target: newTarget, 
      limit: 1, 
      min: newTarget - 5, 
      max: newTarget + 5 
    }];
    newConfig.forEach((t, i) => t.buffer = getBuffer(newConfig, i));
    setConfig(newConfig);
  };

  const handleRemove = (index) => {
    if (config.length <= 1) return;
    const newConfig = config.filter((_, i) => i !== index);
    newConfig.forEach((t, i) => t.buffer = getBuffer(newConfig, i));
    setConfig(newConfig);
  };

  const handleCreate = () => {
    onCreate(name.trim(), config);
    onClose();
  };

  if (!show) return null;

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  };

  const btnStyle = {
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  return (
    <div className="modal-overlay show" onClick={onClose} style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
        maxWidth: '800px', 
        width: '95%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <div className="modal-header" style={{ 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '20px 24px'
        }}>
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>创建 Portfolio</span>
          <button className="modal-close" onClick={onClose} style={{ color: '#888', fontSize: '24px' }}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '24px' }}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>名称</label>
            <input 
              type="text" 
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入名称"
            />
          </div>
          
          <table className="config-table">
            <thead>
              <tr>
                <th>梯队名称</th>
                <th>目标%</th>
                <th>主位</th>
                <th>最小%</th>
                <th>最大%</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {config.map((tier, i) => (
                <tr key={i}>
                  <td>
                    <input 
                      type="text"
                      style={inputStyle}
                      value={tier.name}
                      onChange={e => handleChange(i, 'name', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input 
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '60px' }}
                      value={tier.target}
                      onChange={e => handleChange(i, 'target', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input 
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '50px' }}
                      value={tier.limit}
                      onChange={e => handleChange(i, 'limit', parseInt(e.target.value) || 0)}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input 
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '60px' }}
                      value={tier.min}
                      onChange={e => handleChange(i, 'min', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input 
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '60px' }}
                      value={tier.max || ''}
                      onChange={e => handleChange(i, 'max', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td>
                    {config.length > 1 && (
                      <button 
                        onClick={() => handleRemove(i)}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '20px', padding: '4px' }}
                      >×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <button 
            onClick={handleAdd}
            style={{ 
              marginTop: '16px', 
              padding: '10px 20px', 
              background: 'rgba(255,255,255,0.1)', 
              border: '1px dashed rgba(255,255,255,0.3)', 
              borderRadius: '8px', 
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + 添加梯队
          </button>
        </div>
        <div className="modal-footer" style={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '16px 24px',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button 
            onClick={handleCreate} 
            style={{ ...btnStyle, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}
          >
            创建
          </button>
          <button 
            onClick={onClose} 
            style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreatePortfolioModal;