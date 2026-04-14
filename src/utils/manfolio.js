/**
 * Manfolio 数据管理
 */

import { parseMarket, convertCurrency } from './helpers.js';

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
    topTierAllowBuy: null,
    positions: [],
    cash: 0,
    cashCurrency: 'CNY',
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
    },
    exchangeRates: null
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
  const rates = data.exchangeRates || { USD: 1, CNY: 7.1, HKD: 7.75 };
  
  return Object.entries(data.portfolios).map(([id, p]) => {
    const cashCurrency = p.cashCurrency || 'CNY';
    const stockValue = p.positions.reduce((sum, pos) => {
      const { currency } = parseMarket(pos.symbol);
      return sum + convertCurrency(pos.value, currency, cashCurrency, rates);
    }, 0);
    const total = stockValue + p.cash;
    return {
      id,
      name: p.name,
      value: stockValue,
      cash: p.cash,
      total,
      cashCurrency,
      positions: p.positions
    };
  });
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
export function createPortfolio(name, config, settleCurrency = 'CNY', topTierAllowBuy = null) {
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
    topTierAllowBuy: topTierAllowBuy || config?.length || 3,
    positions: [],
    closedPositions: [],
    cash: 0,
    cashCurrency: settleCurrency,
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
 * 添加已清仓股票记录
 */
export function addClosedPosition(symbol, name, shares, avgCost, price, currency) {
  const p = getActivePortfolio();
  if (!p) return;
  
  if (!p.closedPositions) {
    p.closedPositions = [];
  }
  const pnl = (price - avgCost) * shares;
  p.closedPositions.push({
    symbol,
    name,
    shares,
    avgCost,
    price,
    pnl,
    currency,
    clearedAt: new Date().toISOString()
  });
  saveCurrentPortfolio(p);
}

/**
 * 获取已实现盈亏
 */
export function getClosedPositions() {
  const p = getActivePortfolio();
  return p?.closedPositions || [];
}

/**
 * 更新现金
 */
export function updateCash(cash, cashCurrency) {
  const p = getActivePortfolio();
  if (p) {
    p.cash = cash;
    // 只有传入 cashCurrency 参数时才更新，不传则保持原值
    if (cashCurrency !== undefined) {
      p.cashCurrency = cashCurrency;
    }
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

export function updatePortfolioName(name) {
  const data = initManfolio();
  data.portfolios[data.activePortfolio].name = name;
  saveManfolio(data);
}

/**
 * 更新汇率
 */
export function updateExchangeRates(exchangeRates) {
  const data = initManfolio();
  data.exchangeRates = exchangeRates;
  saveManfolio(data);
}

/**
 * 获取汇率
 */
export function getExchangeRates() {
  const data = initManfolio();
  return data.exchangeRates || null;
}

import { getAllNotes } from './notes.js';

/**
 * 导出全部数据
 */
export async function exportAllData() {
  const data = initManfolio();
  const notes = await getAllNotes();
  const exportData = {
    ...data,
    notes: notes
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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
export async function importAllData(data) {
  if (data && data.portfolios) {
    saveManfolio(data);
  }
  if (data && data.notes && Array.isArray(data.notes)) {
    const { importNotes } = await import('./notes.js');
    await importNotes(data.notes);
  }
}