import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Share2, Bookmark, Heart, ArrowRight, Rss, Edit2 } from 'lucide-react';
import { getOptimizedImage } from '../lib/cloudinary';

export default function NewsDetail() {
  const { id } = useParams();
  const { news, profile } = useAppStore();
  const navigate = useNavigate();
  
  const article = news.find(n => n.id === id);

  if (!article) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-background-light dark:bg-background-dark min-h-screen">
        <h1 className="text-2xl font-black mb-4">الخبر غير موجود</h1>
        <Link to="/news" className="bg-primary text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2">
          <ArrowRight size={20} />
          العودة للأخبار
        </Link>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  } as const;

  return (
    <div className="relative flex-1 flex flex-col bg-background-light dark:bg-background-dark min-h-screen pb-32 overflow-x-hidden">
      {/* Floating Header */}
      <header className="fixed top-0 inset-x-0 w-full max-w-md mx-auto z-50 flex items-center justify-between px-4 h-16 backdrop-blur-xl bg-background-light/80 dark:bg-background-dark/80 border-b border-border-light/40 dark:border-border-dark/40 shadow-sm pt-[env(safe-area-inset-top)]">
        <Link to="/news" className="p-2 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-800 dark:text-white shadow-sm pressable border border-border-light dark:border-border-dark ml-2">
          <ArrowRight size={20} />
        </Link>
        <div className="flex gap-2 mr-2">
           {profile?.role === 'admin' && (
             <button 
               onClick={() => navigate('/admin', { state: { editCategory: 'news', editId: article.id } })}
               className="p-2 rounded-full bg-primary text-white shadow-sm pressable border border-primary/20"
             >
               <Edit2 size={16} />
             </button>
           )}
           <button className="p-2 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-800 dark:text-white shadow-sm pressable border border-border-light dark:border-border-dark">
             <Share2 size={16} />
           </button>
           <button className="p-2 rounded-full bg-slate-100 dark:bg-surface-dark text-slate-800 dark:text-white shadow-sm pressable border border-border-light dark:border-border-dark">
             <Bookmark size={16} />
           </button>
        </div>
      </header>

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-20 px-4 pt-[calc(env(safe-area-inset-top)+72px)]"
      >
        <motion.div variants={itemVariants} className="bg-white dark:bg-card-dark rounded-[32px] overflow-hidden shadow-2xl border border-border-light dark:border-border-dark">
          {/* Full Professional Image Container */}
          <div className="w-full bg-black/5 dark:bg-black/40 relative flex items-center justify-center min-h-[250px] max-h-[50vh]">
            {/* Blurred background for contrast */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110"
              style={{ backgroundImage: `url('${getOptimizedImage(article.image, 50)}')` }}
            />
            {/* Main Full Image */}
            <img 
              src={getOptimizedImage(article.image, 800)} 
              alt={article.title} 
              className="relative z-10 w-full h-full max-h-[50vh] object-contain drop-shadow-2xl" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10"></div>
            
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-white drop-shadow-md">
              <span className="px-3 py-1 bg-primary/90 text-white rounded-lg backdrop-blur-md">{article.category || 'أخبار النادي'}</span>
              <span className="flex items-center gap-1 opacity-90 text-xs">
                {formatDistanceToNow(new Date(article.date), { locale: ar, addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="p-6">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-snug mb-4">{article.title}</h1>
            
            {(article.tagIds && article.tagIds.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-6">
                 {article.tagIds.map(tagId => {
                   const tagObj = useAppStore.getState().newsTags?.find(t => t.id === tagId);
                   if (!tagObj) return null;
                   return (
                     <span key={tagObj.id} className="text-[10px] font-black px-2.5 py-1 rounded-lg text-white shadow-sm" style={{ backgroundColor: tagObj.color }}>
                       {tagObj.name}
                     </span>
                   );
                 })}
              </div>
            )}

            <div className="flex items-center justify-between py-4 border-y border-border-light dark:border-border-dark mb-6">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                   <span className="material-symbols-outlined !text-[16px]">person</span>
                </div>
                <div>
                   <p className="text-xs font-black text-slate-800 dark:text-white">{article.editorName || article.author}</p>
                   <p className="text-[10px] text-slate-500 font-bold">محرر رياضي</p>
                </div>
             </div>
             <div className="flex items-center gap-3 text-slate-400">
                <div className="flex items-center gap-1">
                   <Heart size={14} />
                   <span className="text-[10px] font-bold">124</span>
                </div>
             </div>
          </div>

          <div className="prose dark:prose-invert max-w-none">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed text-justify whitespace-pre-wrap">
              {article.content || 'لا يوجد محتوى متاح لهذا الخبر في الوقت الحالي.'}
            </p>
            {article.type === 'rss' && (
               <div className="mt-8 p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                  <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400">
                     <Rss size={18} />
                     <span className="text-sm font-black">مصدر خارجي</span>
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-4">هذا الخبر تم جلبه عبر خدمة RSS، لمزيد من التفاصيل يمكنك زيارة المصدر الأصلي.</p>
                  <a 
                    href={article.rssUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-orange-700 transition-colors"
                  >
                    عرض المصدر الأصلي
                  </a>
               </div>
            )}
          </div>
          </div>
        </motion.div>

        {/* Similar News or interactions could go here */}
      </motion.main>
    </div>
  );
}
