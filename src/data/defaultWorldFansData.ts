import { WorldCountry, WorldGroup, WorldPost, WorldEvent, WorldHelpRequest } from '../types/worldFans';

export const defaultWorldCountries: WorldCountry[] = [
  {
    id: 'ae',
    code: 'AE',
    name: 'الإمارات العربية المتحدة',
    nameAr: 'الإمارات العربية المتحدة',
    flag: '🇦🇪',
    region: 'gulf',
    fanCount: 1240,
    groupsCount: 2,
    cities: ['دبي', 'أبوظبي', 'الشارقة', 'عجمان'],
    active: true,
    order: 1,
    coverImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop',
    description: 'تجمع جماهير زعيم الثغر في كافة إمارات الدولة، وحضور المباريات والمناسبات الرياضية.'
  },
  {
    id: 'sa',
    code: 'SA',
    name: 'المملكة العربية السعودية',
    nameAr: 'المملكة العربية السعودية',
    flag: '🇸🇦',
    region: 'gulf',
    fanCount: 980,
    groupsCount: 2,
    cities: ['الرياض', 'جدة', 'الدمام', 'الخبر'],
    active: true,
    order: 2,
    coverImage: 'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?q=80&w=1200&auto=format&fit=crop',
    description: 'رابطة مشجعي الاتحاد السكندري بالمملكة العربية السعودية في الرياض والمنطقة الشرقية والغربية.'
  },
  {
    id: 'kw',
    code: 'KW',
    name: 'الكويت',
    nameAr: 'الكويت',
    flag: '🇰🇼',
    region: 'gulf',
    fanCount: 620,
    groupsCount: 1,
    cities: ['الكويت العاصمة', 'حولي', 'السالمية', 'الفروانية'],
    active: true,
    order: 3,
    coverImage: 'https://images.unsplash.com/photo-1578895210405-907db486c111?q=80&w=1200&auto=format&fit=crop',
    description: 'من أقدم روابط الاتحاداوية بالخليج العربي وأكثرها نشاطاً وتفاعلاً في التجمعات والبطولات.'
  },
  {
    id: 'gb',
    code: 'GB',
    name: 'المملكة المتحدة',
    nameAr: 'المملكة المتحدة',
    flag: '🇬🇧',
    region: 'europe',
    fanCount: 410,
    groupsCount: 1,
    cities: ['لندن', 'مانشستر', 'برمنجهام', 'ليفربول'],
    active: true,
    order: 4,
    coverImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
    description: 'رابطة مشجعي سيد البلد في بريطانيا وعاصمة الضباب لندن، تجمعات لمشاهدة الدوري والسلة.'
  },
  {
    id: 'us',
    code: 'US',
    name: 'الولايات المتحدة الأمريكية',
    nameAr: 'الولايات المتحدة الأمريكية',
    flag: '🇺🇸',
    region: 'north_america',
    fanCount: 350,
    groupsCount: 1,
    cities: ['نيويورك', 'نيوجيرسي', 'كاليفورنيا', 'فلوريدا'],
    active: true,
    order: 5,
    coverImage: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?q=80&w=1200&auto=format&fit=crop',
    description: 'اتحاداوية أمريكا الشمالية تجمعهم المحبة الخضراء والشغف بالثغر السكندري.'
  },
  {
    id: 'eu',
    code: 'EU',
    name: 'الاتحاد الأوروبي',
    nameAr: 'الاتحاد الأوروبي',
    flag: '🇪🇺',
    region: 'europe',
    fanCount: 480,
    groupsCount: 1,
    cities: ['فرانكفورت', 'باريس', 'برلين', 'روما', 'أمستردام', 'فيينا', 'مدريد', 'بروكسل'],
    active: true,
    order: 6,
    coverImage: 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?q=80&w=1200&auto=format&fit=crop',
    description: 'ملتقى جماهير الاتحاد السكندري وعشاق الأخضر في دول ومدن الاتحاد الأوروبي.'
  },
  {
    id: 'east_asia',
    code: 'EA',
    name: 'شرق آسيا',
    nameAr: 'شرق آسيا',
    flag: '🌏',
    region: 'asia',
    fanCount: 220,
    groupsCount: 1,
    cities: ['طوكيو', 'بكين', 'سيول', 'كوالالمبور', 'سنغافورة', 'بانكوك', 'هونغ كونغ'],
    active: true,
    order: 7,
    coverImage: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop',
    description: 'تجمع ورابطة محبي زعيم الثغر في دول وعواصم شرق وجنوب شرق آسيا.'
  },
  {
    id: 'qa',
    code: 'QA',
    name: 'قطر',
    nameAr: 'قطر',
    flag: '🇶🇦',
    region: 'gulf',
    fanCount: 295,
    groupsCount: 1,
    cities: ['الدوحة', 'الريان', 'الوكرة'],
    active: true,
    order: 8,
    coverImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1200&auto=format&fit=crop',
    description: 'رابطة مشجعي الاتحاد السكندري في الدوحة والملاعب القطرية.'
  },
  {
    id: 'om',
    code: 'OM',
    name: 'سلطنة عُمان',
    nameAr: 'سلطنة عُمان',
    flag: '🇴🇲',
    region: 'gulf',
    fanCount: 190,
    groupsCount: 1,
    cities: ['مسقط', 'صلالة', 'صحار'],
    active: true,
    order: 9,
    coverImage: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1200&auto=format&fit=crop',
    description: 'أبناء زعيم الثغر في مسقط وعمان المحبة.'
  }
];

export const defaultWorldGroups: WorldGroup[] = [];

export const defaultWorldPosts: WorldPost[] = [];

export const defaultWorldEvents: WorldEvent[] = [];

export const defaultWorldHelpRequests: WorldHelpRequest[] = [];
