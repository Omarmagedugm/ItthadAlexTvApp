export type ManagedSectionKey = 'fanServices' | 'worldFans' | 'fanStore' | 'itthadawyBusiness';

export interface SectionFlags {
  fanServices: boolean;
  worldFans: boolean;
  fanStore: boolean;
  itthadawyBusiness: boolean;
  [key: string]: boolean | undefined;
}

export const DEFAULT_SECTION_FLAGS: SectionFlags = {
  fanServices: true,
  worldFans: true,
  fanStore: true,
  itthadawyBusiness: true,
};

export interface SectionConfig {
  key: ManagedSectionKey;
  name: string;
  description: string;
  badge: string;
  icon: string;
  paths: string[];
}

export const MANAGED_SECTIONS: Record<ManagedSectionKey, SectionConfig> = {
  fanServices: {
    key: 'fanServices',
    name: 'خدمات الجماهير والتعليم',
    description: 'منصة خدمات الجمهور، دليل الخدمات العامة، ومنصة التعليم والتدريب المجاني (/services)',
    badge: 'خدمات جماهيرية',
    icon: 'HeartHandshake',
    paths: ['/services', '/public-services', '/services/education', '/education', '/education-services']
  },
  worldFans: {
    key: 'worldFans',
    name: 'رابطة اتحاداوية العالم',
    description: 'رابطة المشجعين حول العالم، مجموعات وروابط المغتربين، الفعاليات وطلبات المساعدة (/world-fans)',
    badge: 'المغتربين',
    icon: 'Globe',
    paths: ['/world-fans', '/world-fans/group', '/world-association']
  },
  fanStore: {
    key: 'fanStore',
    name: 'متجر الجماهير',
    description: 'منتجات النادي، كتالوج وتصنيفات الشراء، وتفاصيل الطلبات والمشتريات (/store)',
    badge: 'المتجر',
    icon: 'ShoppingBag',
    paths: ['/store']
  },
  itthadawyBusiness: {
    key: 'itthadawyBusiness',
    name: 'اتحاداوي بيزنس',
    description: 'دليل الأنشطة والمشروعات التجارية للاتحاداوية وتفاصيل الأعمال والخصومات التجارية (/business)',
    badge: 'دليل الأعمال',
    icon: 'Building2',
    paths: ['/business']
  }
};

/**
 * Returns whether a given section is enabled.
 * Defaults to true if flags are undefined or the key is not explicitly set to false.
 */
export function isSectionEnabled(flags: SectionFlags | undefined, sectionKey: string): boolean {
  if (!flags) return true;
  return flags[sectionKey] !== false;
}

/**
 * Maps a URL route pathname to a managed section key if it matches any protected paths.
 */
export function getSectionKeyForPath(pathname: string): ManagedSectionKey | null {
  const normalized = pathname.toLowerCase();
  
  if (
    normalized === '/services' || 
    normalized === '/public-services' || 
    normalized.startsWith('/services/') || 
    normalized === '/education' || 
    normalized === '/education-services'
  ) {
    return 'fanServices';
  }

  if (
    normalized === '/world-fans' || 
    normalized.startsWith('/world-fans/') || 
    normalized === '/world-association'
  ) {
    return 'worldFans';
  }

  if (
    normalized === '/store' || 
    normalized.startsWith('/store/')
  ) {
    return 'fanStore';
  }

  if (
    normalized === '/business' || 
    normalized.startsWith('/business/')
  ) {
    return 'itthadawyBusiness';
  }

  return null;
}
