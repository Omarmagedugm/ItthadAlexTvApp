export interface RadioStation {
  id: string;
  title: string;
  subtitle?: string;
  presenter?: string;
  type: 'youtube' | 'facebook' | 'audio' | 'custom_stream';
  url: string;
  coverUrl?: string;
  isLive?: boolean;
  isActive: boolean;
  isPrimary?: boolean;
  category?: 'live_match' | 'talkshow' | 'podcast' | 'chants' | 'news' | 'studio' | 'general';
  frequency?: string;
  listenersCount?: string | number;
  airTime?: string;
  description?: string;
  order?: number;
  createdAt: string;
}

export const DEFAULT_RADIO_STATIONS: RadioStation[] = [
  {
    id: 'radio_main_live',
    title: 'إذاعة صوت زعيم الثغر - البث الحي المباشر 🎙️💚',
    subtitle: 'البث الإذاعي الرسمي لنادي الاتحاد السكندري على مدار 24 ساعة',
    presenter: 'نخبة من الإعلاميين ونجوم القلعة الخضراء',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    coverUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000&auto=format&fit=crop',
    isLive: true,
    isActive: true,
    isPrimary: true,
    category: 'live_match',
    frequency: '90.5 FM الأخضر',
    listenersCount: '4.8K مستمع الآن',
    airTime: 'بث مباشر متواصل 24/7',
    description: 'إذاعة زعيم الثغر تنقل لكم كل كواليس تدريبات سيد البلد، التغطيات الحصرية للمباريات، واللقاءات الخاصة مع اللاعبين ومجلس الإدارة والجماهير.',
    order: 0,
    createdAt: new Date('2024-01-01').toISOString()
  },
  {
    id: 'radio_fb_studio',
    title: 'الاستوديو التحليلي لمباريات سيد البلد (فيديو فيسبوك) ⚽📺',
    subtitle: 'تحليل فني وتكتيكي شامل لأداء الأخضر مع كبار المحللين',
    presenter: 'كابتن أحمد الجمل ومحللي القناة',
    type: 'facebook',
    url: 'https://www.facebook.com/facebook/videos/10153231379946729/',
    coverUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1000&auto=format&fit=crop',
    isLive: true,
    isActive: true,
    isPrimary: false,
    category: 'studio',
    frequency: 'صوت الإسكندرية',
    listenersCount: '2.3K مشاهد',
    airTime: 'قبل وبعد كل مباراة بساعة',
    description: 'استوديو تحليلي مباشر بتقنية الفيديو عبر فيسبوك ويوتيوب، لمناقشة التشكيل وخطط اللعب وتحليل قرارات التحكيم والفرص الضائعة.',
    order: 1,
    createdAt: new Date('2024-01-02').toISOString()
  },
  {
    id: 'radio_podcast_kings',
    title: 'بودكاست ملوك الشاطبي وسحر الإسكندرية 🏀🎙️',
    subtitle: 'حكايات بطولات عمالقة السلة وأسرار غرفة الملابس',
    presenter: 'أساطير كرة السلة بالاتحاد',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    coverUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1000&auto=format&fit=crop',
    isLive: false,
    isActive: true,
    isPrimary: false,
    category: 'podcast',
    frequency: 'بودكاست أسبوعي',
    listenersCount: '15.2K استماع',
    airTime: 'كل يوم خميس 9:00 م',
    description: 'حلقات أسبوعية تتناول ذكريات التتويج بدوري السوبر والبطولات العربية والإفريقية لكرة السلة مع أبطال اللعبة التاريخيين.',
    order: 2,
    createdAt: new Date('2024-01-03').toISOString()
  },
  {
    id: 'radio_chants_archive',
    title: 'مدرج الشاطبي - أهازيج وهتافات الجماهير الخضراء 📣🎵',
    subtitle: 'باقة من أجمل أغاني وتيفوهات مشجعي الاتحاد السكندري',
    presenter: 'صوت الجماهير الاتحاداوية',
    type: 'audio',
    url: 'https://actions.google.com/sounds/v1/sports/football_crowd_cheer.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1000&auto=format&fit=crop',
    isLive: false,
    isActive: true,
    isPrimary: false,
    category: 'chants',
    frequency: 'أهازيج خضراء',
    listenersCount: '31.5K استماع',
    airTime: 'متاح على مدار الساعة',
    description: 'أرشيف صوتي متجدد يضم كافة أناشيد النادي، هتافات المدرجات الحماسية، ومقطوعات العشق السكندري لزعيم الثغر.',
    order: 3,
    createdAt: new Date('2024-01-04').toISOString()
  },
  {
    id: 'radio_news_flash',
    title: 'نشرة أخبار الاتحاد السكندري الموجزة ⚡📻',
    subtitle: 'أحدث الأخبار والصفقات والبيانات الرسمية لحظة بلحظة',
    presenter: 'غرفة الأخبار والمركز الإعلامي',
    type: 'audio',
    url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
    coverUrl: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1000&auto=format&fit=crop',
    isLive: false,
    isActive: true,
    isPrimary: false,
    category: 'news',
    frequency: 'نشرة الأخبار',
    listenersCount: '8.1K استماع',
    airTime: 'تحديث كل ساعتين',
    description: 'موجز إخباري سريع يحيطكم علماً بآخر القرارات الرسمية وجداول التدريبات ومستجدات الفريق الأول وكافة الألعاب الرياضية.',
    order: 4,
    createdAt: new Date('2024-01-05').toISOString()
  }
];
