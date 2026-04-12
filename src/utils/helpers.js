import { getConfig } from './constants.js';

/**
 * 根据占比判定目标梯队
 * @param {number} percent - 占比
 * @returns {number} tier (1/2/3)
 */
export function getTargetTier(percent) {
  const TIER = getConfig();
  for (let i = 0; i < TIER.length; i++) {
    if (percent >= TIER[i].min) {
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
  return TIER[tier - 1]?.target || 0;
}