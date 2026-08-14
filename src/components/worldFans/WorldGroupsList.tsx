import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  MapPin, 
  ShieldCheck, 
  Sparkles, 
  Calendar, 
  MessageCircle, 
  ChevronLeft, 
  ArrowLeft, 
  Star,
  ExternalLink
} from 'lucide-react';
import { WorldGroup } from '../../types/worldFans';

interface WorldGroupsListProps {
  groups: WorldGroup[];
  selectedCountryName?: string | null;
  onOpenFoundLeague: () => void;
}

export const WorldGroupsList: React.FC<WorldGroupsListProps> = ({
  groups,
  selectedCountryName,
  onOpenFoundLeague,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
            <span>قائمة الروابط المسجلة</span>
            {selectedCountryName && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                في {selectedCountryName}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            تصفح مجتمعات الروابط الرسمية وانضم إلى جماهير سيد البلد في بلدك
          </p>
        </div>

        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-500/20">
          {groups.length} رابطة متاحة
        </span>
      </div>

      {/* Grid of Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <MapPin size={28} />
          </div>
          <h4 className="text-sm font-black text-slate-800 dark:text-white mb-1">
            لا توجد روابط مسجلة بعد في هذا النطاق
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4 font-medium">
            كن أنت أول من يؤسس رابطة رسمية لجماهير الاتحاد السكندري في هذه الدولة أو المدينة!
          </p>
          <button
            onClick={onOpenFoundLeague}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-xs font-black shadow-md hover:from-emerald-500 hover:to-emerald-600 active:scale-95 transition-all inline-flex items-center gap-2"
          >
            <Sparkles size={16} />
            <span>تقديم طلب تأسيس الرابطة</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const isOfficial = group.verified || group.status === 'approved';
            const whatsappUrl = group.whatsappGroupUrl || group.socialLinks?.whatsapp;

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 p-4 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                {/* Cover Backdrop if available */}
                {group.coverImage && (
                  <div className="absolute top-0 inset-x-0 h-20 overflow-hidden opacity-25 group-hover:opacity-35 transition-opacity pointer-events-none">
                    <img
                      src={group.coverImage}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-slate-800" />
                  </div>
                )}

                {/* Top Row: Logo, Badges, Name */}
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="relative">
                      <img
                        src={group.logo || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80'}
                        alt={group.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-md bg-slate-100 dark:bg-slate-700"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute -bottom-1 -right-1 text-base drop-shadow bg-white dark:bg-slate-900 rounded-full px-0.5 border border-slate-100 dark:border-slate-800">
                        {group.countryFlag || '🌍'}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isOfficial ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm">
                          <ShieldCheck size={12} />
                          <span>رابطة رسمية معتمدة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          مجتمع جماهيري
                        </span>
                      )}

                      {group.foundedYear && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          تأسست عام {group.foundedYear}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name and Location */}
                  <h4 
                    onClick={() => navigate(`/world-fans/group/${group.id}`)}
                    className="text-sm font-black text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer line-clamp-1"
                  >
                    {group.name}
                  </h4>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                    <MapPin size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="line-clamp-1">
                      {group.city}، {group.countryName}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-2 leading-relaxed font-medium">
                    {group.description || 'مجتمع يجمع محبي وعشاق نادي الاتحاد السكندري لتنظيم التجمعات ومشاهدة المباريات والتواصل.'}
                  </p>
                </div>

                {/* Metrics and Action Buttons */}
                <div className="relative z-10 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                  <div className="grid grid-cols-3 gap-1 mb-3 text-center">
                    <div className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                      <div className="text-xs font-black text-slate-800 dark:text-white">
                        {group.memberCount || 0}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold">عضو</div>
                    </div>
                    <div className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {group.eventsCount || 0}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold">فعالية</div>
                    </div>
                    <div className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                      <div className="text-xs font-black text-amber-500">
                        {group.galleryCount || 0}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold">صورة</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/world-fans/group/${group.id}`)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <span>دخول صفحة الرابطة</span>
                      <ArrowLeft size={14} />
                    </button>

                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 active:scale-95 transition-all flex items-center justify-center shrink-0"
                        title="قروب الواتساب الرسمي"
                      >
                        <MessageCircle size={16} />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Found a League Bottom Callout */}
      <div className="mt-8 p-5 rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30">
        <div className="flex items-center gap-3.5 text-center sm:text-right">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
            <Sparkles size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">
              لم تجد رابطة في مدينتك؟
            </h4>
            <p className="text-xs text-emerald-100/80 font-medium mt-0.5">
              يمكنك قيادة جمهور سيد البلد وتأسيس رابطة رسمية معتمدة في دولتك أو مدينتك الآن.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenFoundLeague}
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black shadow-lg active:scale-95 transition-all shrink-0"
        >
          تقديم طلب تأسيس رابطة
        </button>
      </div>
    </div>
  );
};
