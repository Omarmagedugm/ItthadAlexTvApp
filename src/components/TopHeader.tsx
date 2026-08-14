import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Bell, Search, ChevronRight, X, Info, Sun, Moon, Settings } from 'lucide-react';
import { useAppStore } from '../store';
import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { db, auth, requestNotificationPermission } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function TopHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, theme, toggleTheme, appSettings } = useAppStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [imageError, setImageError] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );
  const initialLoadRef = useRef(true);

  const lightLogo = appSettings?.headerLogoLight || appSettings?.appLogo;
  const darkLogo = appSettings?.headerLogoDark || appSettings?.appLogo;
  const currentLogo = theme === 'dark' ? darkLogo : lightLogo;

  useEffect(() => {
    setImageError(false);
  }, [currentLogo]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const timer = setInterval(() => {
        if (Notification.permission !== permission) {
          setPermission(Notification.permission);
        }
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [permission]);

  useEffect(() => {
    if (!profile?.uid) return;
    const q1 = query(collection(db, 'notifications'), where('target', 'in', ['all', profile.uid]));
    
    const unsubscribe = onSnapshot(q1, (snap) => {
      const notifs = snap.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
        .filter(n => !n.deletedBy?.includes(profile.uid));
      notifs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);

      if (!initialLoadRef.current) {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (!data.readBy?.includes(profile.uid)) {
              toast((t) => (
                <div onClick={() => { toast.dismiss(t.id); setShowNotifications(true); }} className="flex flex-col gap-1 cursor-pointer">
                  <div className="font-black text-sm text-primary flex items-center gap-2">
                    <Bell size={16} /> إشعار جديد
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{data.title}</div>
                  <div className="text-[10px] font-bold text-slate-500 line-clamp-1 mt-1">{data.body}</div>
                </div>
              ));
            }
          }
        });
      }
      initialLoadRef.current = false;
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'push_notifications'));
    
    return () => unsubscribe();
  }, [profile?.uid]);

  const hideHeaderPaths = ['/auth'];
  if (hideHeaderPaths.includes(location.pathname) || location.pathname.startsWith('/news/')) return null;

  const isHome = location.pathname === '/';
  
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'قناة الاتحاد السكندري';
    if (path === '/news') return 'مركز الأخبار';
    if (path.startsWith('/news/')) return 'تفاصيل الخبر';
    if (path === '/media' || path === '/library') return 'المكتبة الرقمية والوسائط';
    if (path === '/live') return 'البث المباشر';
    if (path === '/matches') return 'مباريات كرة القدم';
    if (path === '/profile') return 'ملفي الشخصي';
    if (path === '/fan-zone' || path === '/feed') return 'منطقة المشجعين';
    if (path === '/club-members') return 'أعضاء النادي';
    if (path === '/history') return 'تاريخ النادي';
    if (path === '/social' || path === '/social-media' || path === '/facebook') return 'سوشيال ميديا';
    if (path === '/business' || path.startsWith('/business/')) return 'اتحاداوي بيزنس';
    if (path === '/store') return 'متجر النادي';
    if (path === '/bookmarks') return 'المحفوظات';
    if (path === '/admin') return 'لوحة التحكم';
    return 'الاتحاد السكندري';
  };

  const title = getPageTitle();

  const unreadCount = notifications.filter(n => !n.readBy?.includes(profile?.uid)).length;

  const markAsRead = async (id: string, readBy: string[]) => {
    if (!profile?.uid) return;
    if (readBy?.includes(profile.uid)) return;
    
    const newReadBy = [...(readBy || []), profile.uid];
    try {
      await updateDoc(doc(db, 'notifications', id), { readBy: newReadBy });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenNotifications = () => {
    setShowNotifications(true);
  };

  const isOmar = auth.currentUser?.email?.toLowerCase() === 'omarmagedugm@ittihad.club';
  const isDev = auth.currentUser?.email?.toLowerCase() === 'copyrightofficialco@gmail.com';
  const isAdmin = (profile?.role === 'admin' || profile?.role === 'moderator' || (profile?.roles && (profile.roles.includes('admin') || profile.roles.includes('moderator')))) || isOmar || isDev;

  const logoHeight = appSettings?.headerLogoHeight || (
    appSettings?.headerLogoSize === 'small' ? 36 :
    appSettings?.headerLogoSize === 'large' ? 62 :
    appSettings?.headerLogoSize === 'xlarge' ? 78 : 48
  );
  const spacerHeight = Math.max(60, logoHeight + 16);

  return (
    <>
      {/* Added a spacer to prevent content from going under the fixed header */}
      <div style={{ height: `calc(env(safe-area-inset-top) + ${spacerHeight}px)` }} className="w-full"></div>
      <header id="global-header" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }} className="fixed top-0 inset-x-0 w-full z-50 bg-background-light/85 dark:bg-background-dark/85 backdrop-blur-xl border-b border-border-light/40 dark:border-border-dark/40 px-3 sm:px-4 md:px-8 pb-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 w-full max-w-7xl mx-auto">
          {/* Right Section: Mobile Menu / Back + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            {isHome ? (
              <motion.button 
                id="menu-button"
                aria-label="القائمة الرئيسية"
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMenuOpen(true)}
                className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl glass-card text-slate-600 dark:text-slate-300 hover:text-primary transition-all duration-300"
              >
                <Menu size={22} strokeWidth={2.5} />
              </motion.button>
            ) : (
              <motion.button 
                id="back-button"
                aria-label="الرجوع للصفحة السابقة"
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(-1)}
                className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl glass-card text-slate-600 dark:text-slate-300 hover:text-primary transition-all duration-300"
              >
                <ChevronRight size={24} className="rotate-180" />
              </motion.button>
            )}

            <Link to="/" className="flex items-center gap-2 py-0.5 min-w-0 shrink">
              {currentLogo && !imageError ? (
                <img 
                  src={currentLogo} 
                  alt={title} 
                  style={{
                    height: `${logoHeight}px`,
                    maxHeight: '92px'
                  }}
                  className="w-auto max-w-[150px] sm:max-w-[200px] md:max-w-[250px] lg:max-w-[300px] object-contain drop-shadow-md transition-all duration-300 shrink" 
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                />
              ) : (
                <h1 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-primary-dark dark:text-white uppercase truncate max-w-[160px] sm:max-w-[220px]">
                  {appSettings?.logoText || title}
                </h1>
              )}
            </Link>
          </div>

          {/* Desktop Navigation Links (Visible on PC / Tablet) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 flex-wrap">
            {[
              { path: '/', label: 'الرئيسية' },
              { path: '/news', label: 'الأخبار' },
              { path: '/matches', label: 'المباريات' },
              { path: '/fan-zone', label: 'فان زون' },
              { path: '/library', label: 'المكتبة والوسائط' },
              { path: '/world-fans', label: 'اتحاداوية العالم 🌍' },
              { path: '/history', label: 'تاريخ النادي' },
              { path: '/discounts', label: 'دليل الخصومات' },
              { path: '/store', label: 'المتجر' },
            ].map(item => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary text-white shadow-sm shadow-primary/30' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-dark hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Left Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAdmin && location.pathname.includes('/admin') && (
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(-1)}
                aria-label="رجوع للصفحة السابقة"
                className="flex h-10 w-10 items-center justify-center rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-primary transition-all duration-300 shadow-sm"
                title="رجوع للصفحة السابقة"
              >
                <ChevronRight size={22} strokeWidth={2.5} />
              </motion.button>
            )}
            {isAdmin && !location.pathname.includes('/admin') && (
              <Link 
                to={`/admin?tab=${(() => {
                  try {
                    return typeof window !== 'undefined' ? localStorage.getItem('lastAdminTab') || 'overview' : 'overview';
                  } catch (e) { return 'overview'; }
                })()}`}
                aria-label="لوحة التحكم"
                className="flex h-10 w-10 items-center justify-center rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-primary transition-all duration-300 shadow-sm"
                title="لوحة التحكم"
              >
                <Settings size={20} strokeWidth={2.5} />
              </Link>
            )}
            {permission === 'default' && (
              <motion.button 
                whileTap={{ scale: 0.9 }}
                aria-label="تفعيل الإشعارات"
                onClick={() => {
                  requestNotificationPermission().then(() => {
                    if ('Notification' in window) setPermission(Notification.permission);
                  });
                }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 shadow-sm relative group"
                title="تفعيل الإشعارات"
              >
                <Bell size={20} strokeWidth={2.5} className="animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
                <span className="absolute top-12 scale-0 group-hover:scale-100 transition-all rounded bg-slate-800 p-2 text-xs text-white whitespace-nowrap z-[100]">تفعيل الإشعارات</span>
              </motion.button>
            )}
            <motion.button 
              id="theme-toggle-button"
              aria-label="تبديل المظهر"
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-primary transition-all duration-300"
            >
              {theme === 'dark' ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
            </motion.button>
            {isHome ? (
              <motion.button 
                id="notification-button"
                aria-label="الإشعارات"
                whileTap={{ scale: 0.9 }}
                onClick={handleOpenNotifications}
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-primary transition-all duration-300"
              >
                <Bell size={20} strokeWidth={2.5} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 bg-accent rounded-full ring-2 ring-white dark:ring-surface-dark"></span>
                )}
              </motion.button>
            ) : (
              <Link 
                id="search-button-link"
                aria-label="البحث عن الأخبار"
                to="/news"
                className="flex h-10 w-10 items-center justify-center rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-primary transition-all duration-300"
              >
                <Search size={20} strokeWidth={2.5} />
              </Link>
            )}

            {/* User Profile Quick Link on Desktop */}
            <Link
              to="/profile"
              className="hidden md:flex items-center justify-center h-10 w-10 rounded-2xl glass-card text-slate-600 dark:text-slate-300 hover:text-primary transition-all overflow-hidden"
              title="الملف الشخصي"
            >
              {profile?.avatar ? (
                <img src={profile.avatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined !text-[20px]">person</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} profile={profile} />

      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-sm bg-white dark:bg-card-dark rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase leading-none">الإشعارات</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Notifications</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button 
                          onClick={async () => {
                            if (!profile?.uid) return;
                            if (confirm('هل تريد مسح جميع الإشعارات؟')) {
                              try {
                                const batch = notifications.map(n => {
                                  const deletedBy = [...(n.deletedBy || []), profile.uid];
                                  return updateDoc(doc(db, 'notifications', n.id), { deletedBy });
                                });
                                await Promise.all(batch);
                                toast.success('تم مسح الإشعارات');
                              } catch (e) {
                                console.error(e);
                                toast.error('حدث خطأ');
                              }
                            }
                          }}
                          className="text-[9px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase ml-2"
                        >
                          مسح الكل
                        </button>
                      )}
                   {('Notification' in window) && Notification.permission !== 'granted' && Notification.permission !== 'denied' && (
                     <button
                       onClick={() => {
                         requestNotificationPermission();
                       }}
                       className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-all duration-300"
                     >
                       تفعيل الإشعارات
                     </button>
                   )}
                   <button onClick={() => setShowNotifications(false)} className="h-10 w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors">
                     <X size={20} />
                   </button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                 {notifications.length > 0 ? (
                   notifications.map((notif) => {
                     const isRead = notif.readBy?.includes(profile?.uid);
                     return (
                       <div 
                         key={notif.id}
                         onClick={() => markAsRead(notif.id, notif.readBy)}
                         className={`group relative p-4 rounded-2xl border ${!isRead ? 'border-primary/50 bg-primary/5 dark:bg-primary/10' : 'border-border-light dark:border-border-dark bg-slate-50 dark:bg-surface-dark'} flex flex-col gap-2 transition-all cursor-pointer`}
                       >
                         <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${!isRead ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              <Info size={16} />
                            </div>
                            <div className="flex-1">
                               <h4 className={`text-sm font-black ${!isRead ? 'text-primary-dark dark:text-white' : 'text-slate-800 dark:text-slate-300'}`}>{notif.title}</h4>
                            </div>
                            {!isRead && <div className="w-2 h-2 rounded-full bg-accent"></div>}
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (!profile?.uid) return;
                                 const deletedBy = [...(notif.deletedBy || []), profile.uid];
                                 updateDoc(doc(db, 'notifications', notif.id), { deletedBy });
                               }}
                               className="p-1 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                             >
                               <X size={14} />
                             </button>
                         </div>
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed pr-11">{notif.body}</p>
                         <span className="text-[9px] font-bold text-slate-400 pr-11 opacity-60">
                           {new Date(notif.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                         </span>
                       </div>
                     );
                   })
                 ) : (
                   <div className="py-10 text-center text-slate-400 font-bold text-xs flex flex-col items-center gap-3 opacity-60">
                     <Bell size={32} />
                     لا توجد إشعارات حالياً
                   </div>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
