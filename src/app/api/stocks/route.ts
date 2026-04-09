import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codes = searchParams.get('codes');

  if (!codes) {
    return NextResponse.json({ error: 'Missing codes param' }, { status: 400 });
  }

  try {
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

      const rawCode = match[1];
      const parts = match[2].split('~');

      if (parts.length < 33) continue;

      const price = parseFloat(parts[3]) || 0;
      const change = parseFloat(parts[32]) || 0;
      const code = rawCode.replace(/^(sz|sh)/, '');

      result[code] = { price, change: Math.round(change * 100) / 100 };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch stock prices:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
