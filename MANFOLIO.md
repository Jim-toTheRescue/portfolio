# Manfolio 需求文档

## 项目背景

Manfolio（Manage Portfolio）是一个多投资组合管理应用，可以在一个应用中管理多个独立的portfolio。

## 路由

- `/manfolio` - 首页（portfolio列表）
- `/folio/:id` - portfolio管理页面

## 数据存储

### LocalStorage Key
`manfolio`

### 数据结构
```javascript
{
  activePortfolio: "default",  // 当前激活的portfolio ID
  portfolios: {
    "default": {
      name: "Default",                    // portfolio名称
      config: [...],                    // 梯队配置数组
      positions: [...],                // 持仓数组
      closedPositions: [...],          // 已清仓记录
      cash: 100000,                 // 现金
      history: [...],                // 历史记录
      priceTime: null              // 价格更新时间
    },
    "xxx": {
      name: "新portfolio",
      config: [...],
      positions: [...],
      cash: 0,
      history: [...],
      priceTime: null
    }
  }
}
```

## 功能

### 首页 `/manfolio`

1. **显示portfolio列表**
   - 卡片形式展示每个portfolio
   - 显示名称、总市值、现金

2. **创建新portfolio**
   - 点击按钮创建
   - 默认使用3梯队配置
   - 默认名称："新Portfolio" + 序号

3. **删除portfolio**
   - 删除按钮
   - 确认后删除

4. **进入portfolio**
   - 点击卡片进入 `/folio/:id`

### Portfolio页面 `/folio/:id`

1. **返回首页**
   - 头部返回按钮

2. **返回首页**
   - 现有功能保持不变
   - 数据读写通过抽象函数

## 数据读写抽象

提供统一的读写接口，不直接暴露 localStorage：

```javascript
// 获取当前激活的portfolio数据
getPortfolio()

// 获取指定portfolio数据
getPortfolio(id)

// 保存数据
savePortfolio(data)

// 获取所有portfolio列表
listPortfolios()
```

## 默认值

- 默认3梯队配置：
```javascript
[
  { name: '第一梯队', target: 30, limit: 1, buffer: 0, min: 25, max: 35 },
  { name: '第二梯队', target: 20, limit: 2, buffer: 1, min: 15, max: 25 },
  { name: '第三梯队', target: 10, limit: 3, buffer: 3, min: 5, max: 15 }
]
```

- 默认现金：100000

## 盈亏计算

### 未实现盈亏 (实时计算)
```
未实现盈亏 = Σ(股数 * (当前价 - avgCost))
```
- 需要按结算货币转换

### 已实现盈亏
```
已实现盈亏 = Σ(closedPositions.pnl)
```
- 需要按结算货币转换

### 组合总盈亏
```
总盈亏 = 已实现盈亏 + 未实现盈亏
盈亏百分比 = 总盈亏 / 总市值 * 100%
```

## 股价输入

所有交易操作（建仓/加仓/减仓/清仓）都支持输入股价：
- 默认值：建仓=实时查询，加仓/减仓/清仓=持仓价格
- 用户输入后优先使用输入价格
- 用于计算成本和盈亏

## 清仓弹窗

- 显示当前持仓信息
- 可输入股价
- 显示清仓金额、成本、预计盈亏（结算货币）
- 清仓后记录到 closedPositions

## 年换手率计算

按自然年计算，只看卖出操作：
- 需要按结算货币转换交易金额
- 分母使用结算货币的总市值