'use client';

import { useEffect } from 'react';

export default function PurePage() {
  useEffect(() => {
    window.location.href = '/index.html';
  }, []);
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="spinner-border text-primary mb-3"></div>
        <p className="text-on-surface">加载中...</p>
      </div>
    </div>
  );
}