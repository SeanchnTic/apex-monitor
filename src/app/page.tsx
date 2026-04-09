'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import TopNav from '@/components/TopNav';
import BottomNav from '@/components/BottomNav';
import IndexCard from '@/components/IndexCard';
import FundTable from '@/components/FundTable';
import IntelPage from '@/components/IntelPage';
import { FundData, IndexData, fetchFundsData, fetchIndexData } from '@/lib/fund-api';

// Default watched funds
const DEFAULT_FUNDS = ['161725', '161039', '110011'];

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fundCodes, setFundCodes] = useState<string[]>([]);
  const [fundsData, setFundsData] = useState<FundData[]>([]);
  const [indexData, setIndexData] = useState<IndexData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load saved funds from localStorage on mount
  useEffect(() => {
    try {
      // Try multiple possible keys for compatibility
      let saved = localStorage.getItem('myFundCodes');
      if (!saved) {
        saved = localStorage.getItem('apex-monitor-funds');
      }
      
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('Loaded funds from localStorage:', parsed);
          setFundCodes(parsed);
          return;
        }
      }
      console.log('No saved funds, using defaults:', DEFAULT_FUNDS);
      setFundCodes(DEFAULT_FUNDS);
    } catch (e) {
      console.error('Error loading from localStorage:', e);
      setFundCodes(DEFAULT_FUNDS);
    }
  }, []);

  // Fetch fund data - use ref to avoid stale closure
  const refreshFunds = useCallback(async () => {
    setIsLoading(true);
    try {
      const codes = fundCodesRef.current;
      const [funds, indices] = await Promise.all([
        codes.length > 0 ? fetchFundsData(codes) : Promise.resolve([]),
        fetchIndexData(),
      ]);
      setFundsData(funds);
      setIndexData(indices);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Use ref to track current fundCodes for intervals (avoids recreating intervals)
  const fundCodesRef = useRef(fundCodes);
  useEffect(() => {
    fundCodesRef.current = fundCodes;
  }, [fundCodes]);

  // Initial fetch - depends on fundCodes being loaded from localStorage
  useEffect(() => {
    if (fundCodes.length > 0) {
      refreshFunds();
    }
  }, [fundCodes]);

    // Auto-refresh: 30 seconds for indices, 60 seconds for funds
  useEffect(() => {
    if (!isAutoRefresh) return;
    
    const indexInterval = setInterval(() => {
      fetchIndexData().then(indices => {
        setIndexData(indices);
      });
    }, 30000);
    
    // Refresh funds every 60 seconds - always read latest from localStorage
    const fundInterval = setInterval(() => {
      try {
        const saved = localStorage.getItem('myFundCodes');
        if (saved) {
          const codes = JSON.parse(saved);
          if (Array.isArray(codes) && codes.length > 0) {
            fetchFundsData(codes).then(funds => setFundsData(funds));
            return;
          }
        }
        // Fallback to current state
        const currentCodes = fundCodesRef.current;
        if (currentCodes.length > 0) {
          fetchFundsData(currentCodes).then(funds => setFundsData(funds));
        }
      } catch (e) {
        console.error('Auto-refresh error:', e);
      }
    }, 60000);
    
    return () => {
      clearInterval(indexInterval);
      clearInterval(fundInterval);
    };
  }, [isAutoRefresh]);

  const handleAddFund = async (code: string) => {
    if (!fundCodes.includes(code)) {
      const newCodes = [...fundCodes, code];
      setFundCodes(newCodes);
      // Save to both keys for compatibility
      localStorage.setItem('myFundCodes', JSON.stringify(newCodes));
      localStorage.setItem('apex-monitor-funds', JSON.stringify(newCodes));
      
      // Directly fetch with new codes (avoids stale closure issue)
      setIsLoading(true);
      try {
        const [funds, indices] = await Promise.all([
          fetchFundsData(newCodes),
          fetchIndexData(),
        ]);
        setFundsData(funds);
        setIndexData(indices);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRemoveFund = async (code: string) => {
    const newCodes = fundCodes.filter(c => c !== code);
    setFundCodes(newCodes);
    // Save to both keys for compatibility
    if (newCodes.length > 0) {
      localStorage.setItem('myFundCodes', JSON.stringify(newCodes));
      localStorage.setItem('apex-monitor-funds', JSON.stringify(newCodes));
    } else {
      localStorage.removeItem('myFundCodes');
      localStorage.removeItem('apex-monitor-funds');
    }
    // Directly fetch with new codes (avoids stale closure issue)
    setIsLoading(true);
    try {
      const [funds, indices] = await Promise.all([
        newCodes.length > 0 ? fetchFundsData(newCodes) : Promise.resolve([]),
        fetchIndexData(),
      ]);
      setFundsData(funds);
      setIndexData(indices);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to determine index type
  const getIndexType = (change: number): 'up' | 'down' | 'flat' => {
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'flat';
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar - Desktop */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pb-24 lg:pb-0">
        {/* Top Navigation */}
        <TopNav onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Dashboard Content */}
        <div className="p-6 md:p-10 max-w-[1440px] mx-auto">
          {activeTab === 'intel' && <IntelPage />}
          {activeTab !== 'intel' && (
          <div>
          {/* Hero Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span className="text-primary font-bold text-sm tracking-widest uppercase">Overview</span>
              <h2 className="text-4xl font-black tracking-tight text-on-surface mt-2">Market Pulse</h2>
              <p className="text-on-surface-variant mt-2 max-w-xl">
                Intelligent curation of global market shifts and your private equity watchlists.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Live Market Data</span>
            </div>
          </div>

          {/* Bento Grid: Major Indices */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {indexData.length > 0 ? (
              indexData.map((index) => (
                <IndexCard 
                  key={index.code}
                  name={index.name}
                  value={index.value}
                  change={index.change}
                  type={getIndexType(index.change)}
                />
              ))
            ) : (
              // Fallback when loading
              <>
                <IndexCard name="上证指数" value={0} change={0} type="flat" />
                <IndexCard name="深证成指" value={0} change={0} type="flat" />
                <IndexCard name="创业板指" value={0} change={0} type="flat" />
              </>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Fund Table - Main Area */}
            <div className="lg:col-span-12 space-y-8">
              <FundTable
                funds={fundsData}
                onAddFund={handleAddFund}
                onRemoveFund={handleRemoveFund}
                onRefresh={refreshFunds}
                isLoading={isLoading}
                isAutoRefresh={isAutoRefresh}
                onToggleAutoRefresh={setIsAutoRefresh}
              />
            </div>
          </div>
          </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation - Mobile */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Material Icons - Hidden */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
      `}</style>
    </div>
  );
}