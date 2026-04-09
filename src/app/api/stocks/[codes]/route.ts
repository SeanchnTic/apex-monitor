import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codes: string }> }
) {
  const { codes } = await params;

  if (!codes) {
    return NextResponse.json({ error: 'Missing codes' }, { status: 400 });
  }

  try {
    // 腾讯行情接口 qt.gtimg.cn
    // 返回格式: v_sz300308="51~name~code~open~prevClose~current~..."
    // fields[4] = 昨日收盘, fields[5] = 当前价格
    // fields[36] = 涨跌幅(%)
    const response = await fetch(`https://qt.gtimg.cn/q=${codes}`, {
      headers: {
        'Referer': 'https://gu.qq.com',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    const text = await response.text();
    const result: Record<string, { price: number; change: number }> = {};

    for (const line of text.split('\n')) {
      const match = line.match(/v_(\w+)="([^"]+)"/);
      if (!match) continue;

      const rawCode = match[1]; // e.g. "sz300308"
      const parts = match[2].split('~');

      if (parts.length < 37) continue;

      // parts[1]=name, parts[3]=当前价, parts[4]=昨收, parts[32]=涨跌幅%(直接是百分比)
      const price = parseFloat(parts[3]) || 0;
      const change = parseFloat(parts[32]) || 0;

      // 从 rawCode 提取纯数字代码 (sz300308 -> 300308)
      const code = rawCode.replace(/^(sz|sh)/, '');

      result[code] = {
        price,
        change: Math.round(change * 100) / 100,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch stock prices:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
