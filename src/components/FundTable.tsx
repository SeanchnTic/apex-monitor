'use client';

import { useState } from 'react';
import { FundData } from '@/lib/fund-api';
import FundDetailModal from './FundDetailModal';

interface FundTableProps {
  funds: FundData[];
  onAddFund: (code: string) => void;
  onRemoveFund: (code: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isAutoRefresh?: boolean;
  onToggleAutoRefresh?: (enabled: boolean) => void;
}

export default function FundTable({ 
  funds, 
  onAddFund, 
  onRemoveFund, 
  onRefresh, 
  isLoading,
  isAutoRefresh = true,
  onToggleAutoRefresh,
}: FundTableProps) {
  const [inputCode, setInputCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAdd = () => {
    const code = inputCode.trim();
    if (code) {
      setIsAdding(true);
      onAddFund(code);
      setInputCode('');
      
      setTimeout(() => {
        setIsAdding(false);
      }, 5000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  // 保持添加顺序，不排序
  const sortedFunds = [...funds];

  // Card component for each fund
  const FundCard = ({ fund }: { fund: FundData }) => {
    const isUp = fund.navChange >= 0;
    const borderColor = isUp ? 'border-l-secondary' : 'border-l-tertiary';
    const changeColor = isUp ? 'text-secondary' : 'text-tertiary';
    
    return (
      <div className={`bg-surface-container rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all border-l-4 ${borderColor}`}>
        {/* Fund Info */}
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-on-surface font-headline leading-tight truncate">
              {fund.name}
            </h3>
            <span className="bg-surface-container-highest px-2 py-0.5 rounded text-[10px] font-mono text-on-surface-variant shrink-0">
              {fund.code}
            </span>
          </div>
          <div className="flex gap-4 text-xs text-on-surface-variant pt-1">
            <span>更新时间: {fund.updateTime}</span>
          </div>
        </div>
        
        {/* Values */}
        <div className="grid grid-cols-2 md:flex md:items-center gap-4 md:gap-6">
          <div className="space-y-1">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">估算净值</p>
            <p className="text-lg font-bold font-mono">{fund.nav.toFixed(4)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">涨跌幅</p>
            <p className={`text-lg font-bold font-mono ${changeColor}`}>
              {fund.navChange >= 0 ? '+' : ''}{fund.navChange.toFixed(2)}%
            </p>
          </div>
          <div className="space-y-1 hidden sm:block">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">昨日净值</p>
            <p className="text-sm font-medium text-on-surface-variant font-mono">{fund.yesterdayNav.toFixed(4)}</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex md:flex-col gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => {
              setSelectedFund(fund);
              setIsModalOpen(true);
            }}
            className="flex-1 px-3 py-2 bg-surface-container-high text-on-surface text-sm font-semibold rounded-lg hover:bg-surface-container-highest active:scale-95 transition-all"
          >
            详情
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFund(fund.code);
            }}
            className="flex-1 px-3 py-2 text-tertiary text-sm font-semibold rounded-lg hover:bg-tertiary/20 active:scale-95 active:bg-tertiary/30 transition-all"
          >
            删除
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-surface-container-low flex flex-col gap-4 md:flex-row md:justify-between md:items-center bg-surface-container-lowest/50 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold tracking-tight">我的基金</h3>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">实时</span>
          </div>
        </div>
        
        {/* Add Fund Input - Mobile optimized */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdding && (
            <span className="material-symbols-outlined text-primary animate-spin">sync</span>
          )}
          <div className="relative flex-1 min-w-[120px]">
            <input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入基金代码"
              disabled={isAdding}
              className="bg-surface-container-low border-none rounded-xl px-3 py-2 w-full text-sm placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={isAdding}
            className={`px-3 py-2 rounded-xl font-bold text-sm transition-all duration-100 disabled:opacity-50 active:scale-90 active:brightness-125 active:shadow-inner shrink-0 ${
              isAdding 
                ? 'bg-green-500 text-white' 
                : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            {isAdding ? '加载中' : '添加'}
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-2 bg-surface-container-high text-on-surface-variant rounded-xl font-medium text-sm hover:bg-surface-container-highest transition-colors flex items-center gap-1 disabled:opacity-50 active:bg-surface-container-highest active:brightness-75 active:scale-95 shrink-0"
          >
            <span className={`material-symbols-outlined text-lg -ml-1 ${isLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            刷新
          </button>
        </div>
      </div>

      {/* Auto-refresh toggle */}
      <div className="md:hidden px-4 py-3 bg-surface-container-low rounded-none border-b border-surface-container-low">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-on-surface">自动刷新</span>
            <span className="text-[10px] text-on-surface-variant">基金60秒/指数30秒</span>
          </div>
          <button
            onClick={() => onToggleAutoRefresh?.(!isAutoRefresh)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isAutoRefresh ? 'bg-secondary-container' : 'bg-surface-container-highest'
            }`}
          >
            <span className={`translate-x-6 inline-block h-4 w-4 transform rounded-full bg-secondary transition-transform ${!isAutoRefresh ? 'translate-x-1' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Fund Cards */}
      <div className="p-4 space-y-3">
        {sortedFunds.length === 0 ? (
          <div className="py-10 text-center text-on-surface-variant">
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl opacity-50">folder_open</span>
              <p className="text-sm">暂无关注基金，请先添加</p>
            </div>
          </div>
        ) : (
          sortedFunds.map((fund) => (
            <FundCard key={fund.code} fund={fund} />
          ))
        )}
      </div>

      {/* Desktop Auto-refresh toggle */}
      <div className="hidden md:block px-4 py-3 bg-surface-container-low/50 border-t border-surface-container-low">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-on-surface">自动刷新</span>
            <span className="text-[10px] text-on-surface-variant">基金60秒/指数30秒</span>
          </div>
          <button
            onClick={() => onToggleAutoRefresh?.(!isAutoRefresh)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isAutoRefresh ? 'bg-secondary-container' : 'bg-surface-container-highest'
            }`}
          >
            <span className={`translate-x-6 inline-block h-4 w-4 transform rounded-full bg-secondary transition-transform ${!isAutoRefresh ? 'translate-x-1' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Fund Detail Modal */}
      <FundDetailModal 
        fund={selectedFund}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedFund(null);
        }}
      />
    </section>
  );
}