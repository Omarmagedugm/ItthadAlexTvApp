import React, { useState, useMemo } from 'react';
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
  ExternalLink,
  Search,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { WorldGroup } from '../../types/worldFans';

interface WorldGroupsListProps {
  groups: WorldGroup[];
  onOpenFoundLeague: () => void;
}

export const WorldGroupsList: React.FC<WorldGroupsListProps> = ({
  groups,
  onOpenFoundLeague,
}) => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'all' | 'verified' | 'featured'>('all');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState<string>('');

  // Extract unique countries from the registered groups
  const availableCountries = useMemo(() => {
    const map = new Map<string, { id: string; name: string; flag: string }>();
    groups.forEach(g => {
      if (g.countryId && !map.has(g.countryId)) {
        map.set(g.countryId, {
          id: g.countryId,
          name: g.countryName,
          flag: g.countryFlag || '🌍',
        });
      }
    });
    return Array.from(map.values());
  }, [groups]);

  // Apply filters
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (filterType === 'verified' && !g.verified && g.status !== 'official' && g.status !== 'approved') return false;
      if (filterType === 'featured' && !g.featured) return false;
      if (selectedCountryFilter !== 'all' && g.countryId !== selectedCountryFilter) return false;
      if (localSearch.trim()) {
        const query = localSearch.toLowerCase();
        const matchName = g.name.toLowerCase().includes(query);
        const matchCity = g.city.toLowerCase().includes(query);
        const matchCountry = g.countryName.toLowerCase().includes(query);
        if (!matchName && !matchCity && !matchCountry) return false;
      }
      return true;
    });
  }, [groups, filterType, selectedCountryFilter, localSearch]);

  const verifiedCount = groups.filter(g => g.verified || g.status === 'official' || g.status === 'approved').length;

  return (
    <div className="space-y-5">
      {/* Top Controls & Filter Header */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Users size={20} className="text-emerald-600 dark:text-emerald-400" />
              <span>قائمة الروابط المسجلة</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-xl border border-emerald-500/20">
                {filteredGroups.length} رابطة
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              تصفح مجتمعات الروابط الرسمية وانضم إلى جماهير سيد البلد في بلدك أو مدينتك
            </p>
          </div>

          {/* Quick Action */}
          <button
            onClick={onOpenFoundLeague}
            className="self-start sm:self-auto px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Sparkles size={14} />
            <span>طلب تأسيس رابطة جديدة</span>
          </button>
        </div>

        {/* Filters Bar: Search, Verification toggle, Country Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          {/* Local Search Input */}
          <div className="relative flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="ابحث بالاسم، المدينة، أو الدولة..."
              className="w-full pl-3 pr-9 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Filter Type Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap active:scale-95 transition-all ${
                filterType === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              الكل ({groups.length})
            </button>

            <button
              onClick={() => setFilterType('verified')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap active:scale-95 transition-all flex items-center gap-1 ${
                filterType === 'verified'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck size={13} />
              <span>المعتمدة رسمياً ({verifiedCount})</span>
            </button>

            <button
              onClick={() => setFilterType('featured')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap active:scale-95 transition-all flex items-center gap-1 ${
                filterType === 'featured'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Star size={13} fill={filterType === 'featured' ? 'currentColor' : 'none'} />
              <span>المميزة ⭐</span>
            </button>

            {/* Country Selector */}
            {availableCountries.length > 0 && (
              <select
                value={selectedCountryFilter}
                onChange={(e) => setSelectedCountryFilter(e.target.value)}
                className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 focus:outline-none"
              >
                <option value="all">كل الدول 🌍</option>
                {availableCountries.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Groups */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <MapPin size={28} />
          </div>
          <h4 className="text-sm font-black text-slate-800 dark:text-white mb-1">
            لا توجد روابط تطابق البحث أو الفلتر المحدد
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4 font-medium">
            يمكنك مسح الفلتر أو تقديم طلب تأسيس أول رابطة رسمية لجماهير الاتحاد السكندري في هذه المدينة!
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
          {filteredGroups.map((group) => {
            const isOfficial = group.verified || group.status === 'approved' || group.status === 'official';
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
                  <div className="absolute top-0 inset-x-0 h-28 overflow-hidden opacity-60 group-hover:opacity-75 transition-opacity pointer-events-none">
                    <img
                      src={group.coverImage}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-white/50 dark:via-slate-800/60 to-white dark:to-slate-800" />
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
                        title="جروب الواتساب الرسمي"
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
