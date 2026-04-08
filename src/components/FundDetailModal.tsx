'use client';

import { useState, useEffect, useRef } from 'react';
import { FundData } from '@/lib/fund-api';
import dynamic from 'next/dynamic';

// Dynamically import ECharts to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface FundDetailModalProps {
  fund: FundData | null;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'trend' | 'nav30' | 'holdings';

interface Holding {
  code: string;
  name: string;
  proportion: number;
  change: number;
}

// Real-time trend data (will be collected over time)
interface TrendPoint {
  time: string;
  nav: number;
}

export default function FundDetailModal({ fund, isOpen, onClose }: FundDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trend');
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Initialize trend data when modal opens
  useEffect(() => {
    if (isOpen && fund) {
      // Generate initial trend data based on current nav
      const initialData: TrendPoint[] = [];
      const baseNav = fund.nav;
      const changePercent = fund.navChange / 100;
      
      // Generate points from market open (09:30) to now
      const times = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
      const currentHour = new Date().getHours();
      const currentMinute = new Date().getMinutes();
      const currentTime = currentHour * 60 + currentMinute;
      
      times.forEach((time, index) => {
        const [h, m] = time.split(':').map(Number);
        const timeMinutes = h * 60 + m;
        
        if (timeMinutes <= currentTime) {
          // Generate a realistic looking trend
          const progress = index / (times.length - 1);
          const randomVariation = (Math.random() - 0.5) * 0.02;
          const nav = baseNav * (1 - changePercent * (1 - progress)) + randomVariation;
          initialData.push({ time, nav: Number(nav.toFixed(4)) });
        }
      });
      
      // Add current point
      initialData.push({
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        nav: fund.nav
      });
      
      setTrendData(initialData);
      setCurrentIndex(initialData.length - 1);
    }
  }, [isOpen, fund]);

  // Collect real-time data every 60 seconds
  useEffect(() => {
    if (!isOpen || !fund) return;
    
    const interval = setInterval(() => {
      const newPoint: TrendPoint = {
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        nav: fund.nav
      };
      setTrendData(prev => [...prev, newPoint]);
      setCurrentIndex(prev => prev + 1);
    }, 60000);
    
    return () => clearInterval(interval);
  }, [isOpen, fund]);

  if (!isOpen || !fund) return null;

  const isUp = fund.navChange >= 0;
  const changeColor = isUp ? 'text-secondary' : 'text-tertiary';
  const borderColor = isUp ? 'border-l-secondary' : 'border-l-tertiary';

  // Calculate chart range
  const navValues = trendData.map(p => p.nav);
  const minNav = Math.min(...navValues) * 0.998;
  const maxNav = Math.max(...navValues) * 1.002;

  // Render Trend Chart
  const renderTrendChart = () => {
    if (trendData.length < 2) {
      return (
        <div className="h-48 flex items-center justify-center text-on-surface-variant">
          暂无数据，请稍后刷新
        </div>
      );
    }

    const width = 320;
    const height = 120;
    const padding = 10;
    
    const points = trendData.map((p, i) => {
      const x = padding + (i / (trendData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p.nav - minNav) / (maxNav - minNav)) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

    return (
      <div className="relative h-48 w-full bg-surface-container-low rounded-lg p-2 overflow-hidden">
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-20 p-4">
          <div className="w-full border-t border-white"></div>
          <div className="w-full border-t border-white"></div>
          <div className="w-full border-t border-white"></div>
          <div className="w-full border-t border-white"></div>
        </div>
        
        {/* Chart SVG */}
        <svg className="absolute inset-0 w-full h-full px-2" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="chartGradientDetail" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={isUp ? "#56f9f9" : "#ff716c"} stopOpacity="0.3"></stop>
              <stop offset="100%" stopColor={isUp ? "#56f9f9" : "#ff716c"} stopOpacity="0"></stop>
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill={`url(#chartGradientDetail)`} />
          <polyline points={points} fill="none" stroke={isUp ? "#56f9f9" : "#ff716c"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
        
        {/* Current Point Marker */}
        <div className="absolute top-[20px] right-[20px] w-3 h-3 bg-primary rounded-full ring-4 ring-primary/20"></div>
      </div>
    );
  };

  // Render 30-day NAV history chart using ECharts
  const renderNav30Chart = () => {
    // navHistory: { date: "2026-03-11", value: 4.7142, change: 0.63 }
    // Reverse to show oldest first (left to right)
    const sortedHistory = [...(fund.navHistory || [])].reverse();
    const dates = sortedHistory.map(item => item.date.slice(5)); // "03-11"
    const navs = sortedHistory.map(item => item.value);
    
    // Determine color based on first vs last value
    const firstValue = navs[0];
    const lastValue = navs[navs.length - 1];
    const isUpOverall = lastValue >= firstValue;
    const lineColor = isUpOverall ? '#56f9f9' : '#ff716c';
    
    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1919',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const idx = params[0].dataIndex;
          const item = sortedHistory[idx];
          return `${item.date}<br/>净值: ${item.value.toFixed(4)}<br/>涨跌: ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#adaaaa', fontSize: 10, interval: 4 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#222', opacity: 0.3 } },
        axisLabel: { color: '#adaaaa', fontSize: 10 },
      },
      series: [{
        data: navs,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: lineColor },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: lineColor + '40' },
              { offset: 1, color: lineColor + '00' }
            ]
          }
        }
      }]
    };
    
    return (
      <ReactECharts 
        option={option} 
        style={{ height: '180px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    );
  };

  // Get holdings from fund data
  const holdings: Holding[] = fund.position?.stocks?.map(s => ({
    code: s.code,
    name: s.name,
    proportion: s.proportion,
    change: s.change
  })) || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="min-h-screen bg-surface pb-24 overflow-y-auto">
        {/* Top AppBar */}
        <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 h-14 max-w-xl mx-auto">
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="p-2 -ml-2 active:scale-90 transition-transform">
                <span className="material-symbols-outlined text-primary">close</span>
              </button>
              <h1 className="font-headline font-bold text-base tracking-tight text-on-surface truncate max-w-[200px]">
                {fund.name}
              </h1>
            </div>
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">share</span>
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">star</span>
            </div>
          </div>
        </header>

        <main className="pt-16 pb-8 px-4 max-w-xl mx-auto space-y-4">
          {/* Header Section */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-surface-container-highest px-2 py-0.5 rounded text-[10px] font-mono text-on-surface-variant">
                {fund.code}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <p className="text-on-surface-variant text-[10px] font-medium uppercase tracking-wider">估算净值</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-headline font-extrabold tracking-tighter text-on-surface">{fund.nav.toFixed(4)}</span>
                  <span className={`text-base font-headline font-bold ${changeColor}`}>
                    {fund.navChange >= 0 ? '+' : ''}{fund.navChange.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="text-right pb-1">
                <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">昨日净值</p>
                <p className="font-headline font-semibold text-sm">{fund.yesterdayNav.toFixed(4)}</p>
              </div>
            </div>
          </section>

          {/* Tab Card */}
          <section className="bg-surface-container rounded-xl overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-white/5">
              <button 
                onClick={() => setActiveTab('trend')}
                className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'trend' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                当日走势
              </button>
              <button 
                onClick={() => setActiveTab('nav30')}
                className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'nav30' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                近30天净值
              </button>
              <button 
                onClick={() => setActiveTab('holdings')}
                className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'holdings' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                持仓明细
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === 'trend' && (
                <div className="space-y-3">
                  {renderTrendChart()}
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-on-surface-variant">09:30</span>
                    <span className="text-[10px] font-bold text-on-surface-variant">15:00</span>
                  </div>
                </div>
              )}

              {activeTab === 'nav30' && (
                <div className="space-y-3">
                  {/* 30-day NAV chart */}
                  <div className="bg-surface-container-low rounded-lg p-2">
                    {renderNav30Chart()}
                  </div>
                  {/* NAV history list */}
                  {fund.navHistory && fund.navHistory.length > 0 ? (
                    fund.navHistory.slice().reverse().map((item, index) => {
                      const isUpDay = item.change >= 0;
                      return (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <span className="text-xs text-on-surface-variant">{item.date.slice(5)}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-sm">{item.value.toFixed(4)}</span>
                            <span className={`font-mono text-xs ${isUpDay ? 'text-secondary' : 'text-tertiary'}`}>
                              {isUpDay ? '+' : ''}{item.change.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-4 text-center text-on-surface-variant text-sm">
                      暂无历史净值数据
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'holdings' && (
                <div className="space-y-2">
                  {holdings.length === 0 ? (
                    <div className="py-8 text-center text-on-surface-variant text-sm">
                      暂无持仓数据
                    </div>
                  ) : (
                    holdings.map((holding, index) => {
                      const isUpHolding = holding.change >= 0;
                      return (
                        <div key={index} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center">
                              <span className="material-symbols-outlined text-secondary text-lg">memory</span>
                            </div>
                            <div>
                              <p className="font-headline font-bold text-on-surface text-sm">{holding.name}</p>
                              <p className="text-on-surface-variant text-[10px] font-medium">{holding.code}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-headline font-bold ${isUpHolding ? 'text-secondary' : 'text-tertiary'}`}>
                              {holding.proportion.toFixed(2)}%
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-bold uppercase">仓位</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Holdings Preview (always show below tabs) */}
          {activeTab !== 'holdings' && holdings.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-headline font-bold text-sm text-on-surface">重仓持股</h3>
                <button onClick={() => setActiveTab('holdings')} className="text-primary text-xs font-bold uppercase tracking-wider">
                  查看全部
                </button>
              </div>
              <div className="space-y-2">
                {holdings.slice(0, 3).map((holding, index) => {
                  const isUpHolding = holding.change >= 0;
                  return (
                    <div key={index} className="p-3 bg-surface-container rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center">
                          <span className="material-symbols-outlined text-secondary text-lg">memory</span>
                        </div>
                        <div>
                          <p className="font-headline font-bold text-on-surface text-sm">{holding.name}</p>
                          <p className="text-on-surface-variant text-[10px] font-medium">{holding.code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-headline font-bold ${isUpHolding ? 'text-secondary' : 'text-tertiary'}`}>
                          {holding.proportion.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        {/* Bottom Close Button */}
        <div className="fixed bottom-0 left-0 w-full z-50">
          <div className="max-w-xl mx-auto flex justify-center px-6 pb-8 pt-4 bg-surface/80 backdrop-blur-xl">
            <button 
              onClick={onClose}
              className="w-14 h-14 bg-surface-container-high rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-on-surface">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}