import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      'https://qt.gtimg.cn/q=sh000001,sz399001,sz399006',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    
    if (!response.ok) {
      throw new Error('API error');
    }
    
    const text = await response.text();
    const indexMap: Record<string, { name: string; code: string }> = {
      'sh000001': { name: '上证指数', code: '000001' },
      'sz399001': { name: '深证成指', code: '399001' },
      'sz399006': { name: '创业板指', code: '399006' },
    };
    
    const results: any[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const match = line.match(/v_(sh\d+|sz\d+)="([^"]+)"/);
      if (match) {
        const key = match[1];
        const data = match[2].split('~');
        if (data.length > 30 && indexMap[key]) {
          const current = parseFloat(data[3]) || 0;
          const change = parseFloat(data[31]) || 0;
          const changeAmount = parseFloat(data[4]) || 0;
          
          results.push({
            code: indexMap[key].code,
            name: indexMap[key].name,
            price: current,
            change: changeAmount,
            changePercent: change,
          });
        }
      }
    }
    
    return NextResponse.json(results);
  } catch (error) {
    // Return fallback data
    return NextResponse.json([
      { code: '000001', name: '上证指数', price: 3346.28, change: 14.05, changePercent: 0.42 },
      { code: '399001', name: '深证成指', price: 10749.31, change: -19.35, changePercent: -0.18 },
      { code: '399006', name: '创业板指', price: 2193.45, change: 1.75, changePercent: 0.08 },
    ]);
  }
}