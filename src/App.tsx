import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GoodnessProvider, useGoodness } from './contexts/GoodnessContext';
import QuickLogSheet from './components/QuickLogSheet';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Verify from './pages/Verify';
import Rewards from './pages/Rewards';
import Badges from './pages/Badges';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Confirm from './pages/Confirm';
import NotFound from './pages/NotFound';

const Protected: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { session, loading } = useGoodness();
  if (loading) return <div className="min-h-screen bg-sun-bg" />;
  if (!session) return <Navigate to="/auth" replace />;
  return children;
};

const AuthRoute: React.FC = () => {
  const { session, loading } = useGoodness();
  if (loading) return <div className="min-h-screen bg-sun-bg" />;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
};

const AppRoutes = () => (
  <>
    <Routes>
      <Route path="/auth" element={<AuthRoute />} />
      <Route path="/confirm/:token" element={<Confirm />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/verify" element={<Protected><Verify /></Protected>} />
      <Route path="/rewards" element={<Protected><Rewards /></Protected>} />
      <Route path="/badges" element={<Protected><Badges /></Protected>} />
      <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <QuickLogSheet />
  </>
);

const App = () => (
  <TooltipProvider>
    <BrowserRouter>
      <GoodnessProvider>
        <Toaster />
        <AppRoutes />
      </GoodnessProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
