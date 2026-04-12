import { useState, useEffect } from 'react';
import { getConfig, saveConfig, isConfigLocked, resetConfig } from '../utils/constants';

function ConfigModal({ show, onClose, readOnly = false }) {
  const [config, setConfig] = useState(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (show) {
      setConfig(getConfig());
      setLocked(readOnly || isConfigLocked());
    }
  }, [show, readOnly]);

  const handleChange = (index, field, value) => {
    if (readOnly) return;
    const newConfig = [...config];
    newConfig[index] = { ...newConfig[index], [field]: value };
    setConfig(newConfig);
  };

  const handleAdd = () => {
    if (readOnly) return;
    if (!config) return;
    const nextNum = config.length + 1;
    const lastTier = config[config.length - 1];
    const newMin = lastTier ? Math.max(5, lastTier.min - 10) : 5;
    const newMax = lastTier ? lastTier.min : 15;
    setConfig([...config, { 
      name: `第${nextNum}梯队`, 
      target: Math.round(newMax / 2), 
      limit: 1, 
      buffer: 1, 
      min: newMin, 
      max: newMax 
    }]);
  };

  const handleRemove = (index) => {
    if (config.length <= 1) return;
    setConfig(config.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    saveConfig(config);
    window.location.reload();
  };

  const handleReset = () => {
    if (confirm('确定重置配置？')) {
      resetConfig();
      window.location.reload();
    }
  };

  if (!show || !config) return null;

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
        maxWidth: '700px', 
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <div className="modal-header" style={{ 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '20px 24px'
        }}>
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>
            梯队配置 
            {locked && <span style={{ fontSize: '13px', color: '#f39c12', marginLeft: '12px' }}>（已锁定）</span>}
          </span>
          <button className="modal-close" onClick={onClose} style={{ color: '#888', fontSize: '24px' }}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '24px' }}>
          <table className="config-table">
            <thead>
              <tr>
                <th>梯队名称</th>
                <th>目标%</th>
                <th>主位</th>
                <th>缓冲</th>
                <th>最小%</th>
                <th>最大%</th>
                {!locked && <th></th>}
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
                      onChange={(e) => handleChange(i, 'name', e.target.value)}
                      disabled={locked}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '60px' }}
                      value={tier.target}
                      onChange={(e) => handleChange(i, 'target', parseFloat(e.target.value) || 0)}
                      disabled={locked}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '50px' }}
                      value={tier.limit}
                      onChange={(e) => handleChange(i, 'limit', parseInt(e.target.value) || 0)}
                      disabled={locked}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '50px' }}
                      value={tier.buffer}
                      onChange={(e) => handleChange(i, 'buffer', parseInt(e.target.value) || 0)}
                      disabled={locked}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '60px' }}
                      value={tier.min}
                      onChange={(e) => handleChange(i, 'min', parseFloat(e.target.value) || 0)}
                      disabled={locked}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="number"
                      style={{ ...inputStyle, textAlign: 'center', width: '60px' }}
                      value={tier.max || ''}
                      onChange={(e) => handleChange(i, 'max', parseFloat(e.target.value) || 0)}
                      disabled={locked}
                    />
                  </td>
                  {!locked && (
                    <td style={{ padding: '8px' }}>
                      {config.length > 1 && (
                        <button
                          onClick={() => handleRemove(i)}
                          style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '20px', padding: '4px' }}
                        >×</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          
          {!locked && (
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
          )}
          
          {locked && (
            <div style={{ 
              marginTop: '20px', 
              padding: '16px', 
              background: 'rgba(243, 156, 18, 0.15)', 
              borderRadius: '8px', 
              fontSize: '13px', 
              color: '#f39c12',
              border: '1px solid rgba(243, 156, 18, 0.3)'
            }}>
              ⚠️ 配置已锁定，不支持修改。
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '16px 24px',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          {!locked && (
            <>
              <button 
                onClick={handleSave} 
                style={{ ...btnStyle, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}
              >
                保存并刷新
              </button>
              <button 
                onClick={handleReset} 
                style={{ ...btnStyle, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
              >
                重置默认
              </button>
            </>
          )}
          <button 
            onClick={onClose} 
            style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfigModal;