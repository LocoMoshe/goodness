import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShieldCheck, Gift, Award, User } from 'lucide-react';
import { useGoodness } from '@/contexts/GoodnessContext';

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/verify', label: 'Verify', icon: ShieldCheck },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/badges', label: 'Badges', icon: Award },
  { to: '/profile', label: 'Profile', icon: User },
];

const BottomNavigation: React.FC = () => {
  const { stats } = useGoodness();
  const queue = stats?.can_verify ? stats.verify_queue_size : 0;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-sun-bar border-t border-sun-line safe-bottom">
      <div className="max-w-lg mx-auto grid grid-cols-5 px-2 pt-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 min-h-[48px] text-xs font-semibold ${
                isActive ? 'text-sun-accent' : 'text-sun-muted'
              }`
            }
          >
            <Icon size={22} strokeWidth={2} />
            {label}
            {to === '/verify' && queue > 0 && (
              <span className="absolute top-0 right-[22%] min-w-[18px] h-[18px] px-1 rounded-full bg-sun-accent text-white text-[11px] font-bold flex items-center justify-center">
                {queue > 9 ? '9+' : queue}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNavigation;
