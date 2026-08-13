import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const navItems = [
    { path: '/', icon: 'home', label: 'الرئيسية' },
    { path: '/news', icon: 'newspaper', label: 'الأخبار' },
    { path: '/fan-zone', icon: 'stadium', label: 'فان زون' },
    { path: '/library', icon: 'perm_media', label: 'الوسائط' },
    { path: '/profile', icon: 'person', label: 'ملفي' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 w-full glass-card border-t-0 px-2 pb-6 pt-1">
      <div className="flex items-center justify-around h-14 max-w-md mx-auto">
        {navItems.map((item, idx) => {
          const isActive = path === item.path || (item.path !== '/' && path.startsWith(item.path));
          const isCenter = idx === 2;

          return (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`group relative flex flex-1 flex-col items-center justify-center p-1 transition-all duration-300 ${isActive ? 'text-primary-light' : 'text-slate-400 dark:text-slate-500 hover:text-primary'}`}
            >
              {isCenter ? (
                <div className="relative -mt-12 flex flex-col items-center">
                  <div className={`w-15 h-15 rounded-full flex items-center justify-center transition-all duration-500 shadow-premium glow-active bg-primary text-white scale-110 ring-4 ring-background-light dark:ring-background-dark ${isActive ? 'bg-primary-light rotate-[360deg]' : 'bg-primary'}`}>
                    <span className="material-symbols-outlined !text-[32px] transition-transform duration-500">
                      {item.icon}
                    </span>
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.span 
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.8 }}
                        className="text-[10px] mt-2 font-black text-primary-light uppercase tracking-tighter"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <div className="relative flex h-10 w-12 items-center justify-center rounded-2xl z-10 transition-all duration-300 overflow-hidden">
                     {isActive && (
                       <motion.div 
                         layoutId="nav-bg"
                         className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-2xl"
                         transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                       />
                     )}
                     <span className={`material-symbols-outlined text-[24px] relative z-20 transition-all duration-300 ${isActive ? 'text-primary-light fill-1 scale-110' : ''}`}>
                       {item.icon}
                     </span>
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.span 
                        initial={{ opacity: 0, height: 0, y: 5 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 5 }}
                        className="text-[10px] mt-1 font-black text-primary-light"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
