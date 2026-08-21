import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import ScrollToTop from './components/ScrollToTop';
import PullToRefresh from './components/PullToRefresh';
import { useAppStore } from './store';
import { useFirestoreSync } from './hooks/useFirestore';
import { auth, requestNotificationPermission } from './lib/firebase';
import { initOneSignal } from './lib/onesignal';
import { preloadImages } from './lib/imageCache';

import Home from './pages/Home';
import MaintenanceScreen from './components/MaintenanceScreen';

function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error: any) {
      console.warn('Failed to load route chunk, attempting recovery:', error);
      const isChunkError = 
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.name === 'TypeError';

      if (isChunkError) {
        const reloadKey = 'chunk_reload_' + window.location.pathname;
        const reloaded = sessionStorage.getItem(reloadKey);
        if (!reloaded) {
          sessionStorage.setItem(reloadKey, 'true');
          if ('caches' in window) {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            } catch (e) {}
          }
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      // Second attempt
      try {
        return await factory();
      } catch (retryErr) {
        throw retryErr;
      }
    }
  });
}

// Lazy loaded page components
const Auth = safeLazy(() => import('./pages/Auth'));
const News = safeLazy(() => import('./pages/News'));
const NewsDetail = safeLazy(() => import('./pages/NewsDetail'));
const Media = safeLazy(() => import('./pages/Media'));
const Live = safeLazy(() => import('./pages/Live'));
const Matches = safeLazy(() => import('./pages/Matches'));
const Profile = safeLazy(() => import('./pages/Profile'));
const Admin = safeLazy(() => import('./pages/Admin'));
const FanZone = safeLazy(() => import('./pages/FanZone'));
const JerseyTryOn = safeLazy(() => import('./pages/JerseyTryOn'));
const History = safeLazy(() => import('./pages/History'));
const Store = safeLazy(() => import('./pages/Store'));
const Bookmarks = safeLazy(() => import('./pages/Bookmarks'));
const Library = safeLazy(() => import('./pages/Library'));
const ClubMembers = safeLazy(() => import('./pages/ClubMembers'));
const DiscountsPage = safeLazy(() => import('./pages/DiscountsPage'));
const DiscountDetailPage = safeLazy(() => import('./pages/DiscountDetailPage'));
const BusinessDirectory = safeLazy(() => import('./pages/BusinessDirectory'));
const BusinessDetail = safeLazy(() => import('./pages/BusinessDetail'));
const WorldFans = safeLazy(() => import('./pages/WorldFans'));
const WorldGroupDetail = safeLazy(() => import('./pages/WorldGroupDetail'));
const CustomPage = safeLazy(() => import('./pages/CustomPage'));
const SocialMedia = safeLazy(() => import('./pages/SocialMedia'));
const PrivacyPolicy = safeLazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = safeLazy(() => import('./pages/TermsOfService'));

// Non-critical interactive components
const MusicPlayer = safeLazy(() => import('./components/MusicPlayer'));
const PWAInstallPrompt = safeLazy(() => import('./components/PWAInstallPrompt'));
const GoalCelebration = safeLazy(() => import('./components/GoalCelebration'));
const WinCelebration = safeLazy(() => import('./components/WinCelebration'));

import BottomNav from './components/BottomNav';
import TopHeader from './components/TopHeader';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

function VercelAnalytics() {
  try {
    return (
      <>
        <SpeedInsights />
        <Analytics />
      </>
    );
  } catch (e) {
    return null;
  }
}

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
      <span className="text-xs font-bold text-slate-400 animate-pulse">جاري التحميل...</span>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("APP CRASH:", error, errorInfo);
    const msg = String(error?.message || '');
    if (msg.includes('Importing a module script failed') || msg.includes('dynamically imported module') || msg.includes('Loading chunk')) {
      const reloadCount = parseInt(sessionStorage.getItem('global_chunk_reload_count') || '0', 10);
      if (reloadCount < 2) {
        sessionStorage.setItem('global_chunk_reload_count', String(reloadCount + 1));
        if ('caches' in window) {
          caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
        }
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#072418',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          direction: 'rtl'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem'
          }}>
            <span style={{ fontSize: '32px' }}>⚽</span>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem' }}>
            عذراً، حدث خطأ أثناء تحميل التطبيق
          </h1>
          <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '1.5rem', maxWidth: '320px' }}>
            {this.state.error?.message || "فشل تحميل بعض عناصر الصفحة."}
          </p>
          <button 
            onClick={this.handleReload}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '1rem',
              fontWeight: 800,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)'
            }}
          >
            إعادة تحميل التطبيق
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainContentWrapper({ children, showGoal, showWin, activeMatch, scoredTeam, handleGoalComplete, setShowWin }: any) {
  const location = useLocation();
  const profile = useAppStore(state => state.profile);
  const appSettings = useAppStore(state => state.appSettings);

  const isOmar = profile.email?.toLowerCase() === 'omarmagedugm@ittihad.club';
  const isDev = profile.email?.toLowerCase() === 'copyrightofficialco@gmail.com';
  const isAdmin = profile.role === 'admin' || (profile.roles && profile.roles.includes('admin')) || profile.role === 'moderator' || isOmar || isDev;

  const isAllowedPath = location.pathname === '/admin' || location.pathname === '/auth';
  const isMaintenanceActive = Boolean(appSettings?.maintenanceEnabled);

  if (isMaintenanceActive && !isAdmin && !isAllowedPath) {
    return <MaintenanceScreen />;
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex flex-col font-display antialiased transition-colors duration-200">
      <TopHeader />
      <Suspense fallback={<PageLoader />}>
        {children}
        <MusicPlayer />
        <PWAInstallPrompt />
        <WinCelebration
          show={showWin}
          onComplete={() => setShowWin(false)}
          match={activeMatch}
        />
        <GoalCelebration 
          show={showGoal} 
          onComplete={handleGoalComplete} 
          teamName={scoredTeam} 
          match={activeMatch}
        />
      </Suspense>
      <AppNav />
    </div>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppContent />
    </GlobalErrorBoundary>
  );
}

function AppContent() {
  useFirestoreSync();
  const matches = useAppStore(state => state.matches);
  const [showGoal, setShowGoal] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [scoredTeam, setScoredTeam] = useState('');
  const [activeMatch, setActiveMatch] = useState<any>(null);
  
  const lastGoalCheck = useRef<Record<string, number>>({});
  const lastMatchStatus = useRef<Record<string, string>>({});
  const isInitialized = useRef(false);

  // Pre-cache key club branding assets for instant offline/online rendering
  useEffect(() => {
    preloadImages([
      '/icon.png',
      'https://res.cloudinary.com/dqj6gzwfg/image/upload/v1777720049/admin_homeLogo/bsxn6a8jxy6yfbyh56df.png',
      'https://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Al_Ahly_SC_logo.svg/1200px-Al_Ahly_SC_logo.svg.png',
      'https://upload.wikimedia.org/wikipedia/en/thumb/0/04/Zamalek_SC_logo.svg/1200px-Zamalek_SC_logo.svg.png'
    ]);
  }, []);

  useEffect(() => {
    // Check for Al-Ittihad goals in live matches
    const ittihadMatches = matches.filter(m => 
      m.status === 'live' && (m.homeTeam.includes('اتحاد') || m.awayTeam.includes('اتحاد'))
    );

    if (!isInitialized.current && ittihadMatches.length > 0) {
      ittihadMatches.forEach(m => {
        const isHome = m.homeTeam.includes('اتحاد');
        lastGoalCheck.current[m.id] = isHome ? parseInt(m.homeScore || "0") : parseInt(m.awayScore || "0");
      });
      isInitialized.current = true;
      return;
    }

    ittihadMatches.forEach(match => {
      const isHome = match.homeTeam.includes('اتحاد');
      const currentScore = isHome ? parseInt(match.homeScore || "0") : parseInt(match.awayScore || "0");
      const prevScore = lastGoalCheck.current[match.id];

      // Only trigger if we already had a record for this match (app was open)
      if (prevScore !== undefined && currentScore > prevScore && match.sport !== 'basketball') {
        setScoredTeam(isHome ? match.homeTeam : match.awayTeam);
        setActiveMatch(match);
        setShowGoal(true);
      }
      
      // Update check state
      if (currentScore !== prevScore) {
        lastGoalCheck.current[match.id] = currentScore;
      }
    });

    // Victory Detection
    matches.forEach(match => {
      const prevStatus = lastMatchStatus.current[match.id];
      if (prevStatus === 'live' && match.status === 'finished') {
        const homeScore = parseInt(match.homeScore || "0");
        const awayScore = parseInt(match.awayScore || "0");
        
        const isIttihadHome = match.homeTeam.includes('اتحاد') || match.homeTeam.includes('Ittihad');
        const isIttihadAway = match.awayTeam.includes('اتحاد') || match.awayTeam.includes('Ittihad');
        
        if ((isIttihadHome && homeScore > awayScore) || (isIttihadAway && awayScore > homeScore)) {
          setActiveMatch(match);
          setShowWin(true);
        }
      }
      if (prevStatus !== match.status) {
        lastMatchStatus.current[match.id] = match.status;
      }
    });
  }, [matches]);

  const handleGoalComplete = () => {
    setShowGoal(false);
  };
  useEffect(() => {
    // Initialize OneSignal Web SDK early for background push notification reception
    initOneSignal();

    // If permission is already granted, refresh the token and update metadata
    if ('Notification' in window && Notification.permission === 'granted') {
      const timer = setTimeout(() => {
        requestNotificationPermission();
      }, 3000); // Refresh subscription metadata in Firestore
      return () => clearTimeout(timer);
    }
  }, []);

  const theme = useAppStore(state => state.theme);
  const setIsAuthReady = useAppStore(state => state.setIsAuthReady);
  const updateProfile = useAppStore(state => state.updateProfile);

  useEffect(() => {
    // We already have testConnection in firebase.ts which logs to console.
    // Let's add a global listener for firebase errors
    const handleFirebaseError = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.code === 'unavailable') {
        toast.error('عذراً، تعذر الاتصال بخادم البيانات. يرجى التحقق من اتصالك بالإنترنت.', {
          id: 'firestore-unavailable',
          duration: 5000
        });
      }
    };
    window.addEventListener('firestore-error', handleFirebaseError);
    return () => window.removeEventListener('firestore-error', handleFirebaseError);
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        // Optimistically set UID in profile so Redirector knows we are logged in
        updateProfile({ uid: user.uid, email: user.email || '' });
      } else {
        updateProfile({ uid: undefined });
      }
      setIsAuthReady(true);
    });
    return unsub;
  }, [setIsAuthReady, updateProfile]);

  useEffect(() => {
    const root = window.document.documentElement;
    const themeColorMeta = document.getElementById('theme-color-meta');
    
    if (theme === 'dark') {
      root.classList.add('dark');
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#072418'); // background-dark
    } else {
      root.classList.remove('dark');
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#F8FAFC'); // background-light
    }
  }, [theme]);

  const handlePullRefresh = async () => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('fs_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('app-pull-refresh'));
    await new Promise(resolve => setTimeout(resolve, 700));
  };

  // Auth Redirection Logic
  return (
    <BrowserRouter>
      <ScrollToTop />
      <NotificationNavigator />
      <AuthRedirector />
      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 4000,
          className: 'bg-white dark:bg-card-dark text-slate-800 dark:text-white font-bold font-display shadow-2xl rounded-2xl border border-border-light dark:border-border-dark',
        }}
      />
      <VercelAnalytics />
      <PullToRefresh onRefresh={handlePullRefresh}>
        <MainContentWrapper
          showGoal={showGoal}
          showWin={showWin}
          activeMatch={activeMatch}
          scoredTeam={scoredTeam}
          handleGoalComplete={handleGoalComplete}
          setShowWin={setShowWin}
        >
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Home />} />
            <Route path="/feed" element={<FanZone />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:id" element={<NewsDetail />} />
            <Route path="/media" element={<Media />} />
            <Route path="/live" element={<Live />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/fan-zone" element={<FanZone />} />
            <Route path="/jersey-tryon" element={<JerseyTryOn />} />
            <Route path="/history" element={<History />} />
            <Route path="/store" element={<Store />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/library" element={<Library />} />
            <Route path="/club-members" element={<ClubMembers />} />
            <Route path="/club-members/discounts" element={<DiscountsPage />} />
            <Route path="/club-members/discounts/:id" element={<DiscountDetailPage />} />
            <Route path="/discounts" element={<DiscountsPage />} />
            <Route path="/discounts/:id" element={<DiscountDetailPage />} />
            <Route path="/business" element={<BusinessDirectory />} />
            <Route path="/business/:id" element={<BusinessDetail />} />
            <Route path="/world-fans" element={<WorldFans />} />
            <Route path="/world-fans/group/:id" element={<WorldGroupDetail />} />
            <Route path="/world-association" element={<WorldFans />} />
            <Route path="/social" element={<SocialMedia />} />
            <Route path="/social-media" element={<SocialMedia />} />
            <Route path="/facebook" element={<SocialMedia />} />
            <Route path="/page/:slug" element={<CustomPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainContentWrapper>
      </PullToRefresh>
    </BrowserRouter>
  );
}

function AuthRedirector() {
  const profile = useAppStore(state => state.profile);
  const isAuthReady = useAppStore(state => state.isAuthReady);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthReady) return;

    // Permissions logic
    const isOmar = profile.email?.toLowerCase() === 'omarmagedugm@ittihad.club';
    const isDev = profile.email?.toLowerCase() === 'copyrightofficialco@gmail.com';
    const isAdmin = profile.role === 'admin' || (profile.roles && profile.roles.includes('admin'));
    const isModerator = profile.role === 'moderator' || (profile.roles && profile.roles.includes('moderator'));
    const hasAdminAccess = isAdmin || isModerator || isOmar || isDev;

    // If logged in and on auth page, go home
    if (profile.uid && location.pathname === '/auth') {
      navigate('/', { replace: true });
    }
    
    // If not logged in and on a protected page like admin or profile, go to auth
    const protectedPaths = ['/admin', '/profile', '/bookmarks', '/store']; 
    if (!profile.uid && protectedPaths.includes(location.pathname)) {
      navigate('/auth', { replace: true });
    }

    // Role-based protection for /admin
    if (profile.uid && location.pathname === '/admin' && !hasAdminAccess) {
      toast.error('عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الصفحة');
      navigate('/', { replace: true });
    }
  }, [profile.uid, profile.role, profile.roles, profile.email, location.pathname, navigate, isAuthReady]);

  return null;
}

function AppNav() {
  const location = useLocation();
  const hideNavPaths = ['/auth'];
  const isSplashOrAuth = hideNavPaths.includes(location.pathname);
  if (isSplashOrAuth) return null;
  return <BottomNav />;
}

function NotificationNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for native push notification clicks forwarded by Service Worker
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
          navigate(event.data.url);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  }, [navigate]);

  return null;
}

