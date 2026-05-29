import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import OnboardingPage from "./pages/OnboardingPage";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import LibraryPage from "./pages/LibraryPage";
import PlaylistPage from "./pages/PlaylistPage";
import ProfilePage from "./pages/ProfilePage";
import ArtistPage from "./pages/ArtistPage";
import DownloadsPage from "./pages/DownloadsPage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />

      {/* Email verification — public (no auth needed, token in URL) */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Onboarding — shown after email verification, inside auth but outside AppLayout */}
      <Route
        path="/onboarding"
        element={
          <PrivateRoute>
            <OnboardingPage />
          </PrivateRoute>
        }
      />

      {/* Main app (with sidebar + player bar) */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="search"          element={<SearchPage />} />
        <Route path="library"         element={<LibraryPage />} />
        <Route path="playlist/:id"    element={<PlaylistPage />} />
        <Route path="profile"         element={<ProfilePage />} />
        <Route path="artist/:name"    element={<ArtistPage />} />
        <Route path="downloads"       element={<DownloadsPage />} />
      </Route>
    </Routes>
  );
}
