import { TIER } from './src/utils/constants.js';
import { getUpperLimit, getTargetTier } from './src/utils/helpers.js';
import { calculateShares, autoRebalance } from './src/utils/portfolio.js';

const t3Config = TIER[2];

function getRealResultPercent(posValue, price, newShares, total, isAdd) {
  const newPosValue = isAdd ? posValue + newShares * price : posValue - newShares * price;
  return (newPosValue / total) * 100;
}

function getResultTier(percent) {
  if (percent >= 25) return 1;
  if (percent >= 15) return 2;
  return 3;
}

const TEST_CASES = [];

function addTestCase(id, params, expected) {
  TEST_CASES.push({ id, params, expected });
}

addTestCase(1, { position: { value: 4500, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(2, { position: { value: 5000, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(3, { position: { value: 3500, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(4, { position: { value: 3200, tier: 1 }, price: 50, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });
addTestCase(5, { position: { value: 4800, tier: 1 }, price: 80, total: 12000, button: '=', isAdd: false }, { shares: '>0', percent: 30, tier: 1 });

addTestCase(6, { position: { value: 2000, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(7, { position: { value: 2500, tier: 1 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(8, { position: { value: 1500, tier: 1 }, price: 50, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(9, { position: { value: 2200, tier: 1 }, price: 75, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(10, { position: { value: 2700, tier: 1 }, price: 120, total: 15000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

addTestCase(11, { position: { value: 3000, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(12, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(13, { position: { value: 2500, tier: 2 }, price: 50, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(14, { position: { value: 3500, tier: 2 }, price: 80, total: 12000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(15, { position: { value: 3200, tier: 2 }, price: 60, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });

addTestCase(16, { position: { value: 1500, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(17, { position: { value: 1200, tier: 2 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(18, { position: { value: 1000, tier: 2 }, price: 50, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(19, { position: { value: 1800, tier: 2 }, price: 75, total: 12000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(20, { position: { value: 1400, tier: 2 }, price: 120, total: 15000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

addTestCase(21, { position: { value: 1500, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(22, { position: { value: 1800, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(23, { position: { value: 1200, tier: 3 }, price: 50, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(24, { position: { value: 1600, tier: 3 }, price: 80, total: 12000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(25, { position: { value: 1300, tier: 3 }, price: 60, total: 10000, button: '=', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });

addTestCase(26, { position: { value: 500, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(27, { position: { value: 800, tier: 3 }, price: 100, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(28, { position: { value: 600, tier: 3 }, price: 50, total: 10000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(29, { position: { value: 900, tier: 3 }, price: 75, total: 12000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(30, { position: { value: 700, tier: 3 }, price: 120, total: 15000, button: '=', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });

addTestCase(31, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(32, { position: { value: 2400, tier: 2 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(33, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(34, { position: { value: 2200, tier: 2 }, price: 75, total: 12000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(35, { position: { value: 2600, tier: 2 }, price: 120, total: 15000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

addTestCase(36, { position: { value: 1000, tier: 3 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(37, { position: { value: 1400, tier: 3 }, price: 100, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(38, { position: { value: 800, tier: 3 }, price: 50, total: 10000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(39, { position: { value: 1200, tier: 3 }, price: 75, total: 12000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(40, { position: { value: 1600, tier: 3 }, price: 120, total: 15000, button: 'UP', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

addTestCase(41, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(42, { position: { value: 4000, tier: 1 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(43, { position: { value: 3500, tier: 1 }, price: 50, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(44, { position: { value: 4500, tier: 1 }, price: 75, total: 12000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });
addTestCase(45, { position: { value: 5000, tier: 1 }, price: 120, total: 15000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 20, tier: 2 });

addTestCase(46, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(47, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(48, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(49, { position: { value: 2400, tier: 2 }, price: 75, total: 12000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });
addTestCase(50, { position: { value: 3000, tier: 2 }, price: 120, total: 15000, button: 'DOWN', isAdd: false }, { shares: '>0', percent: 10, tier: 3 });

addTestCase(51, { position: { value: 2500, tier: 1 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(52, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(53, { position: { value: 2800, tier: 1 }, price: 50, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(54, { position: { value: 3200, tier: 1 }, price: 75, total: 12000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(55, { position: { value: 3500, tier: 1 }, price: 120, total: 15000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

addTestCase(56, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: 25, tier: 1 });
addTestCase(57, { position: { value: 3800, tier: 1 }, price: 100, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: 25, tier: 1 });
addTestCase(58, { position: { value: 3200, tier: 1 }, price: 50, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: 25, tier: 1 });
addTestCase(59, { position: { value: 3000, tier: 1 }, price: 75, total: 10000, button: 'min1', isAdd: false }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(60, { position: { value: 3500, tier: 1 }, price: 120, total: 15000, button: 'min1', isAdd: false }, { shares: 0, percent: 23.3, tier: 2 });

addTestCase(61, { position: { value: 3000, tier: 1 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(62, { position: { value: 4000, tier: 1 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(63, { position: { value: 2800, tier: 1 }, price: 50, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(64, { position: { value: 2800, tier: 1 }, price: 75, total: 12000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(65, { position: { value: 3500, tier: 1 }, price: 120, total: 15000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });

addTestCase(66, { position: { value: 1800, tier: 2 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(67, { position: { value: 2200, tier: 2 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(68, { position: { value: 2000, tier: 2 }, price: 50, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(69, { position: { value: 2400, tier: 2 }, price: 75, total: 12000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(70, { position: { value: 2600, tier: 2 }, price: 120, total: 15000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

addTestCase(71, { position: { value: 1600, tier: 2 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(72, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(73, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(74, { position: { value: 2200, tier: 2 }, price: 75, total: 12000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });
addTestCase(75, { position: { value: 2400, tier: 2 }, price: 120, total: 15000, button: 'max1', isAdd: true }, { shares: '>0', percent: '~', tier: 1 });

addTestCase(76, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(77, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(78, { position: { value: 2200, tier: 2 }, price: 50, total: 10000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });
addTestCase(79, { position: { value: 2600, tier: 2 }, price: 50, total: 12000, button: 'min2', isAdd: false }, { shares: 16, percent: 15, tier: 2 });
addTestCase(80, { position: { value: 3000, tier: 2 }, price: 120, total: 15000, button: 'min2', isAdd: false }, { shares: '>0', percent: 15, tier: 2 });

addTestCase(81, { position: { value: 2000, tier: 2 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(82, { position: { value: 2800, tier: 2 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(83, { position: { value: 1800, tier: 2 }, price: 50, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(84, { position: { value: 2400, tier: 2 }, price: 75, total: 12000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(85, { position: { value: 3200, tier: 2 }, price: 120, total: 15000, button: 'min3', isAdd: false }, { shares: 20, percent: 5.33, tier: 3 });

addTestCase(104, { position: { value: 1400, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 14, tier: 3 });
addTestCase(105, { position: { value: 1500, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 15, tier: 2 });
addTestCase(106, { position: { value: 1800, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 3, percent: 15, tier: 2 });
addTestCase(107, { position: { value: 1510, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 15.1, tier: 2 });
addTestCase(110, { position: { value: 1800, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 3, percent: 15, tier: 2 });
addTestCase(111, { position: { value: 1600, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 1, percent: 15, tier: 2 });
addTestCase(112, { position: { value: 1510, tier: 2 }, price: 100, total: 10000, button: 'min2', isAdd: false }, { shares: 0, percent: 15.1, tier: 2 });

addTestCase(108, { position: { value: 500, tier: 3 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: 0, percent: 5, tier: 3 });
addTestCase(109, { position: { value: 505, tier: 3 }, price: 50, total: 10000, button: 'min3', isAdd: false }, { shares: 0, percent: 5.05, tier: 3 });

addTestCase(86, { position: { value: 800, tier: 3 }, price: 100, total: 10000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(87, { position: { value: 1200, tier: 3 }, price: 100, total: 10000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(88, { position: { value: 1000, tier: 3 }, price: 50, total: 10000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(89, { position: { value: 1300, tier: 3 }, price: 75, total: 12000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });
addTestCase(90, { position: { value: 1500, tier: 3 }, price: 120, total: 15000, button: 'max3', isAdd: true }, { shares: '>0', percent: '~', tier: 3 });

addTestCase(91, { position: { value: 600, tier: 3 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(92, { position: { value: 1000, tier: 3 }, price: 100, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(93, { position: { value: 800, tier: 3 }, price: 50, total: 10000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(94, { position: { value: 1100, tier: 3 }, price: 75, total: 12000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });
addTestCase(95, { position: { value: 1300, tier: 3 }, price: 120, total: 15000, button: 'max2', isAdd: true }, { shares: '>0', percent: '~', tier: 2 });

addTestCase(96, { position: { value: 1000, tier: 3 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(97, { position: { value: 1600, tier: 3 }, price: 100, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(98, { position: { value: 1200, tier: 3 }, price: 50, total: 10000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(99, { position: { value: 1400, tier: 3 }, price: 75, total: 12000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });
addTestCase(100, { position: { value: 1800, tier: 3 }, price: 120, total: 15000, button: 'min3', isAdd: false }, { shares: '>0', percent: 5, tier: 3 });

const REBALANCE_TESTS = [];

function addRebalanceTest(id, positions, total, expected) {
  REBALANCE_TESTS.push({ id: id, positions: positions, total: total, expected: expected });
}

// Slot allocation tests

// S1: 3 positions at ~10% -> T3, limit=3, all in main
addRebalanceTest('S1', [
  { symbol: 'A', value: 10000, tier: 3, inBuffer: false },
  { symbol: 'B', value: 10000, tier: 3, inBuffer: false },
  { symbol: 'C', value: 10000, tier: 3, inBuffer: false }
], 300000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

// S5: 3 positions initial tier=2, all should stay in T2 but limit=2
addRebalanceTest('S5', [
  { symbol: 'A', value: 12100, tier: 2, inBuffer: false },
  { symbol: 'B', value: 9900, tier: 2, inBuffer: false },
  { symbol: 'C', value: 8250, tier: 2, inBuffer: false }
], 55000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false },
  { symbol: 'C', tier: 2, inBuffer: true }
]);

// S2: 3 positions at ~20% -> T2, limit=2, buffer=1 -> 2 main, 1 buffer
addRebalanceTest('S2', [
  { symbol: 'A', value: 20000, tier: 3, inBuffer: false },
  { symbol: 'B', value: 20000, tier: 3, inBuffer: false },
  { symbol: 'C', value: 20000, tier: 3, inBuffer: false }
], 100000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false },
  { symbol: 'C', tier: 2, inBuffer: true }
]);

// S3: position.tier=3 but value%=20% should be T2, not downgrade
addRebalanceTest('S3', [
  { symbol: 'A', value: 20000, tier: 3, inBuffer: false }
], 100000, [
  { symbol: 'A', tier: 2, inBuffer: false }
]);

// S4a: T2满，T1空，T3可进T2缓冲位
addRebalanceTest('S4a', [
  { symbol: 'A', value: 10000, tier: 2, inBuffer: false },
  { symbol: 'B', value: 8000, tier: 2, inBuffer: false },
  { symbol: 'C', value: 7500, tier: 3, inBuffer: false }
], 50000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false },
  { symbol: 'C', tier: 2, inBuffer: true }
]);

// ADD_NVDA: addPosition加仓NVDA后保持原tier，传给autoRebalance的数据
// 加仓前: NVDA tier=3, value=9997.39
// 加仓后: NVDA value=19994.78, tier保持3, inBuffer保持false
// autoRebalance判断NVDA从T3晋级到T2，T2主位满，应进缓冲位
addRebalanceTest('ADD_NVDA', [
  { symbol: 'GOOG', value: 19890.36, tier: 2, inBuffer: false },
  { symbol: 'AAPL', value: 20056.96, tier: 2, inBuffer: false },
  { symbol: 'NVDA', value: 19994.78, tier: 3, inBuffer: false }
], 100000, [
  { symbol: 'GOOG', tier: 2, inBuffer: false },
  { symbol: 'AAPL', tier: 2, inBuffer: false },
  { symbol: 'NVDA', tier: 2, inBuffer: true }
]);

// 加仓测试: 用户原始数据，NVDA加仓后价值19994.78
addRebalanceTest('ADD_NVDA', [
  { symbol: 'GOOG', value: 19890.36, tier: 2, inBuffer: false },
  { symbol: 'AAPL', value: 20056.96, tier: 2, inBuffer: false },
  { symbol: 'NVDA', value: 19994.78, tier: 3, inBuffer: false }
], 100000, [
  { symbol: 'GOOG', tier: 2, inBuffer: false },
  { symbol: 'AAPL', tier: 2, inBuffer: false },
  { symbol: 'NVDA', tier: 2, inBuffer: true }
]);

// S4b: T1不为空，T3禁止进T2缓冲位 (T1+T2>=3时T3->T2只能进主位，否则保持原位)
addRebalanceTest('S4b', [
  { symbol: 'A', value: 35000, tier: 1, inBuffer: false },
  { symbol: 'B', value: 22000, tier: 2, inBuffer: false },
  { symbol: 'C', value: 20000, tier: 2, inBuffer: false },
  { symbol: 'D', value: 15000, tier: 3, inBuffer: false }
], 92000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false },
  { symbol: 'C', tier: 2, inBuffer: false },
  { symbol: 'D', tier: 3, inBuffer: false }
]);

// T1空 + T2满 + T3晋级应该进缓冲位 (而不是挤开T2)
addRebalanceTest('T3_TO_T2_FULL', [
  { symbol: 'A', value: 8000, tier: 2, inBuffer: false },
  { symbol: 'B', value: 7000, tier: 2, inBuffer: false },
  { symbol: 'C', value: 6000, tier: 3, inBuffer: false },
  { symbol: 'D', value: 5000, tier: 3, inBuffer: false },
  { symbol: 'E', value: 4000, tier: 3, inBuffer: false }
], 35000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false },
  { symbol: 'C', tier: 2, inBuffer: true },
  { symbol: 'D', tier: 3, inBuffer: false },
  { symbol: 'E', tier: 3, inBuffer: false }
]);

// REBALANCE.md 用例
// 用例1: 全部降级到T3
addRebalanceTest('R1', [
  { symbol: 'A', value: 2000, tier: 2, inBuffer: false },
  { symbol: 'B', value: 1800, tier: 2, inBuffer: false },
  { symbol: 'C', value: 1600, tier: 2, inBuffer: true }
], 30000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

// 用例2: 正常分布
addRebalanceTest('R2', [
  { symbol: 'A', value: 5000, tier: 1, inBuffer: false },
  { symbol: 'B', value: 3000, tier: 2, inBuffer: false },
  { symbol: 'C', value: 1000, tier: 3, inBuffer: false }
], 20000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

// 用例3: 仅T1
addRebalanceTest('R3', [
  { symbol: 'A', value: 4500, tier: 1, inBuffer: false }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false }
]);

// 用例4: 权重不足降T3
addRebalanceTest('R4', [
  { symbol: 'A', value: 2800, tier: 1, inBuffer: false },
  { symbol: 'B', value: 2600, tier: 2, inBuffer: false },
  { symbol: 'C', value: 2400, tier: 3, inBuffer: false }
], 30000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

// 用例5: T2满员降T3
addRebalanceTest('R5', [
  { symbol: 'A', value: 2800, tier: 2, inBuffer: false },
  { symbol: 'B', value: 2400, tier: 2, inBuffer: false },
  { symbol: 'C', value: 2000, tier: 2, inBuffer: true }
], 20000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

// 用例6: T1+T2 (两股票都要进T1，但T1主位只有1个，无缓冲位，B保留原位)
addRebalanceTest('R6', [
  { symbol: 'A', value: 2800, tier: 1, inBuffer: false },
  { symbol: 'B', value: 2600, tier: 2, inBuffer: false }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false }
]);

// 用例7: 缓冲位补主位
addRebalanceTest('R7', [
  { symbol: 'A', value: 3000, tier: 1, inBuffer: false },
  { symbol: 'B', value: 800, tier: 3, inBuffer: true },
  { symbol: 'C', value: 600, tier: 3, inBuffer: true }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false }
]);

// 用例8: T2→T3降级特殊约束
addRebalanceTest('R8', [
  { symbol: 'A', value: 2800, tier: 2, inBuffer: false },
  { symbol: 'B', value: 2400, tier: 2, inBuffer: false },
  { symbol: 'C', value: 2000, tier: 2, inBuffer: true },
  { symbol: 'D', value: 600, tier: 3, inBuffer: false }
], 25000, [
  { symbol: 'A', tier: 3, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: true },
  { symbol: 'D', tier: 3, inBuffer: false }
]);

// 用例9: T1降T2
addRebalanceTest('R9', [
  { symbol: 'A', value: 3500, tier: 1, inBuffer: false },
  { symbol: 'B', value: 3000, tier: 2, inBuffer: false }
], 15000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false }
]);

// 用例10: T2升T1
addRebalanceTest('R10', [
  { symbol: 'A', value: 2800, tier: 2, inBuffer: false },
  { symbol: 'B', value: 2400, tier: 2, inBuffer: false }
], 10000, [
  { symbol: 'A', tier: 1, inBuffer: false },
  { symbol: 'B', tier: 2, inBuffer: false }
]);

// 用例11: 现金增加一倍 (T2满, T3主位满后进缓冲位)
addRebalanceTest('R11', [
  { symbol: 'A', value: 7000, tier: 1, inBuffer: false },
  { symbol: 'B', value: 4000, tier: 2, inBuffer: false },
  { symbol: 'C', value: 3000, tier: 2, inBuffer: false },
  { symbol: 'D', value: 2000, tier: 3, inBuffer: false },
  { symbol: 'E', value: 1500, tier: 3, inBuffer: false },
  { symbol: 'F', value: 500, tier: 3, inBuffer: false }
], 40000, [
  { symbol: 'A', tier: 2, inBuffer: false },
  { symbol: 'B', tier: 3, inBuffer: true },
  { symbol: 'C', tier: 3, inBuffer: true },
  { symbol: 'D', tier: 3, inBuffer: false },
  { symbol: 'E', tier: 3, inBuffer: false },
  { symbol: 'F', tier: 3, inBuffer: false }
]);

// 用例12: 缓冲位补主位
addRebalanceTest('R12', [
  { symbol: 'B', value: 400, tier: 3, inBuffer: false },
  { symbol: 'C', value: 300, tier: 3, inBuffer: false },
  { symbol: 'D', value: 200, tier: 3, inBuffer: true }
], 5000, [
  { symbol: 'B', tier: 3, inBuffer: false },
  { symbol: 'C', tier: 3, inBuffer: false },
  { symbol: 'D', tier: 3, inBuffer: false }
]);

function runTests() {
  let passed = 0;
  let failed = 0;
  let errors = [];

  console.log('Running ' + TEST_CASES.length + ' tests...\n');

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const params = tc.params;
    
    const shares = calculateShares({
      position: params.position,
      price: params.price,
      total: params.total,
      tier: params.position.tier,
      button: params.button,
      isAdd: params.isAdd
    });
    const newPercent = getRealResultPercent(params.position.value, params.price, shares, params.total, params.isAdd);
    const newTier = getResultTier(newPercent);
    
    const expectedShares = tc.expected.shares;
    const expectedPercent = tc.expected.percent;
    const expectedTier = tc.expected.tier;
    
    const tierMatch = newTier === expectedTier;
    let percentOk;
    if (expectedPercent === '~') {
      percentOk = newPercent >= 5 && newPercent <= 45;
    } else if (expectedPercent === '<') {
      percentOk = newPercent < 40;
    } else {
      percentOk = Math.abs(newPercent - expectedPercent) < 1;
    }
    const sharesOk = expectedShares === '>0' ? shares >= 0 : (expectedShares === '=0' ? shares === 0 : true);
    
    if (tierMatch && percentOk && sharesOk) {
      passed++;
    } else {
      failed++;
      if (errors.length < 30) {
        errors.push({ 
          id: tc.id, 
          shares: shares, 
          newPercent: newPercent.toFixed(1), 
          newTier: newTier, 
          expectedTier: expectedTier,
          expectedPercent: expectedPercent,
          button: params.button,
          posValue: params.position.value,
          price: params.price.toFixed(1),
          total: params.total
        });
      }
    }
  }

  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    errors.forEach(function(e) {
      console.log('  #' + e.id + ': button=' + e.button + ', posValue=' + e.posValue + ', price=' + e.price + ', total=' + e.total + ' => shares=' + e.shares + ', percent=' + e.newPercent + '%, tier=' + e.newTier + ' (expected tier=' + e.expectedTier + ', percent=' + e.expectedPercent + '%)');
    });
  }

  console.log('\nRunning ' + REBALANCE_TESTS.length + ' rebalance tests...\n');
  
  let rebalancePassed = 0;
  let rebalanceFailed = 0;
  let rebalanceErrors = [];
  
  for (let i = 0; i < REBALANCE_TESTS.length; i++) {
    const rtc = REBALANCE_TESTS[i];
    
    const resultPositions = autoRebalance(rtc.positions, rtc.total);
    
    let allMatch = true;
    for (let j = 0; j < rtc.expected.length; j++) {
      const exp = rtc.expected[j];
      const actual = resultPositions.find(function(p) { return p.symbol === exp.symbol; });
      if (!actual || actual.tier !== exp.tier || actual.inBuffer !== exp.inBuffer) {
        allMatch = false;
        break;
      }
    }
    
    if (allMatch) {
      rebalancePassed++;
    } else {
      rebalanceFailed++;
      if (rebalanceErrors.length < 20) {
        const actualResult = resultPositions.map(function(p) { 
          return p.symbol + ':t' + p.tier + (p.inBuffer ? '-buf' : ''); 
        });
        const expectedResult = rtc.expected.map(function(p) { 
          return p.symbol + ':t' + p.tier + (p.inBuffer ? '-buf' : ''); 
        });
        rebalanceErrors.push({
          id: rtc.id,
          actual: actualResult.join(', '),
          expected: expectedResult.join(', ')
        });
      }
    }
  }
  
  console.log('Rebalance results: ' + rebalancePassed + ' passed, ' + rebalanceFailed + ' failed');
  
  if (rebalanceFailed > 0) {
    console.log('\nFailed rebalance tests:');
    rebalanceErrors.forEach(function(e) {
      console.log('  #' + e.id + ': ' + e.actual + ' (expected: ' + e.expected + ')');
    });
  }
  
  return { passed: passed + rebalancePassed, failed: failed + rebalanceFailed, errors: errors };
}

const result = runTests();
process.exit(result.failed > 0 ? 1 : 0);