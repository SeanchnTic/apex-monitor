import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { codes } = await request.json();
    
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all funds in parallel
    const results = await Promise.all(
      codes.map(async (code: string) => {
        try {
          const response = await fetch(`https://fundgz.1234567.com.cn/js/${code}.js`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          
          if (!response.ok) return null;
          
          const text = await response.text();
          const match = text.match(/jsonpgz\((\{.+\})\)/);
          
          if (!match) return null;
          
          const data = JSON.parse(match[1]);
          return {
            code: data.showncode || data.code,
            name: data.name,
            nav: parseFloat(data.gsz) || 0,
            navChange: parseFloat(data.gszzl) || 0,
            yesterdayNav: parseFloat(data.dwjz) || 0,
            updateTime: data.gztime || '',
          };
        } catch {
          return null;
        }
      })
    );

    // Filter out failed fetches and preserve order
    const validResults = results.filter(r => r !== null);
    
    // Sort by original codes order
    const codeOrder = codes.reduce((acc, code, idx) => {
      acc[code] = idx;
      return acc;
    }, {} as Record<string, number>);
    
    validResults.sort((a, b) => (codeOrder[a.code] || 0) - (codeOrder[b.code] || 0));

    return NextResponse.json(validResults);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}