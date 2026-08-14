import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Users, 
  MapPin, 
  ShieldCheck, 
  Calendar, 
  MessageCircle, 
  Share2, 
  Sparkles, 
  CheckCircle2, 
  Plus, 
  ExternalLink, 
  Image as ImageIcon, 
  Info,
  Heart
} from 'lucide-react';
import { useAppStore } from '../store';
import { WorldFeedTab } from '../components/worldFans/WorldFeedTab';
import { WorldEventsTab } from '../components/worldFans/WorldEventsTab';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export const WorldGroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    worldGroups, 
    setWorldGroups, 
    worldPosts, 
    worldEvents, 
    profile 
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'feed' | 'events' | 'members' | 'gallery' | 'about'>('feed');
  const [hasJoined, setHasJoined] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const group = worldGroups.find((g) => g.id === id);
  const currentUser = auth.currentUser;

  if (!group) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
          <Users size={32} />
        </div>
        <h2 className="text-lg font-black text-slate-800 dark:text-white mb-2">
          الرابطة غير موجودة أو تم نقلها
        </h2>
        <button
          onClick={() => navigate('/world-fans')}
          className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-md"
        >
          العودة لدليل الروابط
        </button>
      </div>
    );
  }

  const groupEvents = worldEvents.filter((e) => e.groupId === group.id);
  const groupPosts = worldPosts.filter((p) => p.groupId === group.id);

  // Handle Join League Toggle
  const handleToggleJoin = async () => {
    setIsJoining(true);
    try {
      const nextJoined = !hasJoined;
      setHasJoined(nextJoined);

      const newMemberCount = nextJoined 
        ? (group.memberCount || 0) + 1 
        : Math.max(0, (group.memberCount || 1) - 1);

      const updated = worldGroups.map(g => g.id === group.id ? { ...g, memberCount: newMemberCount } : g);
      setWorldGroups(updated);

      try {
        await updateDoc(doc(db, 'world_groups', group.id), {
          memberCount: newMemberCount
        });
      } catch (err) {
        console.warn('Group member count local updated:', err);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const isOfficial = group.verified || group.status === 'approved';
  const whatsappUrl = group.whatsappGroupUrl || group.socialLinks?.whatsapp;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-28 pt-2">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back navigation & share */}
        <div className="flex items-center justify-between py-3 mb-2">
          <button
            onClick={() => navigate('/world-fans')}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all"
          >
            <ArrowRight size={18} />
            <span>العودة لكل الروابط</span>
          </button>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: group.name,
                  text: `انضم إلى ${group.name} - رابطة اتحاداوية العالم`,
                  url: window.location.href,
                });
              }
            }}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-emerald-600 active:scale-95 transition-all"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Group Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#063323] via-[#094731] to-[#042116] p-6 text-white shadow-2xl border border-emerald-500/30 mb-6">
          {/* Cover background */}
          {group.coverImage && (
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
              <img
                src={group.coverImage}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#042116] via-[#063323]/80 to-transparent" />
            </div>
          )}

          <div className="relative z-10">
            {/* Top row: Logo, Badges, Name */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={group.logo || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80'}
                    alt={group.name}
                    className="w-20 h-20 rounded-3xl object-cover border-3 border-emerald-400/60 shadow-xl bg-slate-900"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute -bottom-1 -right-1 text-2xl drop-shadow bg-slate-900 rounded-full px-1 border border-slate-700">
                    {group.countryFlag || '🌍'}
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {group.name}
                    </h1>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-emerald-200/90 font-semibold mt-1">
                    <MapPin size={14} className="text-amber-400" />
                    <span>{group.city}، {group.countryName}</span>
                    {group.foundedYear && (
                      <>
                        <span>•</span>
                        <span>تأسست {group.foundedYear}</span>
                      </>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {isOfficial ? (
                      <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md">
                        <ShieldCheck size={13} />
                        <span>رابطة رسمية معتمدة</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-200 border border-white/10">
                        مجتمع جماهيري
                      </span>
                    )}

                    {group.adminName && (
                      <span className="text-[10px] text-emerald-200/80 font-medium">
                        المشرف: {group.adminName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Join & WhatsApp */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleToggleJoin}
                  disabled={isJoining}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all ${
                    hasJoined
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white'
                  }`}
                >
                  <CheckCircle2 size={15} />
                  <span>{hasJoined ? 'أنت عضو في الرابطة ✓' : 'انضم للرابطة'}</span>
                </button>

                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0"
                    title="جروب الواتساب الرسمي للرابطة"
                  >
                    <MessageCircle size={16} />
                    <span className="hidden sm:inline">جروب الواتساب</span>
                  </a>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 text-center">
              <div>
                <div className="text-base font-black text-white">{group.memberCount || 0}</div>
                <div className="text-[10px] text-emerald-200/70 font-semibold">عضو مسجل</div>
              </div>
              <div className="border-x border-white/10">
                <div className="text-base font-black text-amber-300">{groupEvents.length}</div>
                <div className="text-[10px] text-emerald-200/70 font-semibold">تجمع وفعالية</div>
              </div>
              <div>
                <div className="text-base font-black text-emerald-300">{groupPosts.length}</div>
                <div className="text-[10px] text-emerald-200/70 font-semibold">منشور وتفاعل</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex gap-1 p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto no-scrollbar shadow-sm">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 ${
              activeTab === 'feed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            📜 حائط الرابطة ({groupPosts.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 ${
              activeTab === 'events'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            ☕ تجمعاتنا ({groupEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 ${
              activeTab === 'about'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            ℹ️ عن الرابطة
          </button>
        </div>

        {/* Sub-tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'feed' && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <WorldFeedTab
                posts={groupPosts}
                groups={worldGroups}
                selectedGroupId={group.id}
              />
            </motion.div>
          )}

          {activeTab === 'events' && (
            <motion.div
              key="events"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <WorldEventsTab
                events={groupEvents}
                groups={worldGroups}
                selectedGroupId={group.id}
              />
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Info size={18} className="text-emerald-600" />
                  <span>نبذة عن الرابطة وتاريخ تأسيسها</span>
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line">
                  {group.description || 'رابطة رسمية تجمع مشجعي نادي الاتحاد السكندري المغتربين في الخارج لتشجيع ومساندة النادي وتنظيم التجمعات لمشاهدة المباريات وتقديم المساعدة لأبناء الإسكندرية الجدد.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">المدينة والدولة</span>
                    <span className="text-xs font-black text-slate-800 dark:text-white">{group.city}، {group.countryName} {group.countryFlag}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">سنة التأسيس</span>
                    <span className="text-xs font-black text-slate-800 dark:text-white">{group.foundedYear || 2023}</span>
                  </div>

                  {group.adminName && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">مسؤول وممثل الرابطة</span>
                      <span className="text-xs font-black text-slate-800 dark:text-white">{group.adminName}</span>
                    </div>
                  )}

                  {whatsappUrl && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">التواصل الرسمي</span>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <span>مجموعة الواتساب المعتمدة</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WorldGroupDetail;

