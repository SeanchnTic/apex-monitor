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

    // ── 1. Parse stockCodesNew ──────────────────────────────────────────────
    // 格式: ["0.300308","0.300502",...]  0=深圳(sz), 1=上海(sh)
    const stockCodesMatch = jsContent.match(/var stockCodesNew\s*=\s*\[([^\]]+)\]/);
    const rawCodes: string[] = [];
    if (stockCodesMatch) {
      const raw = stockCodesMatch[1].replace(/["']/g, '').split(',').filter(Boolean);
      for (const rc of raw) {
        const parts = rc.split('.');
        if (parts.length !== 2) continue;
        const market = parts[0];
        const num = parts[1];
        const prefix = market === '0' ? 'sz' : 'sh';
        rawCodes.push(`${prefix}${num}`);
      }
    }

    // ── 2. Parse stockPosition (股票总仓位) ─────────────────────────────────
    // 格式: [[timestamp, 92.47], ...]  取最后一个(最新)
    let stockPosition = 80;
    const sharesMatch = jsContent.match(/var Data_fundSharesPositions\s*=\s*(\[[^\]]+\])/);
    if (sharesMatch) {
      try {
        const parsed = JSON.parse(sharesMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          stockPosition = parseFloat(parsed[parsed.length - 1][1]) || 80;
        }
      } catch { /* use fallback */ }
    }

    // ── 3. Parse Data_stockPositions ────────────────────────────────────────
    // 格式: [[w1,w2,...], [w1,w2,...], ...] 每行是一个时间点，每列是一只股票
    // 取最后一行(最新)，长度应该等于股票数量
    let stockWeights: number[] = [];
    const positionsMatch = jsContent.match(/var Data_stockPositions\s*=\s*(\[.*?\])/s);
    if (positionsMatch) {
      try {
        const parsed = JSON.parse(positionsMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 取最后一行(最新报告期)
          const lastRow = parsed[parsed.length - 1];
          if (Array.isArray(lastRow)) {
            stockWeights = lastRow.map((p: unknown) => parseFloat(String(p)) || 0);
          }
        }
      } catch { /* use fallback */ }
    }

    // 如果 weights 数量和股票数量不匹配，取 stockCodesNew 长度
    const stockCount = rawCodes.length;
    if (stockWeights.length !== stockCount) {
      // Data_stockPositions 格式不对或为空，等权分配
      stockWeights = [];
    }

    // ── 4. Parse Data_netWorthTrend (最新净值) ───────────────────────────────
    // 格式: [{"x":timestamp,"y":3.6466,...}, ...]  数组是最老→最新，取最后
    let latestNav = 1.0;
    const navMatch = jsContent.match(/var Data_netWorthTrend\s*=\s*(\[.*?\]);/s);
    if (navMatch) {
      try {
        const parsed = JSON.parse(navMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          latestNav = parseFloat(parsed[parsed.length - 1].y) || 1.0;
        }
      } catch { /* use fallback */ }
    }

    const cashPosition = Math.max(0, 100 - stockPosition);

    // ── 5. Fetch stock names from Sina (GBK) ────────────────────────────────
    const stockNameMap: Record<string, string> = {};
    if (rawCodes.length > 0) {
      try {
        const sinaResp = await fetch(
          `https://hq.sinajs.cn/list=${rawCodes.join(',')}`,
          {
            headers: {
              'Referer': 'https://finance.sina.com.cn',
              'User-Agent': 'Mozilla/5.0',
            },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (sinaResp.ok) {
          const buf = await sinaResp.arrayBuffer();
          const text = iconv.decode(Buffer.from(buf), 'gbk');
          for (const m of text.matchAll(/hq_str_(sh|sz)(\d+)="([^,]+)/g)) {
            stockNameMap[`${m[1]}${m[2]}`] = m[3];
          }
        }
      } catch (e) {
        console.error('Failed to fetch stock names:', e);
      }
    }

    // ── 6. Build stocks array ───────────────────────────────────────────────
    const stocks = rawCodes.map((sc: string, i: number) => {
      const plainCode = sc.replace(/^(sh|sz)/, '');
      const proportion = (stockWeights.length === stockCount && stockWeights[i] !== 0)
        ? stockWeights[i]
        : (stockPosition > 0 ? stockPosition / stockCount : 0);
      return {
        code: plainCode,
        name: stockNameMap[sc] || plainCode,
        proportion: Math.round(proportion * 100) / 100,
        change: 0,
      };
    });

    return NextResponse.json({
      position: {
        stockPosition: Math.round(stockPosition * 100) / 100,
        bondPosition: 0,
        cashPosition: Math.round(cashPosition * 100) / 100,
        stocks,
        reportDate: '最新',
      },
      latestNav: Math.round(latestNav * 10000) / 10000,
    });
  } catch (error) {
    console.error(`Failed to fetch holdings for ${code}:`, error);
    return NextResponse.json({ error: 'Failed to parse holdings' }, { status: 500 });
  }
}
