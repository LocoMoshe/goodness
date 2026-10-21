import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import BottomNavigation from './BottomNavigation';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  headerRight?: React.ReactNode;
  hideNav?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, title, showBack, headerRight, hideNav }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-sun-bg flex flex-col">
      {(title || headerRight || showBack) && (
        <header className="safe-top px-6 pb-2 flex items-center gap-2">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-sun-text"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {title && <h1 className="text-2xl font-bold flex-1">{title}</h1>}
          {!title && <div className="flex-1" />}
          {headerRight}
        </header>
      )}
      <main className="flex-1 w-full max-w-lg mx-auto pb-28">{children}</main>
      {!hideNav && <BottomNavigation />}
    </div>
  );
};

export default MainLayout;
