/**
 * Manfolio 数据管理
 */

const KEY = 'manfolio';

const defaultTIER = [
  { name: '第一梯队', target: 30, limit: 1, buffer: 0, min: 25, max: 35 },
  { name: '第二梯队', target: 20, limit: 2, buffer: 1, min: 15, max: 25 },
  { name: '第三梯队', target: 10, limit: 3, buffer: 3, min: 5, max: 15 }
];

function createDefaultPortfolio(name = 'Default') {
  return {
    name,
    config: defaultTIER,
    positions: [],
    cash: 100000,
    history: [],
    priceTime: null
  };
}

/**
 * 初始化 Manfolio 数据
 */
export function initManfolio() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}
  
  const data = {
    activePortfolio: 'default',
    portfolios: {
      'default': createDefaultPortfolio('Default')
    }
  };
  saveManfolio(data);
  return data;
}

/**
 * 保存 Manfolio 数据
 */
export function saveManfolio(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

/**
 * 获取所有 portfolio 列表
 */
export function listPortfolios() {
  const data = initManfolio();
  return Object.entries(data.portfolios).map(([id, p]) => ({
    id,
    name: p.name,
    value: p.positions.reduce((sum, pos) => sum + pos.value, 0),
    cash: p.cash,
    total: p.positions.reduce((sum, pos) => sum + pos.value, 0) + p.cash
  }));
}

/**
 * 获取当前激活的 portfolio ID
 */
export function getActivePortfolioId() {
  const data = initManfolio();
  return data.activePortfolio;
}

/**
 * 获取指定 portfolio 数据
 */
export function getPortfolio(id) {
  const data = initManfolio();
  if (!id || !data.portfolios[id]) {
    id = data.activePortfolio;
  }
  return data.portfolios[id] || null;
}

/**
 * 获取当前激活的 portfolio
 */
export function getActivePortfolio() {
  const data = initManfolio();
  return data.portfolios[data.activePortfolio];
}

/**
 * 设置当前激活的 portfolio
 */
export function setActivePortfolio(id) {
  const data = initManfolio();
  if (data.portfolios[id]) {
    data.activePortfolio = id;
    saveManfolio(data);
  }
}

/**
 * 创建新 portfolio
 */
export function createPortfolio(name, config) {
  const data = initManfolio();
  
  // 统计现有portfolio名称中"新Portfolio"开头的数量，自动生成序号
  const existingNames = Object.values(data.portfolios).map(p => p.name);
  let num = 1;
  while (existingNames.includes(`新Portfolio${num}`)) {
    num++;
  }
  const finalName = name && name.trim() ? name.trim() : `新Portfolio${num}`;
  
  const ids = Object.keys(data.portfolios).filter(id => id.startsWith('p'));
  const maxNum = ids.length > 0 ? Math.max(...ids.map(id => parseInt(id.slice(1)) || 0)) : 0;
  const id = 'p' + (maxNum + 1);
  data.portfolios[id] = {
    name: finalName,
    config: config || defaultTIER,
    positions: [],
    cash: 100000,
    history: [],
    priceTime: null
  };
  data.activePortfolio = id;
  saveManfolio(data);
  return id;
}

/**
 * 删除 portfolio
 */
export function deletePortfolio(id) {
  const data = initManfolio();
  const keys = Object.keys(data.portfolios);
  if (keys.length <= 1) return false; // 至少保留一个
  
  delete data.portfolios[id];
  
  // 如果删除的是当前激活的，选择第一个
  if (data.activePortfolio === id) {
    data.activePortfolio = Object.keys(data.portfolios)[0];
  }
  
  saveManfolio(data);
  return true;
}

/**
 * 保存 portfolio 数据（持仓、现金等）
 */
function saveCurrentPortfolio(portfolioData) {
  const data = initManfolio();
  data.portfolios[data.activePortfolio] = portfolioData;
  saveManfolio(data);
}

/**
 * 更新持仓
 */
export function updatePositions(positions) {
  const p = getActivePortfolio();
  if (p) {
    p.positions = positions;
    saveCurrentPortfolio(p);
  }
}

/**
 * 更新现金
 */
export function updateCash(cash) {
  const p = getActivePortfolio();
  if (p) {
    p.cash = cash;
    saveCurrentPortfolio(p);
  }
}

/**
 * 更新历史记录
 */
export function updateHistory(history) {
  const p = getActivePortfolio();
  if (p) {
    p.history = history;
    saveCurrentPortfolio(p);
  }
}

/**
 * 更新时间
 */
export function updatePriceTime(priceTime) {
  const p = getActivePortfolio();
  if (p) {
    p.priceTime = priceTime;
    saveCurrentPortfolio(p);
  }
}

/**
 * 更新配置
 */
export function updateConfig(config) {
  const data = initManfolio();
  data.portfolios[data.activePortfolio].config = config;
  saveManfolio(data);
}

/**
 * 导出全部数据
 */
export function exportAllData() {
  const data = initManfolio();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manfolio-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导入全部数据
 */
export function importAllData(data) {
  if (data && data.portfolios) {
    saveManfolio(data);
  }
}