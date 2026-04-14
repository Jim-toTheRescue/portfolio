/**
 * 梯队配置常量
 */

import { getActivePortfolio } from './manfolio';

const CONFIG_KEY = 'portfolio-config';
const CONFIG_LOCK_KEY = 'portfolio-config-locked';

const defaultTIER = [
  { name: '第一梯队', target: 30, limit: 1, buffer: 0, min: 25, max: 35 },
  { name: '第二梯队', target: 20, limit: 2, buffer: 1, min: 15, max: 25 },
  { name: '第三梯队', target: 10, limit: 3, buffer: 3, min: 5, max: 15 }
];

export function getTIER() {
  try {
    const p = getActivePortfolio();
    if (p && p.config) {
      // 新结构：config.tiers 或旧结构：config数组
      return p.config.tiers || p.config;
    }
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      return config.tiers || config.tier || defaultTIER;
    }
  } catch (e) {}
  return defaultTIER;
}

export function getConfig() {
  return getTIER();
}

export function getTopTierAllowBuy() {
  try {
    const p = getActivePortfolio();
    if (p && p.topTierAllowBuy) {
      return p.topTierAllowBuy;
    }
    const config = getTIER();
    return config.length;
  } catch (e) {}
  return 3;
}

export function getTierConfig(tier) {
  const tiers = getTIER();
  if (tier < 1 || tier > tiers.length) return null;
  return tiers[tier - 1];
}

export function saveConfig(tier) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ tier }));
  localStorage.setItem(CONFIG_LOCK_KEY, 'true');
}

export function isConfigLocked() {
  return localStorage.getItem(CONFIG_LOCK_KEY) === 'true';
}

export function resetConfig() {
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(CONFIG_LOCK_KEY);
}

export const TIER = getTIER();

/**
 * LocalStorage keys
 */
export const STORAGE_KEY = 'portfolio';
export const HISTORY_KEY = 'portfolio-history';

/**
 * @typedef {Object} Position
 * @property {string} symbol - 股票代码
 * @property {string} name - 股票名称
 * @property {number} shares - 股数
 * @property {number} price - 当前价格
 * @property {number} value - 市值
 * @property {number} avgCost - 平均成本
 * @property {number} tier - 梯队 (1/2/3)
 * @property {boolean} inBuffer - 是否在缓冲位
 * @property {number} priceChange - 涨跌幅 (%)
 */

/**
 * @typedef {Object} Portfolio
 * @property {Position[]} positions - 持仓列表
 * @property {number} cash - 现金
 * @property {string} priceTime - 价格刷新时间
 */

/**
 * @typedef {Object} History
 * @property {string} type - 类型 (buy/adj/sell/clear)
 * @property {string} symbol - 股票代码
 * @property {string} name - 股票名称
 * @property {string} action - 操作 (建仓/加仓/减仓/清仓)
 * @property {number} adjShares - 操作股数
 * @property {number} totalShares - 操作后总股数
 * @property {number} price - 成交价格
 * @property {number} fromTier - 原梯队
 * @property {number} toTier - 新梯队
 * @property {string} time - 操作时间
 */