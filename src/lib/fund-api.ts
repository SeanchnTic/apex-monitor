// Index data types
export interface IndexData {
  code: string;
  name: string;
  value: number;
  change: number;
  changeAmount: number;
  updateTime: string;
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
    { code: '000001', name: '上证指数', value: 3346.28, change: 0.42, changeAmount: 14.05, updateTime: '15:00' },
    { code: '399001', name: '深证成指', value: 10749.31, change: -0.18, changeAmount: -19.35, updateTime: '15:00' },
    { code: '399006', name: '创业板指', value: 2193.45, change: 0.08, changeAmount: 1.75, updateTime: '15:00' },
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

// Fetch stock prices from Sina (works from browser)
async function fetchSinaStockPrices(codes: string[]): Promise<Map<string, { price: number; change: number }>> {
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
async function fetchFundHoldings(code: string): Promise<FundPosition | null> {
  try {
    // Use our own API to fetch holdings (bypasses CORS)
    const response = await fetch(`/api/fund/${code}/holdings`, {
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return data.position;
  } catch (error) {
    console.error(`Failed to fetch holdings for ${code}:`, error);
    return null;
  }
}

// Main function
export async function fetchFundData(code: string): Promise<FundData | null> {
  // 1. Get basic fund info + navHistory
  const basicInfo = await fetchFundBasicInfo(code);
  
  const fundName = basicInfo?.name || fundNames[code] || `基金 ${code}`;
  const yesterdayNav = basicInfo?.yesterdayNav || 1.0;
  const nav = basicInfo?.nav || yesterdayNav;
  const navChange = basicInfo?.navChange || 0;
  const updateTime = basicInfo?.updateTime || '';
  const navHistory = basicInfo?.navHistory || [];
  
  // 2. Get holdings
  const position = await fetchFundHoldings(code);
  
  // 3. Get real-time stock prices
  if (position && position.stocks.length > 0) {
    const stockCodes = position.stocks.map(s => s.code);
    const stockPrices = await fetchSinaStockPrices(stockCodes);
    
    position.stocks.forEach(stock => {
      const priceData = stockPrices.get(stock.code);
      if (priceData) {
        stock.change = priceData.change;
      }
    });
  }
  
  return {
    code,
    name: fundName,
    nav,
    navChange,
    navChangeAmount: Math.round(yesterdayNav * navChange / 100 * 10000) / 10000,
    updateTime,
    yesterdayNav,
    navHistory,
    position,
  };
}

export async function fetchFundsData(codes: string[]): Promise<FundData[]> {
  const results = await Promise.all(codes.map(code => fetchFundData(code)));
  return results.filter((result): result is FundData => result !== null);
}

export function getFundName(code: string): string {
  return fundNames[code] || `基金 ${code}`;
}