# Portfolio 重构清单

## 一、数据结构定义

### 1.1 核心数据模型

```javascript
// 持仓 Position
{
  symbol: string,        // 股票代码
  name: string,          // 股票名称
  shares: number,        // 股数
  price: number,         // 当前价格
  value: number,         // 市值 (shares * price)
  avgCost: number,       // 平均成本
  tier: number,          // 梯队 (1/2/3)
  inBuffer: boolean,    // 是否在缓冲位
  priceChange: number    // 涨跌幅 (%)
}

// 组合 Portfolio
{
  positions: Position[],
  cash: number,
  priceTime: string
}

// 历史记录 History
{
  type: string,          // 'buy'/'adj'/'sell'/'clear'
  symbol: string,
  name: string,
  action: string,       // '建仓'/'加仓'/'减仓'/'清仓'
  adjShares: number,
  totalShares: number,
  price: number,
  fromTier: number,
  toTier: number,
  time: string
}
```

### 1.2 梯队配置常量

```javascript
const TIER = [
  { name: '第一梯队', target: 30, limit: 1, buffer: 0, min: 25 },
  { name: '第二梯队', target: 20, limit: 2, buffer: 1, min: 15, max: 25 },
  { name: '第三梯队', target: 10, limit: 3, buffer: 3, min: 5, max: 15 }
];
```

---

## 二、模块/函数清单

### 2.1 工具函数

| 函数名 | 职责 | 输入 | 输出 |
|--------|------|------|------|
| `getTargetTier(percent)` | 根据占比判定梯队 | percent: number | tier: 1/2/3 |
| `getUpperLimit(tier)` | 获取梯队上限 | tier: number | limit: number |
| `getDrift(p)` | 计算偏离度 | position | drift: number |
| `getDriftClass(d)` | 偏离度样式 | drift | class: string |
| `getResultTier(percent)` | 计算结果梯队 | percent | tier: 1/2/3 |
| `getRealResultPercent(...)` | 计算交易后占比 | ... | percent |
| `totalValue()` | 计算股票总市值 | - | number |
| `totalWithCash()` | 计算总资产 | - | number |
| `roundCurrency(amount)` | 金额四舍五入 | amount | number |
| `entersTier(percent, tier)` | 判断是否进入梯队 | percent, tier | boolean |
| `tierName(tier)` | 获取梯队名称 | tier | string |

### 2.2 核心业务函数

| 函数名 | 职责 | 测试用例 |
|--------|------|----------|
| `calculateShares(params)` | 计算调仓股数 | 300个 |
| `autoRebalance(positions, total)` | 自动再平衡 | 12个 |
| `makeLog(...)` | 生成日志 | - |

#### calculateShares 支持的按钮类型：
- `=` - 目标比例
- `UP` / `DOWN` - 升级/降级
- `max1` / `min1` / `min2` - T1专用
- `max2` / `max1` / `min2` / `min3` - T2专用
- `max3` / `max2` / `min3` - T3专用

### 2.3 存储函数

| 函数名 | 职责 |
|--------|------|
| `loadData()` | 从LocalStorage加载持仓 |
| `saveData()` | 保存持仓到LocalStorage |
| `loadHistory()` | 从LocalStorage加载历史 |
| `saveHistory()` | 保存历史到LocalStorage |
| `log(entry)` | 记录操作日志 |

### 2.4 UI函数

| 函数名 | 职责 |
|--------|------|
| `render()` | 渲染整个界面 |
| `showToast(msg)` | 显示提示 |
| `showAddModal()` | 显示建仓弹窗 |
| `closeAddModal()` | 关闭建仓弹窗 |
| `showAdjModal(symbol, type)` | 显示调仓弹窗 |
| `closeAdjModal()` | 关闭调仓弹窗 |
| `showCashModal()` | 显示现金修改弹窗 |
| `closeCashModal()` | 关闭现金修改弹窗 |
| `showMockPriceModal()` | 显示Mock价格弹窗 |
| `closeMockPriceModal()` | 关闭Mock价格弹窗 |

### 2.5 业务操作函数

| 函数名 | 职责 | 验证点 |
|--------|------|--------|
| `confirmAdd()` | 确认建仓 | 资金/上限检查 |
| `confirmAdj()` | 确认调仓 | 资金/上限检查 |
| `confirmCash()` | 确认修改现金 | - |
| `setAdjToTarget()` | 设置到目标比例 | 按钮= |
| `setAdjToNextTarget()` | 设置到下一目标 | 按钮↑/↓ |
| `setAdjToCurrLimit()` | 设置到当前极限 | max1/min1 |
| `setAdjToNextLimit()` | 设置到下一极限 | max2/min2 |
| `clearPos(symbol)` | 清仓 | 确认对话框 |
| `refreshPrices()` | 刷新价格 | API调用 |
| `fetchQuote()` | 获取股票报价 | API调用 |
| `applyMockPrice()` | 应用Mock价格 | JSON解析 |
| `exportData()` | 导出数据 | JSON下载 |
| `importData(input)` | 导入数据 | JSON解析 |
| `toggleHistory()` | 切换历史面板 | - |
| `clearHistory()` | 清除历史 | 确认对话框 |
| `updateAddCost()` | 更新建仓金额 | - |
| `updateAdjCost()` | 更新调仓金额 | - |
| `resetRecommendShares()` | 重置推荐股数(T3 10%) | - |
| `setAddMinShares()` | 设置最小股数(5%) | - |
| `setAddMaxShares()` | 设置最大股数(15%) | - |

---

## 三、UI组件清单

### 3.1 页面结构

| 组件 | 说明 |
|------|------|
| `.app` | 主容器 |
| `.header` | 头部区域 |
| `.summary` | 汇总区域（市值/现金/合计） |
| `.main-content` | 主内容区（三梯队卡片） |
| `.history-panel` | 历史记录面板 |

### 3.2 梯队卡片 `.tier-card`

| 组件 | 说明 |
|------|------|
| `.tier-header` | 头部（名称+目标比例） |
| `.tier-content` | 内容区 |
| `.position-item` | 单个持仓项 |
| `.position-buffer` | 缓冲位样式 |
| `.empty-slot` | 空位占位符 |
| `.buffer-section` | 缓冲位区域 |
| `.buffer-label` | 缓冲位标签 |

### 3.3 持仓信息

| 组件 | 说明 |
|------|------|
| `.position-info` | 股票信息区 |
| `.position-code` | 代码+名称 |
| `.position-value` | 数值+占比 |
| `.drift` | 偏离度 |
| `.position-actions` | 操作按钮区 |

### 3.4 弹窗 `.modal`

| 组件 | 说明 |
|------|------|
| `.modal-overlay` | 遮罩层 |
| `.modal` | 弹窗主体 |
| `.modal-header` | 头部 |
| `.modal-body` | 主体 |
| `.modal-footer` | 底部 |
| `.form-group` | 表单组 |
| `.form-input` | 输入框 |

### 3.5 弹窗类型

| ID | 说明 |
|----|------|
| `#addModal` | 建仓弹窗 |
| `#adjModal` | 调仓弹窗 |
| `#mockPriceModal` | Mock价格弹窗 |
| `#cashModal` | 现金修改弹窗 |

---

## 四、CSS变量

```css
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --green: #3fb950;
  --red: #f85149;
  --blue: #58a6ff;
  --tier1: #da3633;
  --tier2: #d29922;
  --tier3: #238636;
}
```

---

## 五、API接口

| 接口 | 说明 |
|------|------|
| `https://qt.gtimg.cn/q=us{symbol}` | 获取股票报价 |

返回字段解析：
- `fields[1]` - 名称
- `fields[3]` - 当前价格
- `fields[30]` - 时间
- `fields[31]` - 涨跌幅

---

## 六、测试用例对照

### 6.1 调仓按钮测试（test.js）

| 用例ID | 描述 |
|--------|------|
| 1-25 | T1 = 按钮 |
| 26-50 | T2 = 按钮 |
| 51-75 | T3 = 按钮 |
| 76-100 | ↑ 按钮（升级） |
| 101-125 | ↓ 按钮（降级） |
| 126-175 | T1 max1/min1/min2 |
| 176-225 | T2 max2/max1/min2/min3 |
| 226-275 | T3 max3/max2/min3 |
| 276-300 | 边界情况 |

### 6.2 再平衡测试

| 用例ID | 场景 |
|--------|------|
| 1 | 全部降级到T3 |
| 2 | 正常分布 |
| 3 | 仅T1 |
| 4 | 权重不足降T3 |
| 5 | T2满员降T3 |
| 6 | T1+T2 |
| 7 | 缓冲位补主位 |
| 8 | 边界情况 |
| 9 | T1降T2 |
| 10 | T2升T1 |
| 11 | 现金增加一倍 |
| 12 | 清仓后缓冲补位 |

---

## 七、重构检查项

### 7.1 架构重构

- [ ] 将所有全局函数封装到模块/类中
- [ ] 分离数据层（Storage）和视图层（Render）
- [ ] 状态管理（统一data对象）

### 7.2 代码质量

- [ ] 使用ES6+语法（const/let/箭头函数/class）
- [ ] 添加JSDoc注释
- [ ] 统一的命名规范
- [ ] 错误处理完善

### 7.3 功能完整性

- [ ] 所有调仓按钮功能
- [ ] 自动再平衡逻辑
- [ ] 导入/导出功能
- [ ] 价格刷新功能
- [ ] Mock价格功能
- [ ] 历史记录功能

### 7.4 测试覆盖

- [ ] 300个调仓按钮用例通过
- [ ] 12个再平衡用例通过
- [ ] 边界情况覆盖

### 7.5 UI/UX

- [ ] 深色主题
- [ ] 响应式布局
- [ ] 弹窗动画
- [ ] Toast提示
- [ ] 加载状态

### 7.6 数据持久化

- [ ] LocalStorage正确读写
- [ ] 数据格式兼容
- [ ] 导入数据校验

---

## 八、潜在重构点

### 8.1 高优先级

1. **calculateShares函数重构**
   - 拆分为多个子函数
   - 消除重复代码
   - 增加可读性

2. **autoRebalance函数重构**
   - 简化分配逻辑
   - 减少循环嵌套
   - 增加注释

3. **render函数拆分**
   - 分离各组件渲染函数
   - 便于维护和测试

### 8.2 中优先级

4. **CSS样式提取**
   - 使用CSS变量
   - 组件化CSS类

5. **重复元素模板化**
   - position-item渲染
   - 弹窗HTML生成

### 8.3 低优先级

6. **测试代码独立**
   - 从index.html分离test.js

7. **TypeScript迁移**
   - 添加类型定义
   - 接口校验