'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface IntelPageProps {
  className?: string;
}

export default function IntelPage({ className = '' }: IntelPageProps) {
  const [report, setReport] = useState<string>('');
  const [reportDate, setReportDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/reports/bili-report.md')
      .then(r => r.text())
      .then(text => {
        setReport(text);
        // Extract date from first heading like "A股市场情绪观测报告 (2026-04-07)"
        const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) setReportDate(dateMatch[1]);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-[#f8f9fa] flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0057cd] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#424655] text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`min-h-screen bg-[#f8f9fa] flex items-center justify-center ${className}`}>
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-[#e7e8e9] flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-3xl text-[#424655]">description</span>
          </div>
          <h2 className="text-xl font-bold text-[#191c1d] mb-2">暂无市场情报</h2>
          <p className="text-[#424655] text-sm">每日市场情绪报告将在交易日早上9:30前更新</p>
        </div>
      </div>
    );
  }

  // Parse date for display
  const dateDisplay = reportDate ? `${reportDate.slice(5, 7)}月${reportDate.slice(8, 10)}日` : '';

  return (
    <div className={`min-h-screen bg-[#f8f9fa] ${className}`}>
      {/* Editorial Header */}
      <header className="bg-white border-b border-[#c2c6d8]/15">
        <div className="max-w-3xl mx-auto px-6 py-10">
          {/* Publication tag */}
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-[#0057cd] text-white text-xs font-bold rounded-full uppercase tracking-wider">
              市场情报
            </span>
            <span className="text-[#424655] text-xs uppercase tracking-widest font-medium">
              A股 · 每日情绪观测
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-black text-[#191c1d] tracking-tight leading-tight mb-4">
            A股市场情绪观测报告
          </h1>

          {/* Date and meta */}
          <div className="flex items-center gap-4 text-[#424655]">
            <span className="text-lg font-medium">{dateDisplay}</span>
            <span className="w-1 h-1 rounded-full bg-[#424655]/30"></span>
            <span className="text-sm">基于B站财经UP主视频转录整理</span>
          </div>

          {/* Pulse indicator */}
          <div className="flex items-center gap-2 mt-6">
            <span className="w-2 h-2 rounded-full bg-[#006d41] animate-pulse"></span>
            <span className="text-xs font-bold text-[#006d41] uppercase tracking-wider">实时更新</span>
          </div>
        </div>
      </header>

      {/* Article Body */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm">
          <div className="prose prose-lg max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // Headings
                h1: ({children}) => (
                  <h1 className="text-2xl font-black text-[#191c1d] mt-10 mb-4 tracking-tight">{children}</h1>
                ),
                h2: ({children}) => (
                  <h2 className="text-xl font-bold text-[#191c1d] mt-8 mb-4 tracking-tight border-b border-[#e7e8e9] pb-3">{children}</h2>
                ),
                h3: ({children}) => (
                  <h3 className="text-lg font-bold text-[#191c1d] mt-6 mb-3">{children}</h3>
                ),
                h4: ({children}) => (
                  <h4 className="text-base font-bold text-[#191c1d] mt-4 mb-2">{children}</h4>
                ),
                // Paragraphs
                p: ({children}) => (
                  <p className="text-[#191c1d] leading-relaxed mb-4 text-[15px]">{children}</p>
                ),
                // Lists
                ul: ({children}) => (
                  <ul className="list-none space-y-2 mb-4">{children}</ul>
                ),
                ol: ({children}) => (
                  <ol className="list-decimal list-inside space-y-2 mb-4 text-[#191c1d]">{children}</ol>
                ),
                li: ({children}) => {
                  // Check if it's a emoji bullet item
                  const text = String(children);
                  const isEmoji = /^[🔑🆚⚠️★⭐]/.test(text);
                  const isStar = text.startsWith('*');
                  const isCheck = text.startsWith('✓') || text.startsWith('✅');
                  
                  if (isEmoji || isStar || isCheck) {
                    // Extract emoji and rest
                    const emojiMatch = text.match(/^([🔑🆚⚠️★⭐✓✅🏆📊💡🎯]+)\s*(.*)/);
                    if (emojiMatch) {
                      return (
                        <li className="flex items-start gap-3 text-[15px] leading-relaxed">
                          <span className="text-xl flex-shrink-0 mt-0.5">{emojiMatch[1]}</span>
                          <span className="text-[#191c1d] flex-1">{emojiMatch[2]}</span>
                        </li>
                      );
                    }
                  }
                  return (
                    <li className="text-[#191c1d] text-[15px] leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-[#0057cd]">
                      {children}
                    </li>
                  );
                },
                // Emphasis
                strong: ({children}) => {
                  const text = String(children);
                  // Color coding for sentiment
                  if (text.includes('看多') || text.includes('看涨') || text.includes('反弹') || text.includes('利好')) {
                    return <strong className="text-[#007144] font-bold">{children}</strong>;
                  }
                  if (text.includes('看空') || text.includes('看跌') || text.includes('风险') || text.includes('暴雷')) {
                    return <strong className="text-[#b91830] font-bold">{children}</strong>;
                  }
                  if (text.includes('中性') || text.includes('震荡') || text.includes('横盘')) {
                    return <strong className="text-[#0057cd] font-bold">{children}</strong>;
                  }
                  return <strong className="font-bold text-[#191c1d]">{children}</strong>;
                },
                // Horizontal rule
                hr: () => <hr className="border-none border-t border-[#e7e8e9] my-8" />,
                // Blockquote
                blockquote: ({children}) => (
                  <blockquote className="border-l-4 border-[#0057cd] pl-4 py-1 my-4 bg-[#f3f4f5] rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                // Tables
                table: ({children}) => (
                  <div className="overflow-x-auto my-6">
                    <table className="w-full text-sm">{children}</table>
                  </div>
                ),
                th: ({children}) => (
                  <th className="text-left font-bold text-[#191c1d] pb-2 pr-4 border-b border-[#e7e8e9]">{children}</th>
                ),
                td: ({children}) => (
                  <td className="py-2 pr-4 text-[#424655] border-b border-[#e7e8e9]/50">{children}</td>
                ),
                // Code
                code: ({children}) => (
                  <code className="bg-[#f3f4f5] text-[#0057cd] px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                ),
              }}
            >
              {report}
            </ReactMarkdown>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 pt-6 border-t border-[#e7e8e9]">
            <p className="text-xs text-[#424655]/60 text-center leading-relaxed">
              本报告基于B站财经UP主视频转录整理，供参考，不构成投资建议。
              <br />
              数据来源：{reportDate} B站财经UP主市场分析
            </p>
          </div>
        </div>

        {/* Bottom padding for mobile nav */}
        <div className="h-24"></div>
      </article>
    </div>
  );
}
