export default function StockSymbol({ symbol, style = {}, linkable = true }) {
  const xueqiuSymbol = symbol?.split('.')[0] || symbol;
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
