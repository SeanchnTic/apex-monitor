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
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-transparent transition-transform hover:scale-[1.02] duration-300 group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          {name}
        </span>
        <span className={`material-symbols-outlined ${type === 'up' ? 'text-secondary' : type === 'down' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
          {getIcon()}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black tracking-tighter tabular-nums">
          {value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${getColorClass()}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}