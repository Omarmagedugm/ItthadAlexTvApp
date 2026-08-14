export interface WorldCountry {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  flag: string;
  fanCount: number;
  groupsCount: number;
  cities?: string[];
  activeGroupsCount?: number;
  active: boolean;
  order?: number;
  featured?: boolean;
  region?: string;
  coverImage?: string;
  description?: string;
  createdAt?: string;
}

export interface WorldGroup {
  id: string;
  name: string;
  countryId: string;
  countryName: string;
  countryFlag: string;
  city: string;
  description: string;
  coverImage?: string;
  logo?: string;
  status: 'approved' | 'pending' | 'suspended' | 'rejected' | 'official' | 'community';
  verified?: boolean; // 🟢 رابطة معتمدة
  featured?: boolean;
  active?: boolean;
  region?: string;
  adminUid?: string; // Group Admin user ID
  adminName: string;
  adminEmail?: string;
  adminPhone?: string;
  adminWhatsapp?: string;
  whatsappGroupUrl?: string;
  facebookPageUrl?: string;
  socialLinks?: {
    facebook?: string;
    whatsapp?: string;
    instagram?: string;
    twitter?: string;
    telegram?: string;
  };
  memberCount?: number;
  membersCount?: number;
  eventsCount?: number;
  postsCount?: number;
  galleryCount?: number;
  foundedYear?: string | number;
  meetingPlace?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorldGroupMember {
  id: string; // `${groupId}_${userId}`
  groupId: string;
  groupName?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  userCity?: string;
  userRole?: string;
  role?: 'group_admin' | 'moderator' | 'member' | string;
  badges?: string[];
  countryId?: string;
  joinedAt: string;
}

export type WorldPostType = 'text' | 'image' | 'gallery' | 'video' | 'announcement' | 'match_watch' | 'event' | string;

export interface WorldPostComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  text?: string;
  createdAt: string;
}

export interface WorldPost {
  id: string;
  groupId: string;
  groupName: string;
  groupFlag?: string;
  groupCity?: string;
  groupVerified?: boolean;
  countryCode?: string;
  countryName?: string;
  category?: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole?: 'group_admin' | 'moderator' | 'member' | 'admin' | string;
  type?: WorldPostType;
  content: string;
  image?: string;
  images?: string[];
  videoUrl?: string;
  media?: {
    type: 'image' | 'video';
    url: string;
  }[];
  matchDetails?: {
    opponent: string;
    opponentLogo?: string;
    matchDate: string;
    venue: string;
    competition?: string;
  };
  pinned?: boolean;
  likes: any;
  likedBy?: string[];
  commentsCount: number;
  comments?: WorldPostComment[];
  createdAt: string;
  updatedAt?: string;
}

export interface WorldEventParticipant {
  uid: string;
  name: string;
  avatar?: string;
  phone?: string;
  joinedAt: string;
}

export interface WorldEvent {
  id: string;
  groupId: string;
  groupName: string;
  groupFlag: string;
  groupCity?: string;
  city?: string;
  countryName?: string;
  type?: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location?: string;
  locationName?: string;
  mapsUrl?: string;
  image?: string;
  bannerImage?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled' | 'past';
  participantsCount?: number;
  participantUids?: string[];
  participants?: WorldEventParticipant[];
  attendees?: string[];
  maxAttendees?: number;
  matchId?: string;
  opponent?: string;
  createdAt: string;
}

export interface WorldGalleryItem {
  id: string;
  groupId: string;
  imageUrl: string;
  caption?: string;
  category?: 'match' | 'gathering' | 'celebration' | 'flag' | 'other';
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt: string;
}

export interface WorldHelpReply {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  text?: string;
  createdAt: string;
}

export interface WorldHelpRequest {
  id: string;
  countryId: string;
  countryName: string;
  countryFlag: string;
  city: string;
  groupId?: string;
  groupName?: string;
  userId: string;
  userName: string;
  userAvatar: string;
  title: string;
  content: string;
  category: 'advice' | 'gathering' | 'housing' | 'jobs' | 'tickets' | 'general' | 'housing_jobs' | 'match_streaming' | 'legal_visas' | string;
  contactMethod?: string;
  status: 'open' | 'resolved' | 'closed';
  repliesCount: number;
  replies?: WorldHelpReply[];
  createdAt: string;
}

export interface WorldGroupApplication {
  id: string;
  countryId: string;
  countryName: string;
  countryFlag?: string;
  city: string;
  groupName?: string;
  proposedGroupName?: string;
  adminName?: string;
  applicantName?: string;
  adminPhone?: string;
  applicantPhone?: string;
  applicantWhatsapp?: string;
  adminEmail?: string;
  applicantEmail?: string;
  applicantUid?: string;
  userId?: string;
  expectedMembers?: number | string;
  estimatedFansCount?: number;
  socialLinks?: string;
  logo?: string;
  coverImage?: string;
  notes?: string;
  motivation?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminReviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export type WorldApplication = WorldGroupApplication;
