import { getConfig } from './constants.js';

/**
 * 根据占比判定目标梯队
 * @param {number} percent - 占比
 * @returns {number} tier (1/2/3)
 */
export function getTargetTier(percent) {
  const roundedPercent = Math.round(percent * 100) / 100;
  const TIER = getConfig();
  for (let i = 0; i < TIER.length; i++) {
    if (roundedPercent >= TIER[i].min) {
      return i + 1;
    }
  }
  return TIER.length;
}

/**
 * 获取梯队上限
 * @param {number} tier - 梯队
 * @returns {number}
 */
export function getUpperLimit(tier) {
  const TIER = getConfig();
  if (tier < 1 || tier > TIER.length) return 25;
  const t = TIER[tier - 1];
  return t.max ? t.max : t.min + 10;
}

/**
 * 计算偏离度
 * @param {Object} p - 持仓
 * @param {number} total - 总资产
 * @returns {number}
 */
export function getDrift(p, total) {
  if (total <= 0) return 0;
  const TIER = getConfig();
  const percent = (p.value / total) * 100;
  const target = TIER[p.tier - 1].target;
  return percent - target;
}

/**
 * 获取偏离度样式类
 * @param {number} d - 偏离度
 * @returns {string}
 */
export function getDriftClass(d) {
  if (Math.abs(d) <= 2) return 'drift-normal';
  if (Math.abs(d) <= 5) return 'drift-warning';
  return 'drift-critical';
}

/**
 * 根据占比判定结果梯队
 * @param {number} percent
 * @returns {number}
 */
export function getResultTier(percent) {
  if (percent >= 25) return 1;
  if (percent >= 15) return 2;
  return 3;
}

/**
 * 计算交易后实际占比
 * @param {number} posValue - 原持仓市值
 * @param {number} price - 价格
 * @param {number} newShares - 新交易股数
 * @param {number} total - 总资产
 * @param {boolean} isAdd - 是否加仓
 * @returns {number}
 */
export function getRealResultPercent(posValue, price, newShares, total, isAdd) {
  const newPosValue = isAdd ? posValue + newShares * price : posValue - newShares * price;
  return (newPosValue / total) * 100;
}

/**
 * 计算股票总市值
 * @param {Position[]} positions
 * @returns {number}
 */
export function totalValue(positions) {
  return positions.reduce((sum, p) => sum + p.value, 0);
}

/**
 * 计算总资产
 * @param {Position[]} positions
 * @param {number} cash
 * @returns {number}
 */
export function totalWithCash(positions, cash) {
  return totalValue(positions) + cash;
}

/**
 * 金额四舍五入
 * @param {number} amount
 * @returns {number}
 */
export function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

/**
 * 判断是否进入梯队
 * @param {number} percent
 * @param {number} tier
 * @returns {boolean}
 */
export function entersTier(percent, tier) {
  const TIER = getConfig();
  if (tier < 1 || tier > TIER.length) return false;
  const t = TIER[tier - 1];
  if (tier === 1) return percent >= t.min;
  return percent >= t.min && percent < t.max;
}

/**
 * 获取梯队名称
 * @param {number} tier
 * @returns {string}
 */
export function tierName(tier) {
  const TIER = getConfig();
  if (!tier || tier < 1 || tier > TIER.length) return '-';
  return TIER[tier - 1].name;
}

/**
 * 获取梯队目标
 * @param {number} tier
 * @returns {number}
 */
export function getTierTarget(tier) {
  const TIER = getConfig();
  return TIER[tier - 1]?.target || 0;
}

/**
 * 解析股票代码的市场和货币
 * @param {string} symbol - 股票代码，如 AAPL.US, 00700.HK, 600519.SH, 300750.SZ
 * @returns {Object} { market, currency }
 */
export function parseMarket(symbol) {
  if (!symbol) return { market: 'UNKNOWN', currency: 'CNY' };
  const suffix = symbol.split('.').pop().toUpperCase();
  const marketMap = {
    'US': { market: 'US', currency: 'USD' },
    'HK': { market: 'HK', currency: 'HKD' },
    'SH': { market: 'SH', currency: 'CNY' },
    'SZ': { market: 'SZ', currency: 'CNY' }
  };
  return marketMap[suffix] || { market: 'UNKNOWN', currency: 'CNY' };
}

/**
 * 根据代码自动识别市场
 * @param {string} code - 股票代码，如 AAPL, 00700, 600519, 300750
 * @returns {string} 市场后缀，如 US, HK, SH, SZ
 */
export function detectMarket(code) {
  if (!code) return 'UNKNOWN';
  const c = code.trim().toUpperCase();
  if (/^[A-Z]+$/.test(c)) return 'US';
  if (/^\d{5}$/.test(c)) return 'HK';
  if (/^6\d{5}$/.test(c)) return 'SH';
  if (/^[03]\d{5}$/.test(c)) return 'SZ';
  return 'UNKNOWN';
}

/**
 * 将股票代码转换为API调用格式
 * @param {string} code - 股票代码，如 AAPL, 00700, 600519
 * @param {string} market - 市场，如 US, HK, SH, SZ
 * @returns {string} API调用格式，如 usAAPL, hk00700, sh600519
 */
export function toApiSymbol(code, market) {
  const marketPrefix = {
    'US': 'us',
    'HK': 'hk',
    'SH': 'sh',
    'SZ': 'sz'
  };
  return (marketPrefix[market] || '') + code;
}

/**
 * 转换货币
 * @param {number} value - 原始金额
 * @param {string} fromCurrency - 原始货币 USD/HKD/CNY
 * @param {string} toCurrency - 目标货币 USD/HKD/CNY
 * @param {Object} rates - 汇率对象 { USD: 1, CNY: 7.10, HKD: 7.75 }
 * @returns {number} 转换后的金额
 */
export function convertCurrency(value, fromCurrency, toCurrency, rates) {
  if (!rates || fromCurrency === toCurrency) return value;
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  // 汇率以 USD 为基准：USD=1, CNY=7.10, HKD=7.75
  // 转换公式：value × (toRate / fromRate)
  // 例如：HKD 10,000 → USD = 10,000 × (1 / 7.75) = 1,290
  return value * (toRate / fromRate);
}

/**
 * 格式化货币显示
 * @param {number} value - 金额
 * @param {string} currency - 货币 USD/HKD/CNY
 * @returns {string} 格式化后的字符串
 */
export function formatCurrency(value, currency) {
  const symbols = { USD: '$', HKD: 'hk$', CNY: '¥' };
  const symbol = symbols[currency] || '';
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 获取货币符号
 * @param {string} currency - 货币 USD/HKD/CNY
 * @returns {string} 货币符号
 */
export function getCurrencySymbol(currency) {
  const symbols = { USD: '$', HKD: 'hk$', CNY: '¥' };
  return symbols[currency] || '$';
}