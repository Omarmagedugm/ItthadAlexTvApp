import React, { useState } from 'react';
import { 
  Radio as RadioIcon, 
  Plus, 
  Edit3, 
  Trash2, 
  Play, 
  Pause, 
  ExternalLink, 
  Tv, 
  Music, 
  Mic, 
  Sparkles, 
  Flame, 
  CheckCircle, 
  Eye, 
  Users, 
  Clock, 
  X, 
  Save, 
  RotateCcw,
  Video,
  RadioTower,
  Link as LinkIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore, RadioStation } from '../../store';
import { DEFAULT_RADIO_STATIONS } from '../../data/defaultRadioData';
import { 
  getYouTubeEmbedUrl, 
  getFacebookEmbedUrl, 
  getYouTubeThumbnail, 
  isYouTubeUrl, 
  isFacebookUrl,
  detectMediaType 
} from '../../lib/videoUtils';
import { db, auth } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { logAdminActivity } from '../../lib/auditLogger';

export default function AdminRadio() {
  const { radioStations, setRadioStations } = useAppStore();
  const stationsList = (radioStations && radioStations.length > 0) ? radioStations : DEFAULT_RADIO_STATIONS;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<RadioStation | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewStation, setPreviewStation] = useState<RadioStation | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<RadioStation>>({
    title: '',
    subtitle: '',
    presenter: '',
    type: 'youtube',
    url: '',
    coverUrl: '',
    isLive: true,
    isActive: true,
    isPrimary: false,
    category: 'live_match',
    frequency: '90.5 FM',
    listenersCount: '1.5K مستمع',
    airTime: 'يومياً 8:00 م',
    description: ''
  });

  const handleOpenAddModal = () => {
    setEditingStation(null);
    setFormData({
      title: '',
      subtitle: '',
      presenter: '',
      type: 'youtube',
      url: '',
      coverUrl: '',
      isLive: true,
      isActive: true,
      isPrimary: false,
      category: 'live_match',
      frequency: '90.5 FM',
      listenersCount: '1.5K مستمع',
      airTime: 'يومياً 8:00 م',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (station: RadioStation) => {
    setEditingStation(station);
    setFormData({ ...station });
    setIsModalOpen(true);
  };

  const handleUrlChange = (url: string) => {
    const detected = detectMediaType(url);
    let autoThumb = formData.coverUrl;

    if (detected === 'youtube' && isYouTubeUrl(url)) {
      const ytThumb = getYouTubeThumbnail(url);
      if (ytThumb && !formData.coverUrl) {
        autoThumb = ytThumb;
      }
    }

    setFormData(prev => ({
      ...prev,
      url,
      type: detected,
      coverUrl: autoThumb
    }));
  };

  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.url?.trim()) {
      toast.error('يرجى كتابة عنوان الإذاعة ورابط البث');
      return;
    }

    const stationId = editingStation?.id || `radio_${Date.now()}`;
    const stationData: RadioStation = {
      id: stationId,
      title: formData.title.trim(),
      subtitle: formData.subtitle?.trim() || '',
      presenter: formData.presenter?.trim() || '',
      type: formData.type || 'youtube',
      url: formData.url.trim(),
      coverUrl: formData.coverUrl?.trim() || (formData.type === 'youtube' ? getYouTubeThumbnail(formData.url) || '' : 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=800'),
      isLive: Boolean(formData.isLive),
      isActive: formData.isActive !== false,
      isPrimary: Boolean(formData.isPrimary),
      category: formData.category || 'live_match',
      frequency: formData.frequency?.trim() || '90.5 FM',
      listenersCount: (formData.listenersCount !== undefined ? String(formData.listenersCount).trim() : '1.2K مستمع'),
      airTime: formData.airTime?.trim() || '',
      description: formData.description?.trim() || '',
      order: editingStation?.order ?? stationsList.length,
      createdAt: editingStation?.createdAt || new Date().toISOString()
    };

    try {
      // If set as primary, unmark others
      if (stationData.isPrimary) {
        const batch = writeBatch(db);
        stationsList.forEach(s => {
          if (s.id !== stationId && s.isPrimary) {
            batch.update(doc(db, 'radio_stations', s.id), { isPrimary: false });
          }
        });
        await batch.commit().catch(() => {});
      }

      await setDoc(doc(db, 'radio_stations', stationId), stationData);

      // Audit log
      await logAdminActivity({
        action: editingStation ? 'update' : 'create',
        collectionName: 'radio_stations',
        collectionLabel: 'محطات وبرامج راديو زعيم الثغر',
        itemId: stationId,
        itemTitle: stationData.title,
        itemThumbnail: stationData.coverUrl,
        itemData: stationData,
        details: editingStation ? `تعديل المحطة: ${stationData.title}` : `إضافة محطة جديدة: ${stationData.title}`
      });

      toast.success(editingStation ? 'تم تحديث بيانات المحطة بنجاح ✅' : 'تمت إضافة المحطة الإذاعية بنجاح 🎙️');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving station:', err);
      toast.error('حدث خطأ أثناء حفظ المحطة');
    }
  };

  const handleDeleteStation = async (station: RadioStation) => {
    if (!window.confirm(`هل أنت متأكد من حذف محطة "${station.title}"؟\nسيتم حفظ نسخة احتياطية في سلة المحذوفات.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'radio_stations', station.id));

      // Audit log with full snapshot for recycle bin restore
      await logAdminActivity({
        action: 'delete',
        collectionName: 'radio_stations',
        collectionLabel: 'محطات وبرامج راديو زعيم الثغر',
        itemId: station.id,
        itemTitle: station.title,
        itemThumbnail: station.coverUrl,
        itemData: station,
        details: `حذف محطة الراديو: ${station.title}`
      });

      toast.success('تم حذف المحطة ونقلها إلى سلة المحذوفات 🗑️');
    } catch (err) {
      console.error('Error deleting station:', err);
      toast.error('فشل حذف المحطة');
    }
  };

  const handleToggleLive = async (station: RadioStation) => {
    try {
      const newStatus = !station.isLive;
      await updateDoc(doc(db, 'radio_stations', station.id), { isLive: newStatus });
      toast.success(newStatus ? 'تم تفعيل حالة البث المباشر 🔴' : 'تم إيقاف حالة البث المباشر');
    } catch (e) {
      toast.error('فشل تحديث حالة البث');
    }
  };

  const handleSetPrimary = async (station: RadioStation) => {
    try {
      const batch = writeBatch(db);
      stationsList.forEach(s => {
        batch.update(doc(db, 'radio_stations', s.id), { isPrimary: s.id === station.id });
      });
      await batch.commit();
      toast.success(`تم تعيين "${station.title}" كبث مباشر رئيسي في واجهة الراديو 🌟`);
    } catch (e) {
      toast.error('فشل تعيين البث الرئيسي');
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('هل تريد استرجاع محطات راديو الاتحاد السكندري الافتراضية وحفظها في قاعدة البيانات؟')) {
      return;
    }

    try {
      const batch = writeBatch(db);
      DEFAULT_RADIO_STATIONS.forEach(station => {
        batch.set(doc(db, 'radio_stations', station.id), station);
      });
      await batch.commit();
      toast.success('تم استرجاع المحطات الافتراضية بنجاح 📻💚');
    } catch (e) {
      toast.error('فشل استرجاع المحطات الافتراضية');
    }
  };

  const filtered = stationsList.filter(s => {
    if (filterType === 'live' && !s.isLive) return false;
    if (filterType === 'youtube' && s.type !== 'youtube') return false;
    if (filterType === 'facebook' && s.type !== 'facebook') return false;
    if (filterType === 'audio' && s.type !== 'audio' && s.type !== 'custom_stream') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.presenter?.toLowerCase().includes(q) || s.url.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Quick Action Buttons */}
      <div className="bg-white dark:bg-card-dark rounded-3xl p-6 shadow-sm border border-border-light dark:border-border-dark flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RadioIcon className="text-primary" size={24} />
            <h2 className="text-xl font-black text-slate-800 dark:text-white">
              إدارة راديو وبث زعيم الثغر 🎙️
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            إضافة وإدارة محطات الإذاعة، روابط فيديو وبث يوتيوب وفيسبوك، والبث الصوتي المباشر.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-surface-dark hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all"
          >
            <RotateCcw size={15} />
            <span>استرجاع الافتراضي</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs shadow-md shadow-primary/20 transition-all hover:scale-105"
          >
            <Plus size={16} />
            <span>إضافة إذاعة / فيديو جديد</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-card-dark rounded-2xl p-4 border border-border-light dark:border-border-dark">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'live', label: '🔴 مباشر الآن' },
            { id: 'youtube', label: 'يوتيوب' },
            { id: 'facebook', label: 'فيسبوك فيديو' },
            { id: 'audio', label: 'بث صوتي مباشر' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث بالاسم أو المذيع أو الرابط..."
          className="px-4 py-2 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-xs text-slate-800 dark:text-white w-full sm:w-64"
        />
      </div>

      {/* Table / Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(station => (
          <div
            key={station.id}
            className="bg-white dark:bg-card-dark rounded-2xl p-4 border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-3">
              {/* Media Thumbnail */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900">
                <img
                  src={station.coverUrl || (station.type === 'youtube' ? getYouTubeThumbnail(station.url) || '' : 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=800')}
                  alt={station.title}
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {station.isLive && (
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black animate-pulse">
                      🔴 مباشر
                    </span>
                  )}
                  {station.isPrimary && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                      🌟 رئيسي
                    </span>
                  )}
                </div>

                <div className="absolute top-2 left-2">
                  <span className="px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                    {station.type === 'youtube' ? 'YouTube' : station.type === 'facebook' ? 'Facebook' : 'Audio Stream'}
                  </span>
                </div>
              </div>

              {/* Title & info */}
              <div className="space-y-1">
                <h3 className="font-black text-sm text-slate-800 dark:text-white line-clamp-1">
                  {station.title}
                </h3>
                {station.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {station.subtitle}
                  </p>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>المذيع: {station.presenter || 'طاقم الإذاعة'}</span>
                  <span>{station.airTime || '24/7'}</span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 truncate bg-slate-50 dark:bg-surface-dark p-1.5 rounded-lg">
                🔗 {station.url}
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="pt-3 border-t border-slate-100 dark:border-border-dark flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleLive(station)}
                  title={station.isLive ? 'إلغاء المباشر' : 'تفعيل المباشر'}
                  className={`p-2 rounded-xl text-xs font-bold transition-all ${
                    station.isLive ? 'bg-red-500/10 text-red-500' : 'bg-slate-100 dark:bg-surface-dark text-slate-400'
                  }`}
                >
                  <Flame size={15} />
                </button>

                <button
                  onClick={() => handleSetPrimary(station)}
                  title="تعيين كبث رئيسي في الواجهة"
                  className={`p-2 rounded-xl text-xs font-bold transition-all ${
                    station.isPrimary ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-100 dark:bg-surface-dark text-slate-400'
                  }`}
                >
                  <Sparkles size={15} />
                </button>

                <button
                  onClick={() => setPreviewStation(station)}
                  title="معاينة وتشغيل"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:text-primary transition-all"
                >
                  <Eye size={15} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEditModal(station)}
                  className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                  title="تعديل"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  onClick={() => handleDeleteStation(station)}
                  className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-card-dark rounded-3xl p-6 max-w-xl w-full border border-border-light dark:border-border-dark shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border-light dark:border-border-dark">
              <div className="flex items-center gap-2">
                <RadioIcon className="text-primary" size={22} />
                <h3 className="font-black text-lg text-slate-800 dark:text-white">
                  {editingStation ? 'تعديل محطة الراديو' : 'إضافة إذاعة / فيديو جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStation} className="space-y-4 text-xs">
              
              {/* Type selector tabs */}
              <div className="space-y-1.5">
                <label className="font-black text-slate-700 dark:text-slate-200">نوع البث / المنصة:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'youtube', label: '🔴 فيديو يوتيوب', desc: 'YouTube Live / Video' },
                    { id: 'facebook', label: '🔵 فيديو فيسبوك', desc: 'Facebook Live / Video' },
                    { id: 'audio', label: '🟢 بث صوتي مباشر', desc: 'MP3 / Audio Stream' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t.id as any })}
                      className={`p-3 rounded-2xl border text-right transition-all ${
                        formData.type === t.id
                          ? 'border-primary bg-primary/5 text-primary font-black shadow-sm'
                          : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[10px] opacity-75">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-black text-slate-700 dark:text-slate-200">عنوان البث / الإذاعة *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="مثال: إذاعة صوت زعيم الثغر"
                    className="w-full p-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-black text-slate-700 dark:text-slate-200">اسم المذيع أو المقدم</label>
                  <input
                    type="text"
                    value={formData.presenter}
                    onChange={(e) => setFormData({ ...formData, presenter: e.target.value })}
                    placeholder="مثال: كابتن أحمد الجمل"
                    className="w-full p-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* URL with Smart Auto Detection */}
              <div className="space-y-1">
                <label className="font-black text-slate-700 dark:text-slate-200">
                  رابط البث أو الفيديو (يوتيوب / فيسبوك / MP3) *
                </label>
                <div className="relative">
                  <LinkIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    required
                    value={formData.url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... أو https://facebook.com/.../videos/..."
                    className="w-full pl-3 pr-9 py-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white font-mono text-[11px]"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  يدعم روابط يوتيوب العادية والمباشرة وروابط فيسبوك فيديو وروابط البث الصوتي المباشر.
                </p>
              </div>

              {/* Cover Image & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-black text-slate-700 dark:text-slate-200">صورة الغلاف / الشعار</label>
                  <input
                    type="url"
                    value={formData.coverUrl}
                    onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-black text-slate-700 dark:text-slate-200">التصنيف</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white"
                  >
                    <option value="live_match">تغطية المباريات</option>
                    <option value="studio">استوديو تحليلي</option>
                    <option value="podcast">بودكاست</option>
                    <option value="chants">أهازيج وأغاني</option>
                    <option value="news">نشرات إخبارية</option>
                    <option value="talkshow">برامج حوارية</option>
                    <option value="general">إذاعة عامة</option>
                  </select>
                </div>
              </div>

              {/* Subtitle & Air Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-black text-slate-700 dark:text-slate-200">موعد البث</label>
                  <input
                    type="text"
                    value={formData.airTime}
                    onChange={(e) => setFormData({ ...formData, airTime: e.target.value })}
                    placeholder="مثال: يومياً 8:00 مساءً"
                    className="w-full p-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-black text-slate-700 dark:text-slate-200">التردد الرمزي / الشارة</label>
                  <input
                    type="text"
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    placeholder="مثال: 90.5 FM أو صوت الشاطبي"
                    className="w-full p-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-black text-slate-700 dark:text-slate-200">وصف البرنامج أو المحطة</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تفصيلي للبرنامج وفقراته..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              {/* Toggles */}
              <div className="p-3 bg-slate-50 dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isLive}
                    onChange={(e) => setFormData({ ...formData, isLive: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    🔴 بث مباشر الآن (Live On Air)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    🌟 البث المباشر الرئيسي (يظهر تلقائياً في مشغل الراديو الرئيسي)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    ✅ تفعيل وظهور في التطبيق
                  </span>
                </label>
              </div>

              {/* Footer buttons */}
              <div className="pt-3 border-t border-border-light dark:border-border-dark flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black shadow-md shadow-primary/20"
                >
                  {editingStation ? 'حفظ التعديلات' : 'إضافة المحطة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {previewStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-950 text-white rounded-3xl p-6 max-w-2xl w-full border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Eye size={18} className="text-primary" />
                معاينة: {previewStation.title}
              </h3>
              <button onClick={() => setPreviewStation(null)} className="p-2 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
              {previewStation.type === 'youtube' && isYouTubeUrl(previewStation.url) && (
                <iframe
                  className="w-full h-full absolute inset-0 border-0"
                  src={getYouTubeEmbedUrl(previewStation.url, true)}
                  title={previewStation.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}

              {previewStation.type === 'facebook' && isFacebookUrl(previewStation.url) && (
                <iframe
                  className="w-full h-full absolute inset-0 border-0"
                  src={getFacebookEmbedUrl(previewStation.url, true)}
                  title={previewStation.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}

              {(previewStation.type === 'audio' || previewStation.type === 'custom_stream') && (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full border-2 border-emerald-500 p-1">
                    <img
                      src={previewStation.coverUrl || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600'}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <h4 className="font-black text-base">{previewStation.title}</h4>
                  <audio controls autoPlay src={previewStation.url} className="w-full max-w-md" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
