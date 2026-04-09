// Index data types
export interface IndexData {
  code: string;
  name: string;
  value: number;
  change: number;
  changeAmount: number;
  updateTime: string;
  history: number[];  // historical values for mini chart
}

// Fund holding stock
export interface HoldingStock {
  code: string;
  name: string;
  proportion: number;
  change: number;
}

// Fund position data
export interface FundPosition {
  stockPosition: number;
  bondPosition: number;
  cashPosition: number;
  stocks: HoldingStock[];
  reportDate: string;
}

// NAV history item
export interface NavHistoryItem {
  date: string;     // "2026-03-11"
  value: number;   // 净值
  change: number;  // 涨跌幅 %
}

// Fund data types
export interface FundData {
  code: string;
  name: string;
  nav: number;
  navChange: number;
  navChangeAmount: number;
  updateTime: string;
  yesterdayNav: number;
  navHistory: NavHistoryItem[];
  position: FundPosition | null;
}

// Fund name mapping
const fundNames: Record<string, string> = {
  '161725': '招商中证白酒指数',
  '161039': '富国中证新能源汽车指数',
  '110011': '易方达消费行业股票',
};

// Fetch index data via Tencent API (works from browser)
export async function fetchIndexData(): Promise<IndexData[]> {
  try {
    const response = await fetch(
      'https://qt.gtimg.cn/q=sh000001,sz399001,sz399006',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) throw new Error('API error');
    
    const text = await response.text();
    const indexMap: Record<string, { name: string; code: string }> = {
      'sh000001': { name: '上证指数', code: '000001' },
      'sz399001': { name: '深证成指', code: '399001' },
      'sz399006': { name: '创业板指', code: '399006' },
    };
    
    const results: IndexData[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const match = line.match(/v_(sh\d+|sz\d+)="([^"]+)"/);
      if (match) {
        const key = match[1];
        const data = match[2].split('~');
        if (data.length > 32 && indexMap[key]) {
          const current = parseFloat(data[3]) || 0;
          // data[32] is the percentage change (e.g., 2.70 for 2.70%)
          const change = parseFloat(data[32]) || 0;
          // data[4] is yesterday's close, changeAmount = current - yesterday
          const yesterday = parseFloat(data[4]) || 0;
          const changeAmount = yesterday > 0 ? current - yesterday : 0;
          
          results.push({
            code: indexMap[key].code,
            name: indexMap[key].name,
            value: current,
            change: Math.round(change * 100) / 100,
            changeAmount: Math.round(changeAmount * 100) / 100,
            updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            history: [],
          });
        }
      }
    }
    
    return results.length > 0 ? results : getFallbackIndexData();
  } catch (error) {
    console.error('Failed to fetch index data:', error);
    return getFallbackIndexData();
  }
}

function getFallbackIndexData(): IndexData[] {
  return [
    { code: '000001', name: '上证指数', value: 3346.28, change: 0.42, changeAmount: 14.05, updateTime: '15:00', history: [] },
    { code: '399001', name: '深证成指', value: 10749.31, change: -0.18, changeAmount: -19.35, updateTime: '15:00', history: [] },
    { code: '399006', name: '创业板指', value: 2193.45, change: 0.08, changeAmount: 1.75, updateTime: '15:00', history: [] },
  ];
}

// Fetch fund basic info + navHistory via API route (bypasses CORS)
async function fetchFundBasicInfo(code: string): Promise<{
  name: string;
  yesterdayNav: number;
  nav: number;
  navChange: number;
  updateTime: string;
  navHistory: NavHistoryItem[];
} | null> {
  try {
    const response = await fetch(`/api/fund/${code}`, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      name: data.name || `基金 ${code}`,
      yesterdayNav: parseFloat(data.dwjz) || 1.0,
      nav: parseFloat(data.gsz) || parseFloat(data.dwjz) || 1.0,
      navChange: parseFloat(data.gszzl) || 0,
      updateTime: data.gztime || '',
      navHistory: data.navHistory || [],
    };
  } catch (error) {
    console.error(`Failed to fetch fund info for ${code}:`, error);
    return null;
  }
}

// Fetch stock prices from Sina (works from browser) - exported for client-side use
export async function fetchSinaStockPrices(codes: string[]): Promise<Map<string, { price: number; change: number }>> {
  const priceMap = new Map<string, { price: number; change: number }>();
  
  if (codes.length === 0) return priceMap;
  
  try {
    const sinajsCodes = codes.map(c => {
      const code = c.replace(/\D/g, '');
      if (code.startsWith('6')) return `sh${code}`;
      if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`;
      return `sh${code}`;
    }).join(',');
    
    const response = await fetch(
      `https://hq.sinajs.cn/list=${sinajsCodes}`,
      {
        headers: {
          'Referer': 'https://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    
    if (!response.ok) throw new Error('Sina API error');
    
    const text = await response.text();
    const lines = text.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/var hq_str_(sh|sz)(\d+)="([^"]+)"/);
      if (match) {
        const code = match[2];
        const data = match[3].split(',');
        
        if (data.length >= 33) {
          const prevClose = parseFloat(data[1]) || 0;
          const price = parseFloat(data[0]) || 0;
          const change = prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0;
          
          priceMap.set(code, {
            price,
            change: Math.round(change * 100) / 100,
          });
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch Sina stock prices:', error);
  }
  
  return priceMap;
}

// Fetch fund holdings via API route
async function fetchFundHoldings(code: string): Promise<{ position: FundPosition | null; latestNav: number }> {
  try {
    // Use our own API to fetch holdings (bypasses CORS)
    const response = await fetch(`/api/fund/${code}/holdings`, {
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) return { position: null, latestNav: 1.0 };
    
    const data = await response.json();
    
    return { position: data.position, latestNav: data.latestNav || 1.0 };
  } catch (error) {
    console.error(`Failed to fetch holdings for ${code}:`, error);
    return { position: null, latestNav: 1.0 };
  }
}

// Fetch stock prices via our API route (bypasses Sina CORS) - exported for client use
export async function fetchStockPricesViaAPI(codes: string[]): Promise<Map<string, { price: number; change: number }>> {
  const priceMap = new Map<string, { price: number; change: number }>();
  if (codes.length === 0) return priceMap;
  
  try {
    // Convert to Sina format: sz300308,sh600000
    const sinajsCodes = codes.map(c => {
      const code = c.replace(/\D/g, '');
      if (code.startsWith('6')) return `sh${code}`;
      if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`;
      return `sh${code}`;
    }).join(',');
    
    const response = await fetch(`/api/stocks?codes=${sinajsCodes}`, {
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) return priceMap;
    
    const data = await response.json();
    
    // data is { "300308": { price, change }, "600000": { price, change }, ... }
    Object.entries(data).forEach(([code, info]: [string, any]) => {
      priceMap.set(code, { price: info.price, change: info.change });
    });
  } catch (error) {
    console.error('Failed to fetch stock prices via API:', error);
  }
  
  return priceMap;
}

// Main function
export async function fetchFundData(code: string): Promise<FundData | null> {
  // 1. Get fund name from Sina (Sina NAV is stale, only use for name)
  const basicInfo = await fetchFundBasicInfo(code);
  const fundName = basicInfo?.name || fundNames[code] || `基金 ${code}`;

  // 2. Get holdings from EastMoney + latest NAV (Data_netWorthTrend[0])
  const { position, latestNav } = await fetchFundHoldings(code);
  
  // latestNav from pingzhongdata Data_netWorthTrend = correct yesterday NAV (7.849)
  const yesterdayNav = latestNav;

  // 3. Calculate real-time implied NAV change from holdings
  let impliedChange = 0;
  let totalStockWeight = 0; // e.g., 0.85 for 85%
  
  if (position && position.stocks.length > 0) {
    const stockCodes = position.stocks.map(s => s.code);
    const stockPrices = await fetchStockPricesViaAPI(stockCodes);
    
    // Update stock change with real-time price
    position.stocks.forEach(stock => {
      const priceData = stockPrices.get(stock.code);
      if (priceData) {
        stock.change = priceData.change;
      }
    });
    
    // Calculate implied fund change = Σ(stockChange × stockWeight)
    // stockPosition is percentage (e.g., 85 = 85%), divide by 100 to get ratio
    const stockPositionRatio = position.stockPosition / 100; // e.g., 0.85
    const perStockWeight = position.stocks.length > 0 ? stockPositionRatio / position.stocks.length : 0;
    
    position.stocks.forEach(stock => {
      impliedChange += stock.change * perStockWeight;
      totalStockWeight += perStockWeight;
    });
    
    // Normalize by actual total weight
    if (totalStockWeight > 0) {
      impliedChange = impliedChange / totalStockWeight;
    }
  }
  
  const navChange = Math.round(impliedChange * 100) / 100;
  const nav = Math.round(yesterdayNav * (1 + navChange / 100) * 10000) / 10000;
  
  return {
    code,
    name: fundName,
    nav,
    navChange,
    navChangeAmount: Math.round(yesterdayNav * navChange / 100 * 10000) / 10000,
    updateTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    yesterdayNav,
    navHistory: basicInfo?.navHistory || [],
    position,
  };
}

export async function fetchFundsData(codes: string[]): Promise<FundData[]> {
  const results = await Promise.all(codes.map(code => fetchFundData(code)));
  return results.filter((result): result is FundData => result !== null);
}

// Server-side: fetch NAV history via API route
export async function fetchNavHistory(code: string): Promise<NavHistoryItem[]> {
  try {
    const response = await fetch(`/api/fund/${code}/navhistory`, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return [];
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch nav history for ${code}:`, error);
    return [];
  }
}

export function getFundName(code: string): string {
  return fundNames[code] || `基金 ${code}`;
}

// ─── Intraday trend persistence ───────────────────────────────────────────

const TREND_KEY = 'apex-fund-trend';
const TREND_EXPIRE_HOURS = 8; // expire after market close + buffer

export interface TrendPoint {
  time: number; // Unix timestamp ms
  navChange: number; // fund % change at this point
}

function getTrendStorage(): Record<string, Record<string, TrendPoint[]>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TREND_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTrendStorage(data: Record<string, Record<string, TrendPoint[]>>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TREND_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "2026-04-09"
}

// Load today's trend points for a fund, optionally filtering to today's market hours only
export function loadTrendPoints(code: string): TrendPoint[] {
  const storage = getTrendStorage();
  const todayData = storage[code]?.[todayKey()];
  if (!todayData) return [];
  
  // Filter to market hours 09:30-15:00 today
  const today = new Date();
  const marketStart = new Date(today);
  marketStart.setHours(9, 30, 0, 0);
  const marketEnd = new Date(today);
  marketEnd.setHours(15, 0, 0, 0);
  
  return todayData.filter(p => {
    const t = new Date(p.time);
    return t >= marketStart && t <= marketEnd;
  });
}

// Append a new trend point for a fund
export function appendTrendPoint(code: string, navChange: number) {
  const storage = getTrendStorage();
  if (!storage[code]) storage[code] = {};
  if (!storage[code][todayKey()]) storage[code][todayKey()] = [];
  
  storage[code][todayKey()].push({ time: Date.now(), navChange });
  
  // Keep only last 100 points per fund per day
  if (storage[code][todayKey()].length > 100) {
    storage[code][todayKey()] = storage[code][todayKey()].slice(-100);
  }
  
  // Prune old dates (keep only last 3 days)
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  Object.keys(storage[code]).forEach(dateKey => {
    const sampleTime = new Date(dateKey).getTime();
    if (sampleTime < cutoff) delete storage[code][dateKey];
  });
  
  saveTrendStorage(storage);
}

// Expire old trend data on page load (call once on init)
export function pruneTrendStorage() {
  const storage = getTrendStorage();
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  let changed = false;
  Object.keys(storage).forEach(code => {
    Object.keys(storage[code]).forEach(dateKey => {
      const sampleTime = new Date(dateKey).getTime();
      if (sampleTime < cutoff) {
        delete storage[code][dateKey];
        changed = true;
      }
    });
  });
  if (changed) saveTrendStorage(storage);
}