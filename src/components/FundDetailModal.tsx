'use client';

import { useState, useEffect, useRef } from 'react';
import { FundData, fetchNavHistory, fetchSinaStockPrices, NavHistoryItem } from '@/lib/fund-api';
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

// Real-time trend data: time=actual Date for X coordinate, nav=implied fund % change calculated from holdings
interface TrendPoint {
  time: Date;
  nav: number; // implied fund % change, not absolute NAV
}

export default function FundDetailModal({ fund, isOpen, onClose }: FundDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trend');
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [navHistory, setNavHistory] = useState<NavHistoryItem[]>([]);

  // Ref to keep fund fresh inside interval callback
  const fundRef = useRef(fund);
  useEffect(() => { fundRef.current = fund; }, [fund]);

  // Track previous navChange to avoid duplicate initial points
  const prevNavChangeRef = useRef<number | null>(null);

  // Initialize and track Sina navChange as the authoritative trend source
  // Page polling (every 60s) updates fund.navChange → new trend point
  useEffect(() => {
    if (!isOpen || !fund) return;
    
    const current = fund.navChange;
    if (prevNavChangeRef.current === null) {
      // First render: initialize
      prevNavChangeRef.current = current;
      setTrendData([{ time: new Date(), nav: current }]);
    } else if (current !== prevNavChangeRef.current) {
      // Subsequent updates from page polling
      prevNavChangeRef.current = current;
      setTrendData(prev => [...prev, { time: new Date(), nav: current }]);
    }
  }, [isOpen, fund?.navChange]);

  // Supplementary: re-calculate implied change from fresh stock prices every 60s
  // This gives additional data points based on real-time stock prices
  useEffect(() => {
    if (!isOpen || !fund?.position?.stocks?.length) return;
    
    const interval = setInterval(async () => {
      const currentFund = fundRef.current;
      if (!currentFund?.position?.stocks?.length) return;
      
      try {
        const codes = currentFund.position.stocks.map(s => s.code);
        const prices = await fetchSinaStockPrices(codes);
        
        let totalWeight = 0;
        let impliedChange = 0;
        currentFund.position.stocks.forEach(stock => {
          const priceData = prices.get(stock.code);
          const stockChange = priceData?.change ?? stock.change;
          impliedChange += stockChange * stock.proportion;
          totalWeight += stock.proportion;
        });
        
        if (totalWeight > 0) {
          impliedChange = impliedChange / totalWeight;
        }
        
        setTrendData(prev => [...prev, { time: new Date(), nav: impliedChange }]);
      } catch {
        // ignore failed polls
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [isOpen, fund?.position?.stocks]);

  // Fetch NAV history when nav30 tab is opened
  useEffect(() => {
    if (!isOpen || !fund || activeTab !== 'nav30') return;
    
    fetchNavHistory(fund.code).then(result => {
      setNavHistory(result);
    }).catch(() => {
      setNavHistory([]);
    });
  }, [isOpen, fund?.code, activeTab]);

  if (!isOpen || !fund) return null;

  const isUp = fund.navChange >= 0;
  const changeColor = isUp ? 'text-secondary' : 'text-tertiary';
  const borderColor = isUp ? 'border-l-secondary' : 'border-l-tertiary';

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
    const height = 160;
    const leftPadding = 40;  // space for Y-axis labels
    const bottomPadding = 24; // space for X-axis labels
    const topPadding = 10;
    const rightPadding = 10;
    
    const chartWidth = width - leftPadding - rightPadding;
    const chartHeight = height - topPadding - bottomPadding;
    
    // Y-axis: percentage change (TrendPoint.nav IS the % change)
    const minPercent = Math.min(...trendData.map(p => p.nav));
    const maxPercent = Math.max(...trendData.map(p => p.nav));
    const percentRange = maxPercent - minPercent || 0.5;
    const yPadding = percentRange * 0.1;
    const yMin = minPercent - yPadding;
    const yMax = maxPercent + yPadding;
    
    // Y-axis grid lines and labels (every 0.5% or adaptive)
    const yTickStep = percentRange > 3 ? 1 : 0.5;
    const yTicks: number[] = [];
    const yStart = Math.ceil(yMin / yTickStep) * yTickStep;
    for (let v = yStart; v <= yMax; v += yTickStep) {
      yTicks.push(Math.round(v * 100) / 100);
    }
    
    // Map percentage to Y coordinate
    const pctToY = (pct: number) => {
      return topPadding + chartHeight - ((pct - yMin) / (yMax - yMin)) * chartHeight;
    };
    
    // Map Date to X coordinate (09:30=0%, 15:00=100% of chart width)
    const dateToX = (d: Date) => {
      const minutes = d.getHours() * 60 + d.getMinutes() - (9 * 60 + 30);
      const totalMinutes = (15 * 60 + 0) - (9 * 60 + 30); // 330
      return leftPadding + Math.max(0, Math.min(1, minutes / totalMinutes)) * chartWidth;
    };
    
    // Build SVG path using real time X coordinates
    // trendData[].nav IS the implied % change, use directly
    const svgPoints = trendData.map((p) => {
      const x = dateToX(p.time);
      const y = pctToY(p.nav);
      return `${x},${y}`;
    }).join(' ');
    
    const areaPoints = `${leftPadding},${height - bottomPadding} ${svgPoints} ${leftPadding + chartWidth},${height - bottomPadding}`;
    
    const chartColor = isUp ? '#56f9f9' : '#ff716c';
    const lastPoint = trendData[trendData.length - 1];
    const currentPct = lastPoint.nav;
    const currentX = dateToX(lastPoint.time);
    const currentY = pctToY(currentPct);
    
    return (
      <div className="relative w-full bg-surface-container-low rounded-lg overflow-hidden">
        <svg className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="chartGradientDetail" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity="0.3"></stop>
              <stop offset="100%" stopColor={chartColor} stopOpacity="0"></stop>
            </linearGradient>
          </defs>
          
          {/* Grid lines and Y-axis labels */}
          {yTicks.map((tick, i) => {
            const y = pctToY(tick);
            const isZero = Math.abs(tick) < 0.01;
            return (
              <g key={i}>
                <line
                  x1={leftPadding}
                  y1={y}
                  x2={leftPadding + chartWidth}
                  y2={y}
                  stroke={isZero ? '#888' : '#444'}
                  strokeWidth={isZero ? 1 : 0.5}
                  strokeDasharray={isZero ? 'none' : '3,3'}
                />
                <text
                  x={leftPadding - 4}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#adaaaa"
                >
                  {tick >= 0 ? `+${tick.toFixed(1)}` : tick.toFixed(1)}%
                </text>
              </g>
            );
          })}
          
          {/* Zero line */}
          <line
            x1={leftPadding}
            y1={pctToY(0)}
            x2={leftPadding + chartWidth}
            y2={pctToY(0)}
            stroke="#888"
            strokeWidth="1"
          />
          
          {/* Area fill */}
          <polygon points={areaPoints} fill="url(#chartGradientDetail)" />
          
          {/* Line */}
          <polyline
            points={svgPoints}
            fill="none"
            stroke={chartColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* X-axis labels */}
          {['09:30', '10:30', '11:30', '13:00', '15:00'].map((t, i) => {
            const x = leftPadding + ((i) / 4) * chartWidth;
            return (
              <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="9" fill="#adaaaa">
                {t}
              </text>
            );
          })}
          
          {/* Current point dot */}
          <circle cx={currentX} cy={currentY} r="4" fill={chartColor} />
          <circle cx={currentX} cy={currentY} r="7" fill={chartColor} opacity="0.2" />
        </svg>
        
        {/* Current percentage label */}
        <div
          className="absolute top-1 right-2 text-xs font-bold"
          style={{ color: chartColor }}
        >
          {currentPct >= 0 ? '+' : ''}{currentPct.toFixed(2)}%
        </div>
      </div>
    );
  };

  // Render 30-day NAV history chart using ECharts
  const renderNav30Chart = () => {
    // navHistory: { date: "2026-03-11", value: 4.7142, change: 0.63 }
    // Reverse to show oldest first (left to right)
    const sortedHistory = [...navHistory].reverse();
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="h-screen bg-surface overflow-y-auto">
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

        <main className="pt-16 pb-28 px-4 max-w-xl mx-auto space-y-4">
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
                  {/* 30-day NAV chart - fixed at top */}
                  <div className="bg-surface-container-low rounded-lg p-2">
                    {renderNav30Chart()}
                  </div>
                  {/* NAV history list - scrollable */}
                  <div className="max-h-[40vh] overflow-y-auto">
                    {navHistory.length > 0 ? (
                      navHistory.slice().reverse().map((item, index) => {
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
                </div>
              )}

              {activeTab === 'holdings' && (
                <div className="max-h-[50vh] overflow-y-auto space-y-2">
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