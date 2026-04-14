import { useState, useEffect } from 'react';
import { getActivePortfolio, updateConfig } from '../utils/manfolio';

export default function ConfigModal({ show, onClose }) {
  const [config, setConfig] = useState([]);

  useEffect(() => {
    if (show) {
      const p = getActivePortfolio();
      setConfig(JSON.parse(JSON.stringify(p?.config || [])));
    }
  }, [show]);

  const getBuffer = (config, index) => {
    if (index === 0) return 0;
    return config.slice(0, index).reduce((sum, t) => sum + t.limit, 0);
  };

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
    const newMin = lastTier ? Math.max(5, lastTier.min - 10) : 5;
    const newMax = lastTier ? lastTier.min : 15;
    setConfig([...config, {
      name: `第${nextNum}梯队`,
      target: Math.round(newMax / 2),
      limit: 1,
      min: newMin,
      max: newMax
    }]);
  };

  const handleRemove = (index) => {
    if (config.length <= 1) return;
    setConfig(config.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    updateConfig(config);
    onClose();
    window.location.reload();
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

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '700px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px'
      }}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px' }}>
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>梯队配置</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ padding: '24px' }}>
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
                  <td><input type="text" style={inputStyle} value={tier.name} onChange={(e) => handleChange(i, 'name', e.target.value)} /></td>
                  <td style={{ padding: '8px' }}><input type="number" style={{ ...inputStyle, textAlign: 'center', width: '60px' }} value={tier.target} onChange={(e) => handleChange(i, 'target', parseFloat(e.target.value) || 0)} /></td>
                  <td style={{ padding: '8px' }}><input type="number" style={{ ...inputStyle, textAlign: 'center', width: '50px' }} value={tier.limit} onChange={(e) => handleChange(i, 'limit', parseInt(e.target.value) || 0)} /></td>
                  <td style={{ padding: '8px' }}><input type="number" style={{ ...inputStyle, textAlign: 'center', width: '60px' }} value={tier.min} onChange={(e) => handleChange(i, 'min', parseFloat(e.target.value) || 0)} /></td>
                  <td style={{ padding: '8px' }}><input type="number" style={{ ...inputStyle, textAlign: 'center', width: '60px' }} value={tier.max || ''} onChange={(e) => handleChange(i, 'max', parseFloat(e.target.value) || 0)} /></td>
                  <td style={{ padding: '8px' }}>
                    {config.length > 1 && <button onClick={() => handleRemove(i)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '20px' }}>×</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleAdd} style={{ marginTop: '16px', padding: '10px 20px', background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>+ 添加梯队</button>
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', cursor: 'pointer', fontWeight: '500' }}>保存</button>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>取消</button>
        </div>
      </div>
    </div>
  );
}
