'use client';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', icon: 'home', label: 'Home' },
  { id: 'funds', icon: 'account_balance_wallet', label: 'Funds' },
  { id: 'intel', icon: 'monitoring', label: 'Intel' },
  { id: 'profile', icon: 'person', label: 'Profile' },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 w-full z-50 lg:hidden bg-surface/90 backdrop-blur-lg border-t border-outline-variant/30 flex justify-around items-center px-4 py-3 pb-safe shadow-ambient rounded-t-xl">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onTabChange(item.id)}
          className={`flex flex-col items-center justify-center px-3 py-1 transition-all duration-100 ${
            activeTab === item.id
              ? 'text-primary bg-primary/10 rounded-xl scale-95'
              : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-xl">
            {item.icon}
          </span>
          <span className="text-[10px] uppercase tracking-widest mt-1 font-medium">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}