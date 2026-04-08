import { NextResponse } from 'next/server';
import iconv from 'iconv-lite';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }
  
  try {
    // Fetch holdings from East Money (server-side, no CORS)
    const response = await fetch(
      `http://fund.eastmoney.com/pingzhongdata/${code}.js`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 404 });
    }
    
    const jsContent = await response.text();
    
    // Parse stock codes (format: "0.300750" = sz300750, "1.600519" = sh600519)
    const stockCodesMatch = jsContent.match(/var stockCodesNew\s*=\[([^\]]+)\]/);
    let rawCodes: string[] = [];
    if (stockCodesMatch) {
      rawCodes = stockCodesMatch[1].replace(/["']/g, '').split(',').filter(Boolean);
    }
    
    // Convert to standard codes (sz/sh prefix)
    // Format "0.300750" -> market=0(sz), code=300750
    const stockCodes = rawCodes.map((rc: string) => {
      const parts = rc.split('.');
      if (parts.length !== 2) return null;
      const market = parts[0];
      const num = parts[1];
      return market === '0' ? `sz${num}` : `sh${num}`;
    }).filter(Boolean) as string[];
    
    // Parse stock position (股票仓位)
    let stockPosition = 80;
    const sharesMatch = jsContent.match(/var Data_fundSharesPositions = (\[[^\]]+\])/);
    if (sharesMatch) {
      try {
        const parsed = JSON.parse(sharesMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stockPosition = parsed[parsed.length - 1][1] || 80;
        }
      } catch {}
    }
    
    // Parse holdings proportions
    let stockPositions: number[] = [];
    const positionsMatch = jsContent.match(/var Data_stockPositions = (\[[^\]]+\])/);
    if (positionsMatch) {
      try {
        const parsed = JSON.parse(positionsMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
          stockPositions = parsed[0].slice(-10).map((p: any) => parseFloat(p) || 0);
        }
      } catch {}
    }
    
    // Average distribution if no positions found
    if (stockPositions.length === 0 || stockPositions.every(p => p === 0)) {
      const count = Math.min(stockCodes.length, 10);
      stockPositions = new Array(count).fill(0);
      if (count > 0 && stockPosition > 0) {
        const avg = stockPosition / count;
        stockPositions = stockPositions.map(() => avg);
      }
    }
    
    const cashPosition = Math.max(0, 100 - stockPosition);
    
    // Fetch stock names from Sina API (GBK encoded)
    const stockNameMap: Record<string, string> = {};
    if (stockCodes.length > 0) {
      try {
        const sinaResponse = await fetch(
          `https://hq.sinajs.cn/list=${stockCodes.join(',')}`,
          {
            headers: {
              'Referer': 'https://finance.sina.com.cn',
              'User-Agent': 'Mozilla/5.0',
            },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (sinaResponse.ok) {
          const sinaBuffer = await sinaResponse.arrayBuffer();
          const sinaText = iconv.decode(Buffer.from(sinaBuffer), 'gbk');
          // Parse names: hq_str_sz300750="宁德时代,396.500,...
          const nameMatches = sinaText.matchAll(/hq_str_(sh|sz)(\d+)="([^,]+)/g);
          for (const match of nameMatches) {
            const market = match[1];
            const num = match[2];
            const name = match[3];
            stockNameMap[`${market}${num}`] = name;
          }
        }
      } catch (e) {
        console.error('Failed to fetch stock names from Sina:', e);
      }
    }
    
    // Build stocks array with names
    const stocks = stockCodes.slice(0, 10).map((sc: string, i: number) => {
      const plainCode = sc.replace(/^(sh|sz)/, '');
      return {
        code: plainCode,
        name: stockNameMap[sc] || plainCode,
        proportion: stockPositions[i] || 0,
        change: 0,
      };
    });
    
    return NextResponse.json({
      position: {
        stockPosition,
        bondPosition: 0,
        cashPosition,
        stocks,
        reportDate: '最新',
      }
    });
  } catch (error) {
    console.error(`Failed to fetch holdings for ${code}:`, error);
    return NextResponse.json({ error: 'Failed to parse holdings' }, { status: 500 });
  }
}