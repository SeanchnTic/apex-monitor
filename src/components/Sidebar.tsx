'use client';

import { useState } from 'react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { id: 'funds', icon: 'account_balance', label: 'Fund Explorer' },
  { id: 'intel', icon: 'insights', label: 'Market Intel' },
  { id: 'analytics', icon: 'analytics', label: 'Analytics' },
  { id: 'reports', icon: 'description', label: 'Reports' },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col p-4 bg-surface-dim z-40 border-r border-outline-variant/30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined text-xl">account_balance</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-on-surface tracking-tighter">Apex Monitor</h1>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant opacity-70">
            Financial Intelligence
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-6 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-all duration-200 ${
              activeTab === item.id
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto space-y-1 pt-4 border-t border-outline-variant/30">
        <button className="w-full mb-4 bg-gradient-to-br from-primary to-primary-container text-on-primary py-3 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform">
          New Analysis
        </button>
        <button className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high rounded-xl w-full">
          <span className="material-symbols-outlined text-xl">help</span>
          <span className="text-sm font-medium">Support</span>
        </button>
        <button className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high rounded-xl w-full">
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="text-sm font-medium">Account</span>
        </button>
      </div>
    </aside>
  );
}