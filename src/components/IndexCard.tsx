'use client';

interface IndexCardProps {
  name: string;
  value: number;
  change: number;
  type: 'up' | 'down' | 'flat';
  history?: number[];  // historical values for mini chart
}

export default function IndexCard({ name, value, change, type, history = [] }: IndexCardProps) {
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

  // Build SVG path from history
  const buildPath = () => {
    if (history.length < 2) {
      // Fallback static curve when no history
      return type === 'up' ? 'M0 40 Q 20 10 40 25 T 100 5' : 
             type === 'down' ? 'M0 5 Q 30 40 60 10 T 100 35' : 
             'M0 20 Q 25 18 50 22 T 100 20';
    }
    
    const values = history.slice(-20); // last 20 points max
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 40;
    const padding = 4;
    
    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });
    
    return `M${points.join(' L')}`;
  };

  const strokeColor = type === 'up' ? '#ef4444' : type === 'down' ? '#22c55e' : '#8b949e';

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
      {/* Mini Chart - Real history or fallback */}
      <div className="mt-6 h-16 w-full">
        <div className={`w-full h-full bg-gradient-to-t ${
          type === 'up' ? 'from-red-500/10 to-transparent' : 
          type === 'down' ? 'from-green-500/10 to-transparent' : 
          'from-on-surface-variant/5 to-transparent'
        } relative overflow-hidden rounded-lg`}>
          <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
            <path 
              d={buildPath()}
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}