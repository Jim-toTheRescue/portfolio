// 直接复制 convertCurrency 函数进行测试
function convertCurrency(value, fromCurrency, toCurrency, rates) {
  if (fromCurrency === toCurrency) return value;
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  return value * (toRate / fromRate);
}

console.log('=== 现金转换测试 ===');
console.log('');

// 汇率：USD=1, CNY=7.10, HKD=7.75
const rates = { USD: 1, CNY: 7.10, HKD: 7.75 };

// 测试1: 现金100000，结算货币USD，显示货币USD
let cash = 100000;
let cashCurrency = 'USD';
let displayCurrency = 'USD';
let result = convertCurrency(cash, cashCurrency, displayCurrency, rates);
console.log(`现金=${cash} ${cashCurrency} → 显示=${displayCurrency}: ${result} (预期: 100000)`);
console.log(`结果: ${result === 100000 ? '✅' : '❌'}`);
console.log('');

// 测试2: 现金100000，结算货币USD，显示货币CNY
cash = 100000;
cashCurrency = 'USD';
displayCurrency = 'CNY';
result = convertCurrency(cash, cashCurrency, displayCurrency, rates);
console.log(`现金=${cash} ${cashCurrency} → 显示=${displayCurrency}: ${result} (预期: 710000)`);
console.log(`结果: ${result === 710000 ? '✅' : '❌'}`);
console.log('');

// 测试3: 现金100000，结算货币CNY，显示货币USD
cash = 100000;
cashCurrency = 'CNY';
displayCurrency = 'USD';
result = convertCurrency(cash, cashCurrency, displayCurrency, rates);
console.log(`现金=${cash} ${cashCurrency} → 显示=${displayCurrency}: ${result.toFixed(2)} (预期: 14084.51)`);
console.log(`结果: ${Math.abs(result - 14084.51) < 0.01 ? '✅' : '❌'}`);
console.log('');

// 测试4: 现金100000，结算货币HKD，显示货币USD
cash = 100000;
cashCurrency = 'HKD';
displayCurrency = 'USD';
result = convertCurrency(cash, cashCurrency, displayCurrency, rates);
console.log(`现金=${cash} ${cashCurrency} → 显示=${displayCurrency}: ${result.toFixed(2)} (预期: 12903.23)`);
console.log(`结果: ${Math.abs(result - 12903.23) < 0.01 ? '✅' : '❌'}`);
console.log('');

console.log('=== 持仓市值转换测试 ===');
console.log('');

// 持仓1: 港股 00700，市值 HKD 100000
let pos1Value = 100000;
let pos1Currency = 'HKD';
result = convertCurrency(pos1Value, pos1Currency, 'USD', rates);
console.log(`港股市值=${pos1Value} HKD → USD: ${result.toFixed(2)} (预期: 12903.23)`);
console.log(`结果: ${Math.abs(result - 12903.23) < 0.01 ? '✅' : '❌'}`);
console.log('');

// 持仓2: 美股 AAPL，市值 USD 10000
let pos2Value = 10000;
let pos2Currency = 'USD';
result = convertCurrency(pos2Value, pos2Currency, 'USD', rates);
console.log(`美股市值=${pos2Value} USD → USD: ${result} (预期: 10000)`);
console.log(`结果: ${result === 10000 ? '✅' : '❌'}`);
console.log('');

// 持仓3: A股 600519，市值 CNY 100000
let pos3Value = 100000;
let pos3Currency = 'CNY';
result = convertCurrency(pos3Value, pos3Currency, 'USD', rates);
console.log(`A股市值=${pos3Value} CNY → USD: ${result.toFixed(2)} (预期: 14084.51)`);
console.log(`结果: ${Math.abs(result - 14084.51) < 0.01 ? '✅' : '❌'}`);
console.log('');

console.log('=== 总资产计算测试 (显示货币=USD) ===');
console.log('');

// 场景: 现金USD 10000 + 港股 HKD 77500 + 美股 USD 1000
let cashUSD = 10000;
let hkValue = 77500;
let usValue = 1000;
displayCurrency = 'USD';

let totalValue = 
  convertCurrency(cashUSD, 'USD', displayCurrency, rates) +
  convertCurrency(hkValue, 'HKD', displayCurrency, rates) +
  convertCurrency(usValue, 'USD', displayCurrency, rates);

console.log(`现金 USD 10000 + 港股 HKD 77500 + 美股 USD 1000 = 总资产 USD ${totalValue.toFixed(2)}`);
console.log(`计算: 10000 + (77500/7.75) + 1000 = 10000 + 10000 + 1000 = 21000`);
console.log(`结果: ${totalValue === 21000 ? '✅' : '❌'}`);
console.log('');

console.log('=== 占比计算测试 ===');
console.log('');

// 持仓市值转USD: 港股 HKD 77500 = USD 10000 (50%)
// 现金 USD 10000 (50%)
let hkValueUSD = convertCurrency(77500, 'HKD', 'USD', rates);
let cashUSD2 = 10000;
let total = hkValueUSD + cashUSD2;
let hkPercent = (hkValueUSD / total * 100).toFixed(1);
let cashPercent = (cashUSD2 / total * 100).toFixed(1);

console.log(`港股持仓: HKD 77500 → USD ${hkValueUSD} (占比: ${hkPercent}%)`);
console.log(`现金: USD ${cashUSD2} (占比: ${cashPercent}%)`);
console.log(`总资产: USD ${total}`);
console.log(`结果: ${hkPercent === '50.0' && cashPercent === '50.0' ? '✅' : '❌'}`);