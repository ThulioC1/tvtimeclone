import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FriendSearchModal from '../FriendSearchModal';

// Icons (inline SVG components for zero-dependency)
const HomeIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const SearchIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const ListIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);
const UserIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const AppLogo = () => (
  <svg viewBox="0 0 512 512" className="w-9 h-9" fill="none">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/>
        <stop offset="1" stop-color="#a855f7"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="112" fill="#0b0d12"/>
    <circle cx="256" cy="256" r="150" stroke="url(#lg)" strokeWidth="26"/>
    <line x1="256" y1="256" x2="256" y2="166" stroke="url(#lg)" strokeWidth="26" strokeLinecap="round"/>
    <line x1="256" y1="256" x2="330" y2="290" stroke="url(#lg)" strokeWidth="26" strokeLinecap="round"/>
    <path d="M226 340 L226 392 L300 370 Z" fill="url(#lg)"/>
  </svg>
);

const navItems = [
  { to: '/', label: 'Início', Icon: HomeIcon, end: true },
  { to: '/search', label: 'Buscar', Icon: SearchIcon },
  { to: '/watchlist', label: 'Minha Lista', Icon: ListIcon },
  { to: '/profile', label: 'Perfil', Icon: UserIcon },
];

const AppLayout: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-dark-800 border-r border-dark-500 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-dark-500">
          <AppLogo />
          <span className="text-xl font-bold gradient-text">Time to Watch</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 pt-4 flex-1">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                  isActive
                    ? 'text-white bg-white/[0.04]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-brand-400" />
                  )}
                  <Icon filled={isActive} />
                  {label}
                </>
              )}
            </NavLink>
          ))}

          {/* Buscar pessoas */}
          <button
            onClick={() => setSearchOpen(true)}
            className="relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.03] w-full text-left"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Pessoas
          </button>
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-dark-500 space-y-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar pessoas
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center overflow-hidden shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-semibold text-sm">
                  {(userProfile?.displayName || user?.email || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">
                {userProfile?.displayName || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </div>

        {/* ── Bottom Dock (mobile) ───────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glassmorphism border-t border-dark-400/50 safe-area-bottom">
          <div className="flex items-stretch justify-around max-w-md mx-auto">
            {navItems.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `nav-item flex-1 py-2.5 transition-colors duration-200 ${
                    isActive ? 'text-brand-400' : 'text-gray-500 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon filled={isActive} />
                    <span className="text-[10px] font-medium mt-0.5">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <button
              onClick={() => setSearchOpen(true)}
              className="nav-item flex-1 py-2.5 text-gray-500 hover:text-white transition-colors duration-200"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-[10px] font-medium mt-0.5">Pessoas</span>
            </button>
          </div>
        </nav>
      </main>

      <FriendSearchModal open={searchOpen} currentUid={user?.uid || ''} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default AppLayout;
