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
        const a = document.createElement('a');
        a.href = `https://xueqiu.com/S/${xueqiuSymbol}`;
        a.target = '_blank';
        a.rel = 'noreferrer noopener';
        a.click();
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
