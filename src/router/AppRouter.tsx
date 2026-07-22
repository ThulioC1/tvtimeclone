import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/layout/AppLayout';

const AuthPage = React.lazy(() => import('../pages/AuthPage'));
const HomePage = React.lazy(() => import('../pages/HomePage'));
const SearchPage = React.lazy(() => import('../pages/SearchPage'));
const ShowDetailPage = React.lazy(() => import('../pages/ShowDetailPage'));
const MovieDetailPage = React.lazy(() => import('../pages/MovieDetailPage'));
const WatchlistPage = React.lazy(() => import('../pages/WatchlistPage'));
const ProfilePage = React.lazy(() => import('../pages/ProfilePage'));
const UserProfilePage = React.lazy(() => import('../pages/UserProfilePage'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? <>{children}</> : <Navigate to="/" replace />;
};

export const AppRouter = () => {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="show/:id" element={<ShowDetailPage />} />
          <Route path="movie/:id" element={<MovieDetailPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="user/:uid" element={<UserProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
};

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-dark-900">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-dark-400 border-t-brand-500 rounded-full animate-spin" />
      <span className="text-gray-400 text-sm">Carregando...</span>
    </div>
  </div>
);
