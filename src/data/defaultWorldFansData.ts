import { WorldCountry, WorldGroup, WorldPost, WorldEvent, WorldHelpRequest } from '../types/worldFans';

export const defaultWorldCountries: WorldCountry[] = [
  {
    id: 'ae',
    code: 'AE',
    name: 'الإمارات العربية المتحدة',
    flag: '🇦🇪',
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
    flag: '🇸🇦',
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
    flag: '🇰🇼',
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
    flag: '🇬🇧',
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
    flag: '🇺🇸',
    fanCount: 350,
    groupsCount: 1,
    cities: ['نيويورك', 'نيوجيرسي', 'كاليفورنيا', 'فلوريدا'],
    active: true,
    order: 5,
    coverImage: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?q=80&w=1200&auto=format&fit=crop',
    description: 'اتحاداوية أمريكا الشمالية تجمعهم المحبة الخضراء والشغف بالثغر السكندري.'
  },
  {
    id: 'de',
    code: 'DE',
    name: 'ألمانيا',
    flag: '🇩🇪',
    fanCount: 280,
    groupsCount: 1,
    cities: ['برلين', 'ميونخ', 'فرانكفورت', 'كولن'],
    active: true,
    order: 6,
    coverImage: 'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?q=80&w=1200&auto=format&fit=crop',
    description: 'ملتقى الاتحاداوية في المدن الألمانية والاتحاد الأوروبي.'
  },
  {
    id: 'qa',
    code: 'QA',
    name: 'قطر',
    flag: '🇶🇦',
    fanCount: 295,
    groupsCount: 1,
    cities: ['الدوحة', 'الريان', 'الوكرة'],
    active: true,
    order: 7,
    coverImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1200&auto=format&fit=crop',
    description: 'رابطة مشجعي الاتحاد السكندري في الدوحة والملاعب القطرية.'
  },
  {
    id: 'om',
    code: 'OM',
    name: 'سلطنة عُمان',
    flag: '🇴🇲',
    fanCount: 190,
    groupsCount: 1,
    cities: ['مسقط', 'صلالة', 'صحار'],
    active: true,
    order: 8,
    coverImage: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1200&auto=format&fit=crop',
    description: 'أبناء زعيم الثغر في مسقط وعمان المحبة.'
  }
];

export const defaultWorldGroups: WorldGroup[] = [
  {
    id: 'group_uae_dubai',
    name: 'رابطة اتحاداوية الإمارات',
    countryId: 'ae',
    countryName: 'الإمارات العربية المتحدة',
    countryFlag: '🇦🇪',
    city: 'دبي',
    description: 'الرابطة الرسمية لجماهير نادي الاتحاد السكندري في دولة الإمارات العربية المتحدة. ننظم تجمعات دورية لمشاهدة مباريات كرة القدم وكرة السلة والأنشطة الاجتماعية والرياضية.',
    coverImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/0e/Al_Ittihad_Alexandria_Club_Logo.svg/1024px-Al_Ittihad_Alexandria_Club_Logo.svg.png',
    status: 'approved',
    verified: true,
    featured: true,
    adminUid: 'admin_uae_1',
    adminName: 'م. تامر السكندري',
    adminEmail: 'uae@ittihad.club',
    adminPhone: '+971501234567',
    socialLinks: {
      whatsapp: 'https://chat.whatsapp.com/sample',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com'
    },
    memberCount: 1240,
    eventsCount: 18,
    postsCount: 42,
    galleryCount: 65,
    foundedYear: '2016',
    meetingPlace: 'كافيه الساحة الرياضية - دبي مارينا',
    createdAt: '2023-01-10T12:00:00.000Z'
  },
  {
    id: 'group_sa_riyadh',
    name: 'رابطة اتحاداوية الرياض والسعودية',
    countryId: 'sa',
    countryName: 'المملكة العربية السعودية',
    countryFlag: '🇸🇦',
    city: 'الرياض',
    description: 'تجمع جماهير سيد البلد في الرياض والمنطقة الوسطى والشرقية. تنظيم تجمعات كبرى لكل مباريات الدوري المصري والبطولة العربية لكرة السلة.',
    coverImage: 'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?q=80&w=1200&auto=format&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/0e/Al_Ittihad_Alexandria_Club_Logo.svg/1024px-Al_Ittihad_Alexandria_Club_Logo.svg.png',
    status: 'approved',
    verified: true,
    featured: true,
    adminUid: 'admin_sa_1',
    adminName: 'أ. أحمد فؤاد',
    adminEmail: 'riyadh@ittihad.club',
    adminPhone: '+966551234567',
    socialLinks: {
      whatsapp: 'https://chat.whatsapp.com/sample_sa',
      twitter: 'https://x.com'
    },
    memberCount: 980,
    eventsCount: 14,
    postsCount: 36,
    galleryCount: 48,
    foundedYear: '2017',
    meetingPlace: 'لاونج الزعيم - حي الملز، الرياض',
    createdAt: '2023-02-15T12:00:00.000Z'
  },
  {
    id: 'group_kw_kuwait',
    name: 'رابطة اتحاداوية الكويت',
    countryId: 'kw',
    countryName: 'الكويت',
    countryFlag: '🇰🇼',
    city: 'الكويت العاصمة',
    description: 'بيت الاتحاداوية في الكويت. نعتز بدعم زعيم الثغر في كل المحافل وتنظيم رحلات جماعية لحضور المباريات الهامة وبطولات الأندية العربية.',
    coverImage: 'https://images.unsplash.com/photo-1578895210405-907db486c111?q=80&w=1200&auto=format&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/0e/Al_Ittihad_Alexandria_Club_Logo.svg/1024px-Al_Ittihad_Alexandria_Club_Logo.svg.png',
    status: 'approved',
    verified: true,
    featured: true,
    adminUid: 'admin_kw_1',
    adminName: 'كابتن هشام عثمان',
    adminEmail: 'kuwait@ittihad.club',
    adminPhone: '+96599123456',
    socialLinks: {
      whatsapp: 'https://chat.whatsapp.com/sample_kw'
    },
    memberCount: 620,
    eventsCount: 22,
    postsCount: 54,
    galleryCount: 80,
    foundedYear: '2014',
    meetingPlace: 'نادي الجالية السكندرية - السالمية',
    createdAt: '2023-01-01T12:00:00.000Z'
  },
  {
    id: 'group_uk_london',
    name: 'رابطة اتحاداوية لندن وبريطانيا',
    countryId: 'gb',
    countryName: 'المملكة المتحدة',
    countryFlag: '🇬🇧',
    city: 'لندن',
    description: 'جماهير الاتحاد السكندري في المملكة المتحدة. ننظم فعاليات مشاهدة المباريات في وسط لندن ومناطق الجاليات المصرية، ومساعدة الوافدين الجدد.',
    coverImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/0e/Al_Ittihad_Alexandria_Club_Logo.svg/1024px-Al_Ittihad_Alexandria_Club_Logo.svg.png',
    status: 'approved',
    verified: true,
    featured: true,
    adminUid: 'admin_uk_1',
    adminName: 'د. سامح البحيري',
    adminEmail: 'london@ittihad.club',
    adminPhone: '+447911123456',
    socialLinks: {
      whatsapp: 'https://chat.whatsapp.com/sample_uk'
    },
    memberCount: 410,
    eventsCount: 9,
    postsCount: 28,
    galleryCount: 35,
    foundedYear: '2019',
    meetingPlace: 'Green Park Sports Hub - Central London',
    createdAt: '2023-03-20T12:00:00.000Z'
  }
];

export const defaultWorldPosts: WorldPost[] = [
  {
    id: 'post_1',
    groupId: 'group_uae_dubai',
    groupName: 'رابطة اتحاداوية الإمارات',
    groupFlag: '🇦🇪',
    groupCity: 'دبي',
    groupVerified: true,
    authorId: 'admin_uae_1',
    authorName: 'م. تامر السكندري',
    authorAvatar: 'https://ui-avatars.com/api/?name=Tamer+Alex&background=10b981&color=fff',
    authorRole: 'group_admin',
    type: 'match_watch',
    content: 'اتحاداوية دبي والإمارات جاهزون لمباراة الجمعة المرتقبة 💚 التجمع الرسمي سيكون في كافيه الساحة بدبي مارينا الساعة 7 مساءً. يوجد شاشات عملاقة وخصم خاص للاتحاداوية الحاضرين بتيشيرت النادي!',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000&auto=format&fit=crop',
    matchDetails: {
      opponent: 'الزمالك',
      matchDate: 'الجمعة 8:00 م',
      venue: 'استاد الإسكندرية / كافيه الساحة بدبي',
      competition: 'الدوري المصري الممتاز'
    },
    pinned: true,
    likes: 64,
    likedBy: [],
    commentsCount: 12,
    comments: [
      {
        id: 'c1',
        userId: 'u_user_1',
        userName: 'كريم مجدي',
        userAvatar: 'https://ui-avatars.com/api/?name=Karim+M&background=0284c7&color=fff',
        content: 'معاكم إن شاء الله مع شلة البرشاء وجايين بتيشيرت المئوية الأخضر 💚🟢',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'c2',
        userId: 'u_user_2',
        userName: 'محمود عبد الرازق',
        userAvatar: 'https://ui-avatars.com/api/?name=Mahmoud+R&background=059669&color=fff',
        content: 'عاش يا شباب.. بالتوفيق لسيد البلد وربنا ينصرنا يا رب 🤲',
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'post_2',
    groupId: 'group_sa_riyadh',
    groupName: 'رابطة اتحاداوية الرياض والسعودية',
    groupFlag: '🇸🇦',
    groupCity: 'الرياض',
    groupVerified: true,
    authorId: 'admin_sa_1',
    authorName: 'أ. أحمد فؤاد',
    authorAvatar: 'https://ui-avatars.com/api/?name=Ahmed+Fouad&background=10b981&color=fff',
    authorRole: 'group_admin',
    type: 'gallery',
    content: 'صور من التجمع الأخير لجمهور زعيم الثغر في الرياض أثناء متابعة نهائي دوري سوبر السلة 🏀🏆 الأجواء كانت حماسية جداً وتشجيع هستيري حتى الثواني الأخيرة! كل الشكر لكل اتحاداوي حضر وشرفنا 💚',
    images: [
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1510563399035-7140409890a5?q=80&w=1000&auto=format&fit=crop'
    ],
    pinned: false,
    likes: 92,
    likedBy: [],
    commentsCount: 8,
    createdAt: new Date(Date.now() - 18000000).toISOString()
  },
  {
    id: 'post_3',
    groupId: 'group_uk_london',
    groupName: 'رابطة اتحاداوية لندن وبريطانيا',
    groupFlag: '🇬🇧',
    groupCity: 'لندن',
    groupVerified: true,
    authorId: 'admin_uk_1',
    authorName: 'د. سامح البحيري',
    authorAvatar: 'https://ui-avatars.com/api/?name=Sameh+Elbeheiry&background=10b981&color=fff',
    authorRole: 'group_admin',
    type: 'announcement',
    content: 'إعلان هام للاتحاداوية في لندن وبريطانيا 📢: نرحب بجميع الطلبة والوافدين الجدد من الإسكندرية. تم إنشاء جروب واتساب للمساعدة في السكن والتعارف وحضور المباريات سوياً. تواصلوا معنا فوراً!',
    pinned: false,
    likes: 45,
    likedBy: [],
    commentsCount: 5,
    createdAt: new Date(Date.now() - 43200000).toISOString()
  }
];

export const defaultWorldEvents: WorldEvent[] = [
  {
    id: 'event_1',
    groupId: 'group_uae_dubai',
    groupName: 'رابطة اتحاداوية الإمارات',
    groupFlag: '🇦🇪',
    groupCity: 'دبي',
    title: '⚽ تجمع اتحاداوية دبي - الاتحاد السكندري × الزمالك',
    description: 'تجمع رسمي لأعضاء الرابطة لمشاهدة المباراة مباشرة على شاشات عرض عملاقة مع هتافات وتشجيع سيد البلد، وتوزيع أعلام وتذكارات النادي.',
    date: '2026-08-21',
    time: '8:00 مساءً',
    location: 'كافيه الساحة الرياضية - دبي مارينا',
    mapsUrl: 'https://maps.google.com',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000&auto=format&fit=crop',
    status: 'upcoming',
    participantsCount: 48,
    participantUids: ['sample_user_1', 'sample_user_2'],
    participants: [
      { uid: 'sample_user_1', name: 'كريم مجدي', avatar: 'https://ui-avatars.com/api/?name=Karim+M', joinedAt: '2026-08-14T01:00:00Z' },
      { uid: 'sample_user_2', name: 'عمر خالد', avatar: 'https://ui-avatars.com/api/?name=Omar+K', joinedAt: '2026-08-14T02:00:00Z' }
    ],
    opponent: 'الزمالك',
    createdAt: '2026-08-12T10:00:00Z'
  },
  {
    id: 'event_2',
    groupId: 'group_sa_riyadh',
    groupName: 'رابطة اتحاداوية الرياض والسعودية',
    groupFlag: '🇸🇦',
    groupCity: 'الرياض',
    title: '🏀 نهائي مرتبط السلة - لقاء عمالقة الشاطبي بالرياض',
    description: 'حضور جماهيري ضخم لمشاهدة نهائي السلة مع أهازيج الشاطبي وتناول العشاء السكندري المشترك.',
    date: '2026-08-25',
    time: '7:30 مساءً',
    location: 'لاونج الزعيم - حي الملز، الرياض',
    mapsUrl: 'https://maps.google.com',
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1000&auto=format&fit=crop',
    status: 'upcoming',
    participantsCount: 35,
    participantUids: [],
    participants: [],
    createdAt: '2026-08-13T12:00:00Z'
  }
];

export const defaultWorldHelpRequests: WorldHelpRequest[] = [
  {
    id: 'help_1',
    countryId: 'ae',
    countryName: 'الإمارات العربية المتحدة',
    countryFlag: '🇦🇪',
    city: 'دبي',
    groupId: 'group_uae_dubai',
    groupName: 'رابطة اتحاداوية الإمارات',
    userId: 'u_user_help_1',
    userName: 'طارق ممدوح',
    userAvatar: 'https://ui-avatars.com/api/?name=Tarek+M&background=10b981&color=fff',
    title: 'اتحاداوي جديد في دبي وعايز يعرف أماكن تجمع الاتحاداوية ووسائل المواصلات',
    content: 'السلام عليكم يا رجالة سيد البلد 💚 لسه واصل دبي جديد في منطقة البرشاء، وحابب اعرف مواعيد التجمعات القادمة وأفضل كافيهات بتذيع مباريات الاتحاد السكندري في الدوري والسلة.',
    category: 'gathering',
    contactMethod: 'واتساب متاح بالبروفايل',
    status: 'open',
    repliesCount: 3,
    replies: [
      {
        id: 'hr_1',
        userId: 'admin_uae_1',
        userName: 'م. تامر السكندري (مسؤول الرابطة)',
        userAvatar: 'https://ui-avatars.com/api/?name=Tamer+Alex&background=10b981&color=fff',
        content: 'ألف مرحب بيك في دبي يا غالي 💚 نورتنا.. كلمني خاص وادخلك جروب الواتساب وعندنا تجمع الجمعة الجاية في دبي مارينا قريب جداً منك في البرشاء.',
        createdAt: new Date(Date.now() - 14400000).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 28800000).toISOString()
  },
  {
    id: 'help_2',
    countryId: 'gb',
    countryName: 'المملكة المتحدة',
    countryFlag: '🇬🇧',
    city: 'لندن',
    groupId: 'group_uk_london',
    groupName: 'رابطة اتحاداوية لندن وبريطانيا',
    userId: 'u_user_help_2',
    userName: 'مصطفى النجار',
    userAvatar: 'https://ui-avatars.com/api/?name=Mostafa+N&background=0284c7&color=fff',
    title: 'مسافر لندن في منحة دراسية وعايز اتعرف على إخواتي الاتحاداوية هناك',
    content: 'مساء الخير عليكم جميعاً، بإذن الله هكون في لندن الشهر القادم للدراسة بجامعة UCL وعايز اتواصل مع الاتحاداوية في لندن عشان نحضر الماتشات سوا وما احسش بالغربة 💚',
    category: 'advice',
    status: 'open',
    repliesCount: 2,
    createdAt: new Date(Date.now() - 57600000).toISOString()
  }
];
