export default function StockSymbol({ symbol, style = {}, linkable = true }) {
  const parts = symbol?.split('.') || [];
  const code = parts[0];
  const market = parts[1]?.toUpperCase();
  
  // A股需要加 SH/SZ 前缀，港股和美股不用
  const xueqiuSymbol = (market === 'SH' || market === 'SZ') 
    ? (market + code) 
    : code;
  
  return (
    <span 
      onClick={(e) => {
        if (!linkable) return;
        e.stopPropagation();
        window.open(`https://xueqiu.com/S/${xueqiuSymbol}`, '_blank');
      }}
      style={{ 
        color: 'var(--blue)', 
        cursor: linkable ? 'pointer' : 'inherit',
        ...style 
      }}
    >
      {symbol}
    </span>
  );
}
