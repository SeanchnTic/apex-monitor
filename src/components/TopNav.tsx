'use client';

import ThemeToggle from './ThemeToggle';

interface TopNavProps {
  onMenuClick?: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 glass border-b border-outline-variant/30">
      <div className="flex justify-between items-center px-6 h-16 max-w-[1440px] mx-auto">
        {/* Left Section */}
        <div className="flex items-center gap-8">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>
          
          {/* Search Bar - Hidden on mobile */}
          <div className="hidden md:flex relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
              search
            </span>
            <input
              className="bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20 rounded-xl pl-10 pr-4 py-2 w-80 text-sm placeholder:text-on-surface-variant/50"
              placeholder="Search markets, funds, or intel..."
              type="text"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl active:scale-95 duration-150 transition-colors relative">
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-tertiary rounded-full border-2 border-surface"></span>
          </button>
          <ThemeToggle />
          <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold text-sm">
              U
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}