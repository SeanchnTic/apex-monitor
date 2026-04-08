import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }
  
  try {
    // 1. Fetch basic fund info from 天天基金
    const basicResponse = await fetch(`https://fundgz.1234567.com.cn/js/${code}.js`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    let basicData = null;
    if (basicResponse.ok) {
      const text = await basicResponse.text();
      const match = text.match(/jsonpgz\((\{.+\})\)/);
      if (match) {
        basicData = JSON.parse(match[1]);
      }
    }
    
    // 2. Fetch 30-day NAV history from 东方财富
    const historyResponse = await fetch(
      `https://api.fund.eastmoney.com/f10/lsjz?callback=&fundCode=${code}&pageIndex=1&pageSize=30&startDate=&endDate=&Plat=web`,
      {
        headers: {
          'Referer': 'https://fund.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    
    let navHistory: { date: string; value: number; change: number }[] = [];
    if (historyResponse.ok) {
      const historyJson = await historyResponse.json();
      if (historyJson.ErrCode === 0 && historyJson.Data?.LSJZList) {
        navHistory = historyJson.Data.LSJZList.map((item: any) => ({
          date: item.FSRQ,                          // "2026-03-11"
          value: parseFloat(item.DWJZ) || 0,        // 单位净值
          change: parseFloat(item.JZZZL) || 0,      // 涨跌幅 %
        }));
      }
    }
    
    // Build response
    const result = {
      fundcode: basicData?.fundcode || code,
      name: basicData?.name || `基金 ${code}`,
      dwjz: basicData?.dwjz || '0',
      gsz: basicData?.gsz || '0',
      gszzl: basicData?.gszzl || '0',
      gztime: basicData?.gztime || '',
      jzrq: basicData?.jzrq || '',
      navHistory,
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Failed to fetch fund ${code}:`, error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}