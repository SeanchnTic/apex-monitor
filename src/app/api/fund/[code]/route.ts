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
    // Fetch fund data from Sina (browser-accessible, no CORS issues)
    // Sina fund format: f_CODE = "name,current,NAV,yesterdayNAV,date,changeAmount"
    const response = await fetch(`https://hq.sinajs.cn/list=f_${code}`, {
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
    }
    
    // Read as binary first, then decode GBK
    const iconv = await import('iconv-lite');
    const buffer = await response.arrayBuffer();
    const decoded = iconv.decode(Buffer.from(buffer), 'gbk');
    const match = decoded.match(/="([^"]+)"/);
    
    if (!match) {
      return NextResponse.json({ error: 'Invalid response' }, { status: 500 });
    }
    
    const fields = match[1].split(',');
    if (fields.length < 6) {
      return NextResponse.json({ error: 'Insufficient data' }, { status: 500 });
    }
    
    const [name, current, nav, yesterdayNav, date, changeAmount] = fields;
    const currentVal = parseFloat(current) || 0;      // gsz: 估算当前净值
    const navVal = parseFloat(nav) || 0;              // dwjz: 单位净值(今日收盘后)
    const yesterdayNavVal = parseFloat(yesterdayNav) || 0; // 真正的昨日净值
    const changeAmt = parseFloat(changeAmount) || 0;
    // NAV change percent: current/yesterdayNAV - 1, then * 100
    const navChange = yesterdayNavVal > 0 ? ((currentVal - yesterdayNavVal) / yesterdayNavVal * 100) : 0;
    
    return NextResponse.json({
      fundcode: code,
      name: name,
      dwjz: yesterdayNav,        // 昨日净值 ← fields[3]
      gsz: current,               // 估算当前净值 ← fields[1]
      gszzl: navChange.toFixed(2), // 涨跌幅 %
      gztime: new Date().toLocaleString('zh-CN'),
      jzrq: date,
      navHistory: [],
    });
  } catch (error) {
    console.error(`Failed to fetch fund ${code}:`, error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}