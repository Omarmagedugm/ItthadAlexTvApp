import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  Users, 
  ShieldCheck, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Sparkles, 
  MapPin, 
  MessageCircle, 
  Calendar, 
  Search,
  ExternalLink,
  Phone,
  Mail,
  Filter,
  Image as ImageIcon,
  Upload,
  X
} from 'lucide-react';
import { useAppStore } from '../../store';
import { WorldGroup, WorldCountry, WorldApplication, WorldEvent, WorldHelpRequest, WorldGroupMember } from '../../types/worldFans';
import { doc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import ImageUploader from '../ImageUploader';

export const AdminWorldFans: React.FC = () => {
  const { 
    worldGroups, 
    setWorldGroups, 
    worldCountries, 
    setWorldCountries, 
    worldApplications, 
    setWorldApplications, 
    worldEvents, 
    setWorldEvents 
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<'groups' | 'applications' | 'countries' | 'events'>('groups');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Group Modal State
  const [editingGroup, setEditingGroup] = useState<WorldGroup | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [groupForm, setGroupForm] = useState<Partial<WorldGroup>>({});

  // Country Modal State
  const [editingCountry, setEditingCountry] = useState<WorldCountry | null>(null);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState<boolean>(false);
  const [countryForm, setCountryForm] = useState<Partial<WorldCountry>>({});

  // Event Modal State
  const [editingEvent, setEditingEvent] = useState<WorldEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState<boolean>(false);
  const [eventForm, setEventForm] = useState<Partial<WorldEvent>>({});

  // Members Management Modal State
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<WorldGroup | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState<boolean>(false);
  const [groupMembersList, setGroupMembersList] = useState<WorldGroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // Open Members Modal & fetch from Firestore
  const handleOpenMembersModal = async (group: WorldGroup) => {
    setSelectedGroupForMembers(group);
    setIsMembersModalOpen(true);
    setLoadingMembers(true);
    setMemberSearchQuery('');

    try {
      const q = query(
        collection(db, 'world_group_members'),
        where('groupId', '==', group.id)
      );
      const snapshot = await getDocs(q);
      const members = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<WorldGroupMember, 'id'>)
      }));
      setGroupMembersList(members);
    } catch (err) {
      console.warn('Error fetching group members:', err);
      toast.error('تعذر جلب قائمة الأعضاء');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Remove member from group
  const handleRemoveGroupMember = async (memberId: string) => {
    if (!selectedGroupForMembers) return;
    if (!window.confirm('هل أنت متأكد من إزالة هذا العضو من الرابطة؟')) return;

    try {
      await deleteDoc(doc(db, 'world_group_members', memberId));
      const updatedList = groupMembersList.filter(m => m.id !== memberId);
      setGroupMembersList(updatedList);

      const newCount = Math.max(0, (Number(selectedGroupForMembers.memberCount) || 1) - 1);
      const updatedGroups = worldGroups.map(g => g.id === selectedGroupForMembers.id ? { ...g, memberCount: newCount } : g);
      setWorldGroups(updatedGroups);

      await updateDoc(doc(db, 'world_groups', selectedGroupForMembers.id), {
        memberCount: newCount
      });

      setSelectedGroupForMembers(prev => prev ? { ...prev, memberCount: newCount } : null);
      toast.success('تمت إزالة العضو بنجاح');
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error('حدث خطأ أثناء إزالة العضو');
    }
  };

  // Save Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingGroup ? editingGroup.id : uuidv4();
    const selectedCountry = worldCountries.find(c => c.id === groupForm.countryId);

    const groupData: WorldGroup = {
      id,
      name: groupForm.name || 'رابطة جديدة',
      countryId: groupForm.countryId || 'sa',
      countryName: selectedCountry?.nameAr || groupForm.countryName || 'بالخارج',
      countryFlag: selectedCountry?.flag || groupForm.countryFlag || '🌍',
      city: groupForm.city || 'المدينة',
      region: selectedCountry?.region || groupForm.region || 'gulf',
      logo: groupForm.logo || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80',
      coverImage: groupForm.coverImage,
      description: groupForm.description,
      status: groupForm.status || 'official',
      featured: groupForm.featured || false,
      memberCount: Number(groupForm.memberCount) || 1,
      adminName: groupForm.adminName,
      adminPhone: groupForm.adminPhone,
      adminWhatsapp: groupForm.adminWhatsapp,
      whatsappGroupUrl: groupForm.whatsappGroupUrl,
      facebookPageUrl: groupForm.facebookPageUrl,
      foundedYear: Number(groupForm.foundedYear) || 2024,
      active: groupForm.active !== undefined ? groupForm.active : true,
      createdAt: editingGroup?.createdAt || new Date().toISOString(),
    };

    const updated = editingGroup
      ? worldGroups.map(g => g.id === id ? groupData : g)
      : [groupData, ...worldGroups];

    setWorldGroups(updated);

    try {
      await setDoc(doc(db, 'world_groups', id), groupData);
    } catch (err) {
      console.warn('Group saved locally:', err);
    }

    setIsGroupModalOpen(false);
    setEditingGroup(null);
    setGroupForm({});
  };

  // Delete Group
  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الرابطة؟')) return;

    const updated = worldGroups.filter(g => g.id !== groupId);
    setWorldGroups(updated);

    try {
      await deleteDoc(doc(db, 'world_groups', groupId));
    } catch (err) {
      console.warn('Group deleted locally:', err);
    }
  };

  // Approve Application
  const handleApproveApplication = async (app: WorldApplication) => {
    if (!window.confirm(`هل تريد اعتماد طلب تأسيس (${app.proposedGroupName}) وتدشين الرابطة فوراً؟`)) return;

    const selectedCountry = worldCountries.find(c => c.id === app.countryId);
    const newGroup: WorldGroup = {
      id: uuidv4(),
      name: app.proposedGroupName,
      countryId: app.countryId,
      countryName: app.countryName,
      countryFlag: selectedCountry?.flag || '🌍',
      city: app.city,
      region: selectedCountry?.region || 'other',
      logo: app.logo || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80',
      description: app.motivation || `الرابطة الرسمية لجماهير الاتحاد السكندري في ${app.city}`,
      status: 'official',
      featured: true,
      memberCount: app.estimatedFansCount || 20,
      adminName: app.applicantName,
      adminPhone: app.applicantPhone,
      adminWhatsapp: app.applicantWhatsapp,
      foundedYear: new Date().getFullYear(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    // Update group state
    const nextGroups = [newGroup, ...worldGroups];
    setWorldGroups(nextGroups);

    // Update application state
    const nextApps = worldApplications.map(a => a.id === app.id ? { ...a, status: 'approved' as const, approvedGroupId: newGroup.id } : a);
    setWorldApplications(nextApps);

    try {
      await setDoc(doc(db, 'world_groups', newGroup.id), newGroup);
      await updateDoc(doc(db, 'world_applications', app.id), {
        status: 'approved',
        approvedGroupId: newGroup.id
      });
    } catch (err) {
      console.warn('Application approval stored locally:', err);
    }
  };

  // Reject Application
  const handleRejectApplication = async (appId: string) => {
    if (!window.confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;

    const nextApps = worldApplications.map(a => a.id === appId ? { ...a, status: 'rejected' as const } : a);
    setWorldApplications(nextApps);

    try {
      await updateDoc(doc(db, 'world_applications', appId), { status: 'rejected' });
    } catch (err) {
      console.warn('App rejection local:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Globe size={22} className="text-emerald-600 dark:text-emerald-400" />
            <span>إدارة رابطة اتحاداوية العالم 🌍</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            إدارة روابط الجماهير بالخارج، اعتماد طلبات التأسيس، وتنسيق الفعاليات الدولية
          </p>
        </div>

        {/* Sub-tabs switch */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveSubTab('groups')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'groups'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            الروابط ({worldGroups.length})
          </button>

          <button
            onClick={() => setActiveSubTab('applications')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all relative ${
              activeSubTab === 'applications'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            طلبات التأسيس ({worldApplications.filter(a => a.status === 'pending').length})
            {worldApplications.some(a => a.status === 'pending') && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('countries')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'countries'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            الدول ({worldCountries.length})
          </button>

          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'events'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            الفعاليات ({worldEvents.length})
          </button>
        </div>
      </div>

      {/* 1. GROUPS TAB */}
      {activeSubTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الروابط والمدن..."
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pr-9 pl-3 text-slate-800 dark:text-white"
              />
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              onClick={() => {
                setEditingGroup(null);
                setGroupForm({
                  status: 'official',
                  featured: false,
                  memberCount: 10,
                  active: true,
                });
                setIsGroupModalOpen(true);
              }}
              className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus size={16} />
              <span>إضافة رابطة جديدة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worldGroups
              .filter(g => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return g.name.toLowerCase().includes(q) || g.city.toLowerCase().includes(q) || g.countryName.toLowerCase().includes(q);
              })
              .map((group) => (
                <div
                  key={group.id}
                  className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={group.logo || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80'}
                          alt=""
                          className="w-12 h-12 rounded-2xl object-cover border border-emerald-500/30 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{group.name}</h4>
                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <span>{group.city}، {group.countryName}</span>
                            <span>{group.countryFlag}</span>
                          </span>
                        </div>
                      </div>

                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        group.status === 'official'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {group.status === 'official' ? 'رسمية ✓' : 'مجتمع'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 font-medium">
                      {group.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-2xl mb-3">
                      <div>الأعضاء: <span className="text-slate-800 dark:text-white font-black">{group.memberCount || 0} عضو</span></div>
                      <div>المسؤول: <span className="text-slate-800 dark:text-white font-black">{group.adminName || 'غير محدد'}</span></div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => handleOpenMembersModal(group)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-[11px] font-bold flex items-center justify-center gap-1.5 border border-emerald-500/20 active:scale-95 transition-all"
                      >
                        <Users size={13} />
                        <span>إدارة الأعضاء ({group.memberCount || 0})</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {group.whatsappGroupUrl && (
                        <a
                          href={group.whatsappGroupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 hover:scale-105"
                          title="جروب الواتساب"
                        >
                          <MessageCircle size={14} />
                        </a>
                      )}
                      <a
                        href={`/world-fans/group/${group.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:scale-105"
                        title="معاينة الرابطة في التطبيق"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingGroup(group);
                          setGroupForm(group);
                          setIsGroupModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold"
                        title="تعديل"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-bold"
                        title="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 2. APPLICATIONS TAB */}
      {activeSubTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">طلبات تأسيس الروابط الواردة</h3>
            <span className="text-xs font-bold text-slate-400">إجمالي الطلبات: {worldApplications.length}</span>
          </div>

          {worldApplications.length === 0 ? (
            <div className="text-center py-12 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-400">لا توجد طلبات تأسيس واردة حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {worldApplications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        app.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : app.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {app.status === 'approved' ? 'معتمد ✓' : app.status === 'rejected' ? 'مرفوض ✕' : 'قيد المراجعة ⏳'}
                      </span>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">{app.proposedGroupName}</h4>
                      <span className="text-xs text-slate-400 font-bold">({app.city}، {app.countryName})</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      {app.motivation}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1"><Users size={12} /> صاحب الطلب: {app.applicantName}</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> واتساب: {app.applicantWhatsapp}</span>
                      <span className="flex items-center gap-1"><Users size={12} /> الجمهور التقديري: {app.estimatedFansCount}</span>
                    </div>
                  </div>

                  {app.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveApplication(app)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <CheckCircle size={14} />
                        <span>اعتماد وتدشين الرابطة</span>
                      </button>

                      <button
                        onClick={() => handleRejectApplication(app.id)}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 hover:text-red-600 text-xs font-bold active:scale-95 transition-all"
                      >
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. COUNTRIES TAB */}
      {activeSubTab === 'countries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">قائمة الدول والمناطق المسجلة</h3>
            <button
              onClick={() => {
                setEditingCountry(null);
                setCountryForm({ region: 'gulf', fanCount: 100, active: true });
                setIsCountryModalOpen(true);
              }}
              className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={15} />
              <span>إضافة دولة</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {worldCountries.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{c.flag}</span>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">{c.nameAr}</h4>
                    <span className="text-[10px] text-slate-400 font-bold">{c.nameEn}</span>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">{c.fanCount}+</span>
                  <span className="text-[9px] text-slate-400 font-medium">مشجع</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. EVENTS TAB */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">إدارة فعاليات وتجمعات المباريات</h3>
            <span className="text-xs font-bold text-slate-400">إجمالي الفعاليات: {worldEvents.length}</span>
          </div>

          <div className="space-y-3">
            {worldEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                      {evt.type}
                    </span>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">{evt.title}</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {evt.groupName} • {evt.city} • {evt.date} ({evt.time}) • {evt.location}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl">
                    {evt.participantsCount || 1} مسجلين
                  </span>

                  <button
                    onClick={async () => {
                      if (!window.confirm('هل تريد حذف هذه الفعالية؟')) return;
                      const nextEvts = worldEvents.filter(e => e.id !== evt.id);
                      setWorldEvents(nextEvts);
                      try { await deleteDoc(doc(db, 'world_events', evt.id)); } catch (e) {}
                    }}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit/Add Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0 bg-white dark:bg-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                {editingGroup ? 'تعديل بيانات الرابطة' : 'إضافة رابطة جديدة'}
              </h3>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 overscroll-contain">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الرابطة *</label>
                    <input
                      type="text"
                      required
                      value={groupForm.name || ''}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder="مثال: رابطة اتحاداوية الرياض"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الدولة *</label>
                    <select
                      value={groupForm.countryId || 'sa'}
                      onChange={(e) => setGroupForm({ ...groupForm, countryId: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    >
                      {worldCountries.map(c => (
                        <option key={c.id} value={c.id}>{c.flag} {c.nameAr || c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المدينة *</label>
                    <input
                      type="text"
                      required
                      value={groupForm.city || ''}
                      onChange={(e) => setGroupForm({ ...groupForm, city: e.target.value })}
                      placeholder="مثال: الرياض"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">عدد الأعضاء التقديري</label>
                    <input
                      type="number"
                      value={groupForm.memberCount || 10}
                      onChange={(e) => setGroupForm({ ...groupForm, memberCount: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">مسؤول الرابطة</label>
                    <input
                      type="text"
                      value={groupForm.adminName || ''}
                      onChange={(e) => setGroupForm({ ...groupForm, adminName: e.target.value })}
                      placeholder="اسم المسؤول"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">سنة التأسيس</label>
                    <input
                      type="number"
                      value={groupForm.foundedYear || 2024}
                      onChange={(e) => setGroupForm({ ...groupForm, foundedYear: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رابط جروب الواتساب</label>
                  <input
                    type="url"
                    value={groupForm.whatsappGroupUrl || ''}
                    onChange={(e) => setGroupForm({ ...groupForm, whatsappGroupUrl: e.target.value })}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                  />
                </div>

                {/* League Logo Upload */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                      شعار الرابطة (Logo)
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                      رفع صورة الشعار
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <ImageUploader
                        folderName="world_groups"
                        onUploadSuccess={(url) => {
                          setGroupForm({ ...groupForm, logo: url });
                        }}
                        buttonText="رفع شعار"
                        buttonClassName="!bg-emerald-600 hover:!bg-emerald-700 !text-white !py-2 !px-3.5 !rounded-xl !text-xs !font-bold !shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
                        showPreview={false}
                      />
                    </div>

                    {groupForm.logo ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center p-0.5 shrink-0">
                          <img
                            src={groupForm.logo}
                            alt="شعار الرابطة"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold truncate flex-1 whitespace-nowrap">
                          ✓ تم تحديد الشعار
                        </span>
                        <button
                          type="button"
                          onClick={() => setGroupForm({ ...groupForm, logo: '' })}
                          className="text-slate-400 hover:text-red-500 p-1 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="حذف الشعار"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                        لم يتم رفع شعار بعد
                      </span>
                    )}
                  </div>
                </div>

                {/* League Cover Image Upload */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                      صورة الغلاف (اختياري)
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                      رفع صورة الغلاف
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <ImageUploader
                        folderName="world_groups"
                        onUploadSuccess={(url) => {
                          setGroupForm({ ...groupForm, coverImage: url });
                        }}
                        buttonText="رفع غلاف"
                        buttonClassName="!bg-slate-200 dark:!bg-slate-700 hover:!bg-slate-300 !text-slate-800 dark:!text-white !py-2 !px-3.5 !rounded-xl !text-xs !font-bold whitespace-nowrap flex items-center justify-center gap-1.5"
                        showPreview={false}
                      />
                    </div>

                    {groupForm.coverImage ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="w-12 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                          <img
                            src={groupForm.coverImage}
                            alt="غلاف الرابطة"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold truncate flex-1 whitespace-nowrap">
                          ✓ تم تحديد الغلاف
                        </span>
                        <button
                          type="button"
                          onClick={() => setGroupForm({ ...groupForm, coverImage: '' })}
                          className="text-slate-400 hover:text-red-500 p-1 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="حذف الغلاف"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                        لم يتم رفع غلاف بعد
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs">الوصف والنبذة</label>
                  <textarea
                    rows={2}
                    value={groupForm.description || ''}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder="نبذة عن الرابطة وأنشطتها..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold resize-none text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300 text-xs shrink-0 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={groupForm.status === 'official'}
                      onChange={(e) => setGroupForm({ ...groupForm, status: e.target.checked ? 'official' : 'community' })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="whitespace-nowrap">رابطة رسمية معتمدة 👑</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300 text-xs shrink-0 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={groupForm.featured || false}
                      onChange={(e) => setGroupForm({ ...groupForm, featured: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span className="whitespace-nowrap">مميزة في الواجهة ⭐</span>
                  </label>
                </div>
              </div>

              {/* Fixed Footer Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-300 active:scale-95 transition-all text-xs whitespace-nowrap shrink-0"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-xs whitespace-nowrap shrink-0"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. MEMBERS MANAGEMENT MODAL */}
      {isMembersModalOpen && selectedGroupForMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto flex flex-col"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <span>أعضاء رابطة: {selectedGroupForMembers.name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {selectedGroupForMembers.memberCount || 0} عضو
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    {selectedGroupForMembers.city}، {selectedGroupForMembers.countryName} {selectedGroupForMembers.countryFlag}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative mb-4">
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="بحث في أسماء الأعضاء..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-9 pl-3 text-slate-800 dark:text-white"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto min-h-[250px] space-y-2">
              {loadingMembers ? (
                <div className="py-16 text-center">
                  <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-400">جاري تحميل الأعضاء من قاعدة البيانات...</span>
                </div>
              ) : groupMembersList.length > 0 ? (
                <div className="space-y-2">
                  {groupMembersList
                    .filter(m => {
                      if (!memberSearchQuery.trim()) return true;
                      const q = memberSearchQuery.toLowerCase();
                      return m.userName.toLowerCase().includes(q) || (m.userEmail && m.userEmail.toLowerCase().includes(q));
                    })
                    .map((member) => (
                      <div
                        key={member.id}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          {member.userAvatar ? (
                            <img
                              src={member.userAvatar}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover border border-emerald-500/30"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center">
                              {member.userName?.charAt(0) || 'U'}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-black text-slate-800 dark:text-white">
                                {member.userName}
                              </h5>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                {member.userRole || 'عضو'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              <span>انضم {new Date(member.joinedAt).toLocaleDateString('ar-EG')}</span>
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveGroupMember(member.id)}
                          className="p-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-bold"
                          title="إزالة العضو من الرابطة"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="py-16 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-400 flex items-center justify-center mx-auto">
                    <Users size={24} />
                  </div>
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                    لا يوجد أعضاء منضمين عبر التطبيق حتى الآن
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    العدد المسجل للرابطة: {selectedGroupForMembers.memberCount || 0} عضو
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">
                إجمالي الأعضاء المنضمين بالتطبيق: {groupMembersList.length}
              </span>
              <button
                type="button"
                onClick={() => setIsMembersModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminWorldFans;
