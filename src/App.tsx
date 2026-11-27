import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { initNative } from '@/lib/nativeInit';
import { startContactAutoSync } from '@/lib/contacts';
import { liveShare } from '@/lib/chat/extras';
import { InboxProvider } from '@/providers/InboxProvider';
import { CallProvider } from '@/providers/CallProvider';
import { NotificationsProvider } from '@/providers/NotificationsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { AppShell } from '@/components/AppShell';
import { ScreenLoader } from '@/components/ScreenLoader';
import { NetworkBanner } from '@/components/NetworkBanner';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ROOTS } from '@/components/nav';
import { AppLockGate } from '@/components/AppLockGate';
import { DeviceGate } from '@/components/DeviceGate';
import { screenProtection } from '@/lib/privacy';

// Every screen is code-split.
const CameraScreen = lazy(() => import('@/features/camera/CameraScreen'));
const WelcomePage = lazy(() => import('@/features/auth/WelcomePage'));
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
const BirthdaysScreen = lazy(() => import('@/features/friends/BirthdaysScreen'));
const ProfileCodeScreen = lazy(() => import('@/features/profile/ProfileCodeScreen'));
const AccountsScreen = lazy(() => import('@/features/auth/AccountsScreen'));
const AvatarOnboardingScreen = lazy(() => import('@/features/avatar/AvatarOnboardingScreen'));
const SelfieAvatarScreen = lazy(() => import('@/features/avatar/selfie/SelfieAvatarScreen'));
const AvatarHomeScreen = lazy(() => import('@/features/avatar/AvatarHomeScreen'));
const TwoStepPage = lazy(() => import('@/features/auth/TwoStepPage'));
const TrophiesScreen = lazy(() => import('@/features/profile/TrophiesScreen'));
const SharedAlbumsScreen = lazy(() => import('@/features/reels/SharedAlbumsScreen'));
const AvatarCamScreen = lazy(() => import('@/features/avatar/AvatarCamScreen'));
const ProfilePhotoScreen = lazy(() => import('@/features/profile/ProfilePhotoScreen'));
const RecapScreen = lazy(() => import('@/features/social/RecapScreen'));
const QuizzesScreen = lazy(() => import('@/features/social/QuizScreens').then((m) => ({ default: m.QuizzesScreen })));
const QuizNewScreen = lazy(() => import('@/features/social/QuizScreens').then((m) => ({ default: m.QuizNewScreen })));
const QuizScreen = lazy(() => import('@/features/social/QuizScreens').then((m) => ({ default: m.QuizScreen })));

/** Runs work when the browser is idle (or after a short delay); returns a cancel function. */
function whenIdle(fn: () => void, minDelay = 0): () => void {
  let id: number | undefined;
  const t = setTimeout(() => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) id = ric(fn, { timeout: 3000 });
    else fn();
  }, minDelay);
  return () => {
    clearTimeout(t);
    if (id !== undefined) (window as Window & { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback?.(id);
  };
}

/** Hooks the native shell (status bar, splash, Android back button) into routing. */
function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = useRef(location.pathname);
  path.current = location.pathname;
  useEffect(() => {
    void initNative(() => {
      const p = path.current;
      if (p === '/' || p === '/auth/welcome') return false;
      if (ROOTS.includes(p)) navigate('/');
      else if (/^\/chat\/[^/]+$/.test(p)) navigate('/chat');
      else navigate(-1);
      return true;
    });
  }, [navigate]);
  useEffect(() => screenProtection.init(), []);
  // Contacts (when the person turned it on): re-match on start and every return to the app.
  const { session } = useAuth();
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    // Faster start: background work waits until the first screen is up.
    let stop: (() => void) | undefined;
    const c = whenIdle(() => (stop = startContactAutoSync(uid)));
    return () => {
      c();
      stop?.();
    };
  }, [uid]);
  // Warm the other tabs in idle time so switching feels instant.
  useEffect(() => {
    if (!uid) return;
    return whenIdle(() => {
      void import('@/features/chat/ChatListScreen');
      void import('@/features/stories/StoriesScreen');
      void import('@/features/map/MapScreen');
    }, 2500);
  }, [uid]);
  // Live locations shared in chats keep following me while the app is open.
  useEffect(() => {
    if (uid) liveShare.resume(uid);
  }, [uid]);
  // Trip mode (Map → My map): saves the route about once a minute while the app is open.
  useEffect(() => {
    if (!uid) return;
    let stop: (() => void) | undefined;
    void import('@/lib/map/extras').then((m) => (stop = m.startTripRecorder()));
    return () => stop?.();
  }, [uid]);
  // Publish this device's secret-chat key (end-to-end encryption) once.
  useEffect(() => {
    if (uid) return whenIdle(() => void import('@/lib/e2e').then((m) => m.ensureMyKey(uid)).catch(() => undefined));
  }, [uid]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, recovering, mfaPending } = useAuth();
  const location = useLocation();
  if (loading) return <ScreenLoader />;
  if (!session) return <Navigate to="/auth/welcome" replace state={{ from: location }} />;
  if (recovering) return <Navigate to="/auth/reset" replace />;
  if (mfaPending) return <Navigate to="/auth/two-step" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading, mfaPending } = useAuth();
  if (loading) return <ScreenLoader />;
  if (session && mfaPending) return <Navigate to="/auth/two-step" replace />;
  if (session) {
    // After sign-up / log-in: the avatar step (it forwards to the camera when an avatar exists or was skipped).
    let next = '/onboarding/avatar';
    try {
      next = sessionStorage.getItem('snv-after-auth') || '/onboarding/avatar';
    } catch {
      /* storage blocked */
    }
    return <Navigate to={next} replace />;
  }
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
      <DeviceGate />
      <AppLockGate />
      <NetworkBanner />
      <Suspense fallback={<ScreenLoader />}>
        <Routes>
          <Route path="/auth/welcome" element={<GuestOnly><WelcomePage /></GuestOnly>} />
          <Route path="/auth/sign-in" element={<GuestOnly><SignInPage /></GuestOnly>} />
          <Route path="/auth/sign-up" element={<GuestOnly><SignUpPage /></GuestOnly>} />
          <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
          <Route path="/accounts" element={<AccountsScreen />} />
          <Route path="/onboarding/avatar" element={<AvatarOnboardingScreen />} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route path="/auth/two-step" element={<TwoStepPage />} />
          <Route element={<RequireAuth><InboxProvider><NotificationsProvider><CallProvider><AppShell /></CallProvider></NotificationsProvider></InboxProvider></RequireAuth>}>
            <Route index element={<CameraScreen />} />
            <Route path="camera" element={<Navigate to="/" replace />} />
            <Route path="chat" element={<ChatListScreen />} />
            <Route path="chat/:id" element={<ChatThreadScreen />} />
            <Route path="chat/:id/info" element={<ChatInfoScreen />} />
            <Route path="friends" element={<FriendsScreen />} />
            <Route path="birthdays" element={<BirthdaysScreen />} />
            <Route path="trophies" element={<TrophiesScreen />} />
            <Route path="albums" element={<SharedAlbumsScreen />} />
            <Route path="albums/:id" element={<SharedAlbumsScreen />} />
            <Route path="avatar/cam" element={<AvatarCamScreen />} />
            <Route path="calls" element={<CallsScreen />} />
            <Route path="notifications" element={<NotificationsScreen />} />
            <Route path="avatar" element={<AvatarStudio />} />
            <Route path="avatar/duo" element={<DuoStudio />} />
            <Route path="avatar/home" element={<AvatarHomeScreen />} />
            <Route path="avatar/selfie" element={<SelfieAvatarScreen />} />
            <Route path="stories" element={<StoriesScreen />} />
            <Route path="stories/archive" element={<StoryArchiveScreen />} />
            <Route path="u/:username" element={<PersonScreen />} />
            <Route path="map" element={<MapScreen />} />
            <Route path="spotlight" element={<SpotlightScreen />} />
            <Route path="memories" element={<MemoriesScreen />} />
            <Route path="profile" element={<ProfileScreen />} />
            <Route path="profile/edit" element={<EditProfileScreen />} />
            <Route path="profile/photo" element={<ProfilePhotoScreen />} />
            <Route path="profile/code" element={<ProfileCodeScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="recap" element={<RecapScreen />} />
            <Route path="quizzes" element={<QuizzesScreen />} />
            <Route path="quiz/new" element={<QuizNewScreen />} />
            <Route path="quiz/:id" element={<QuizScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
