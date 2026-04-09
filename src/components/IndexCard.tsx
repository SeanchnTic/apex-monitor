'use client';

interface IndexCardProps {
  name: string;
  value: number;
  change: number;
  type: 'up' | 'down' | 'flat';
}

export default function IndexCard({ name, value, change, type }: IndexCardProps) {
  const isPositive = change >= 0;
  
  const getIcon = () => {
    switch (type) {
      case 'up': return 'trending_up';
      case 'down': return 'trending_down';
      default: return 'trending_flat';
    }
  };

  const getColorClass = () => {
    if (type === 'flat') return 'text-on-surface-variant bg-surface-container-high';
    return isPositive ? 'text-secondary bg-secondary/20' : 'text-tertiary bg-tertiary/20';
  };

  return (
    <div className="flex-none bg-surface-container-lowest px-5 py-4 rounded-xl border-transparent transition-transform hover:scale-[1.02] duration-300 group min-w-[200px]">
      <div className="flex items-center gap-3">
        <div>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">
            {name}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black tracking-tighter tabular-nums">
              {value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getColorClass()}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        </div>
        <span className={`material-symbols-outlined text-lg ml-auto ${type === 'up' ? 'text-secondary' : type === 'down' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
          {getIcon()}
        </span>
      </div>
    </div>
  );
}