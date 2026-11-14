import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { initNative } from '@/lib/nativeInit';
import { InboxProvider } from '@/providers/InboxProvider';
import { CallProvider } from '@/providers/CallProvider';
import { NotificationsProvider } from '@/providers/NotificationsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { ScreenLoader } from '@/components/ScreenLoader';
import { NetworkBanner } from '@/components/NetworkBanner';
import { isSupabaseConfigured } from '@/lib/supabase';
import HomeScreen from '@/features/home/HomeScreen';
import { ROOTS } from '@/components/nav';

// Everything except the home dashboard is code-split.
const CameraScreen = lazy(() => import('@/features/camera/CameraScreen'));
const SignInPage = lazy(() => import('@/features/auth/SignInPage'));
const SignUpPage = lazy(() => import('@/features/auth/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const ProfileScreen = lazy(() => import('@/features/profile/ProfileScreen'));
const EditProfileScreen = lazy(() => import('@/features/profile/EditProfileScreen'));
const SettingsScreen = lazy(() => import('@/features/settings/SettingsScreen'));
const ChatListScreen = lazy(() => import('@/features/chat/ChatListScreen'));
const ChatThreadScreen = lazy(() => import('@/features/chat/ChatThreadScreen'));
const ChatInfoScreen = lazy(() => import('@/features/chat/ChatInfoScreen'));
const FriendsScreen = lazy(() => import('@/features/friends/FriendsScreen'));
const CallsScreen = lazy(() => import('@/features/calls/CallsScreen'));
const NotificationsScreen = lazy(() => import('@/features/notifications/NotificationsScreen'));
const AvatarStudio = lazy(() => import('@/features/avatar/AvatarStudio'));
const DuoStudio = lazy(() => import('@/features/avatar/DuoStudio'));
const StoriesScreen = lazy(() => import('@/features/stories/StoriesScreen'));
const StoryArchiveScreen = lazy(() => import('@/features/stories/StoryArchiveScreen'));
const MapScreen = lazy(() => import('@/features/map/MapScreen'));
const SpotlightScreen = lazy(() => import('@/features/spotlight/SpotlightScreen'));
const MemoriesScreen = lazy(() => import('@/features/memories/MemoriesScreen'));
const PersonScreen = lazy(() => import('@/features/people/PersonScreen'));

/** Hooks the native shell (status bar, splash, Android back button) into routing. */
function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = useRef(location.pathname);
  path.current = location.pathname;
  useEffect(() => {
    void initNative(() => {
      const p = path.current;
      if (p === '/' || p === '/auth/sign-in') return false;
      if (ROOTS.includes(p)) navigate('/');
      else if (/^\/chat\/[^/]+$/.test(p)) navigate('/chat');
      else navigate(-1);
      return true;
    });
  }, [navigate]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, recovering } = useAuth();
  const location = useLocation();
  if (loading) return <ScreenLoader />;
  if (!session) return <Navigate to="/auth/sign-in" replace state={{ from: location }} />;
  if (recovering) return <Navigate to="/auth/reset" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <ScreenLoader />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm text-ink-mute">
        Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.
      </div>
    );
  }
  return (
    <>
      <NativeBridge />
      <NetworkBanner />
      <Suspense fallback={<ScreenLoader />}>
        <Routes>
          <Route path="/auth/sign-in" element={<GuestOnly><SignInPage /></GuestOnly>} />
          <Route path="/auth/sign-up" element={<GuestOnly><SignUpPage /></GuestOnly>} />
          <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth><InboxProvider><NotificationsProvider><CallProvider><AppShell /></CallProvider></NotificationsProvider></InboxProvider></RequireAuth>}>
            <Route index element={<HomeScreen />} />
            <Route path="camera" element={<CameraScreen />} />
            <Route path="chat" element={<ChatListScreen />} />
            <Route path="chat/:id" element={<ChatThreadScreen />} />
            <Route path="chat/:id/info" element={<ChatInfoScreen />} />
            <Route path="friends" element={<FriendsScreen />} />
            <Route path="calls" element={<CallsScreen />} />
            <Route path="notifications" element={<NotificationsScreen />} />
            <Route path="avatar" element={<AvatarStudio />} />
            <Route path="avatar/duo" element={<DuoStudio />} />
            <Route path="stories" element={<StoriesScreen />} />
            <Route path="stories/archive" element={<StoryArchiveScreen />} />
            <Route path="u/:username" element={<PersonScreen />} />
            <Route path="map" element={<MapScreen />} />
            <Route path="spotlight" element={<SpotlightScreen />} />
            <Route path="memories" element={<MemoriesScreen />} />
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="profile/edit" element={<EditProfileScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
