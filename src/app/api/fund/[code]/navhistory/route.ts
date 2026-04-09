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
    // 东方财富净值历史 API
    const response = await fetch(
      `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=30&Plat=web`,
      {
        headers: {
          'Referer': 'https://fund.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    const data = await response.json();

    if (data.ErrCode !== 0 || !data.Data?.LSJZList) {
      return NextResponse.json([]);
    }

    const history = data.Data.LSJZList.map((item: any) => ({
      date: item.FSRQ,
      value: parseFloat(item.DWJZ) || 0,
      change: parseFloat(item.JZZZL) || 0,
    }));

    return NextResponse.json(history);
  } catch (error) {
    console.error(`Failed to fetch nav history for ${code}:`, error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
