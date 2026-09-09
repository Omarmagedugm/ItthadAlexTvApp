import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, limit, updateDoc, where, getDocs, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAppStore } from '../store';
import { defaultWorldCountries } from '../data/defaultWorldFansData';
import { defaultPublicServices, defaultEducationVideos } from '../data/defaultServicesData';

export function useFirestoreSync() {
  const { 
    setNews, setMedia, setMatches, setClubs, setPolls, setPredictions, setFanPosts,
    setUsers, setSettings, setAiConfig, updateLiveStreams, updateProfile, setCityInfo, setAds, setCustomPages,
    setNewsCategories, setNewsTags, setHomeSections, setSidebarMenuItems, setProducts, setSongs, setAlbums, setPlaylists, setMediaPlaylists, setBooks,
    setClubStats, setClubTitles, setHistoryEvents, setStadiums, setDataLoaded, setOrders,
    setClubCommittees, setClubAnnouncements, setClubServices, setClubTrips, setClubMembersSettings, setMemberDiscounts,
    setBusinesses, setBusinessUpdates, setBusinessReports,
    setWorldCountries, setWorldGroups, setWorldPosts, setWorldEvents, setWorldHelpRequests, setWorldApplications,
    setAuditLogs,
    setServices, setEducationVideos
  } = useAppStore();

  const isInitialFetchDoneRef = useRef(false);

  // 1. Public / Global Data Effect - Starts once on app load, NEVER recreated on auth changes
  useEffect(() => {
    let isMounted = true;
    const unsubs: (() => void)[] = [];

    const subscribeSnapshot = (
      docOrQuery: any, 
      onNext: (snap: any) => void, 
      path: string, 
      op: OperationType = OperationType.LIST
    ) => {
      try {
        if (import.meta.env.DEV) {
          console.debug('[Firestore] Public listener started:', path);
        }
        const unsub = onSnapshot(
          docOrQuery, 
          (snap) => {
            if (!isMounted) return;
            try {
              onNext(snap);
            } catch (e) {
              console.warn(`Snapshot callback error for ${path}:`, e);
            }
          }, 
          (err) => {
            if (err?.code !== 'permission-denied') {
              handleFirestoreError(err, op, path);
            }
            setDataLoaded(true);
          }
        );
        return unsub;
      } catch (err) {
        handleFirestoreError(err, op, path);
        setDataLoaded(true);
        return () => {};
      }
    };

    // Essential Dynamic Listeners (Matches, News, Live Settings, Interactive Posts, Club Data)
    const setupRealtimeSync = () => {
      // Live Stream Configs (Single Document reads)
      const unsubLiveFootball = subscribeSnapshot(doc(db, 'settings', 'liveStream'), (snap) => {
        if (snap.exists()) updateLiveStreams({ football: snap.data() as any });
      }, 'settings/liveStream', OperationType.GET);

      const unsubLiveBasketball = subscribeSnapshot(doc(db, 'settings', 'liveStream_basketball'), (snap) => {
        if (snap.exists()) updateLiveStreams({ basketball: snap.data() as any });
      }, 'settings/liveStream_basketball', OperationType.GET);

      const unsubLivePrograms = subscribeSnapshot(doc(db, 'settings', 'liveStream_programs'), (snap) => {
        if (snap.exists()) updateLiveStreams({ programs: snap.data() as any });
      }, 'settings/liveStream_programs', OperationType.GET);

      const unsubLiveCustom = subscribeSnapshot(doc(db, 'settings', 'liveStream_custom'), (snap) => {
        if (snap.exists()) updateLiveStreams({ custom: snap.data() as any });
      }, 'settings/liveStream_custom', OperationType.GET);

      // Home layout & settings
      const unsubLayout = subscribeSnapshot(doc(db, 'settings', 'homeLayout'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.sections)) {
            const sortedSections = [...data.sections].sort((a: any, b: any) => {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return (a.order ?? 0) - (b.order ?? 0);
            });
            setHomeSections(sortedSections);
          }
        }
      }, 'settings/homeLayout', OperationType.GET);

      const unsubGlobalSettings = subscribeSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data) setSettings({ id: snap.id, ...data });
        }
      }, 'settings/global', OperationType.GET);

      // Dynamic collections with strict limits
      const unsubMatches = subscribeSnapshot(
        query(collection(db, 'matches'), orderBy('date', 'desc'), limit(30)), 
        (snap) => {
          setMatches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
        }, 
        'matches'
      );

      const unsubNews = subscribeSnapshot(
        query(collection(db, 'news'), orderBy('date', 'desc'), limit(30)), 
        (snap) => {
          setNews(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
        }, 
        'news'
      );

      const unsubFanPosts = subscribeSnapshot(
        query(collection(db, 'fan_posts'), orderBy('createdAt', 'desc'), limit(30)), 
        (s) => setFanPosts(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any), 
        'fan_posts'
      );

      const unsubPolls = subscribeSnapshot(
        query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(10)), 
        (s) => setPolls(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any), 
        'polls'
      );

      const unsubPredictions = subscribeSnapshot(
        query(collection(db, 'predictions'), orderBy('createdAt', 'desc'), limit(30)), 
        (s) => setPredictions(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any), 
        'predictions'
      );

      // App Users (Fetch lightweight sample once on startup; Admin tab fetches full list on demand)
      getDocs(query(collection(db, 'users'), limit(100)))
        .then(s => {
          if (isMounted) setUsers(s.docs.map(d => ({ id: d.id, uid: d.id, ...(d.data() as any) })) as any);
        })
        .catch(() => {});

      // Club Members Section Data (Realtime sync for instant admin updates)
      const unsubClubAnnouncements = subscribeSnapshot(
        query(collection(db, 'club_announcements'), limit(50)),
        (s) => setClubAnnouncements(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any),
        'club_announcements'
      );

      const unsubClubServices = subscribeSnapshot(
        query(collection(db, 'club_services'), limit(50)),
        (s) => setClubServices(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any),
        'club_services'
      );

      const unsubClubCommittees = subscribeSnapshot(
        query(collection(db, 'club_committees'), limit(30)),
        (s) => setClubCommittees(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any),
        'club_committees'
      );

      const unsubClubTrips = subscribeSnapshot(
        query(collection(db, 'club_trips'), limit(30)),
        (s) => setClubTrips(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any),
        'club_trips'
      );

      const unsubMemberDiscounts = subscribeSnapshot(
        query(collection(db, 'member_discounts'), limit(50)),
        (s) => setMemberDiscounts(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any),
        'member_discounts'
      );

      const unsubClubMembersSettings = subscribeSnapshot(
        doc(db, 'club_members_settings', 'main'),
        (snap) => {
          if (snap.exists()) setClubMembersSettings(snap.data() as any);
        },
        'club_members_settings/main',
        OperationType.GET
      );

      // Public Audience Services & Education Videos
      const unsubPublicServices = subscribeSnapshot(
        query(collection(db, 'public_services'), limit(50)),
        (s) => {
          if (s.empty) {
            setServices(defaultPublicServices);
          } else {
            const seen = new Set<string>();
            const items: any[] = [];
            s.docs.forEach(d => {
              if (d.id && !seen.has(d.id)) {
                seen.add(d.id);
                items.push({ id: d.id, ...(d.data() as any) });
              }
            });
            items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setServices(items);
          }
        },
        'public_services'
      );

      const unsubEducationVideos = subscribeSnapshot(
        query(collection(db, 'education_videos'), limit(300)),
        (s) => {
          if (s.empty) {
            setEducationVideos(defaultEducationVideos);
          } else {
            const seen = new Set<string>();
            const items: any[] = [];
            s.docs.forEach(d => {
              if (d.id && !seen.has(d.id)) {
                seen.add(d.id);
                items.push({ id: d.id, ...(d.data() as any) });
              }
            });
            items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            setEducationVideos(items);
          }
        },
        'education_videos'
      );

      unsubs.push(
        unsubLiveFootball,
        unsubLiveBasketball,
        unsubLivePrograms,
        unsubLiveCustom,
        unsubLayout,
        unsubGlobalSettings,
        unsubMatches,
        unsubNews,
        unsubFanPosts,
        unsubPolls,
        unsubPredictions,
        unsubClubAnnouncements,
        unsubClubServices,
        unsubClubCommittees,
        unsubClubTrips,
        unsubMemberDiscounts,
        unsubClubMembersSettings,
        unsubPublicServices,
        unsubEducationVideos
      );
    };

    setupRealtimeSync();

    // Fetch Reference / Static Data in Prioritized Staggered Batches
    const fetchStaticData = async () => {
      if (isInitialFetchDoneRef.current) return;

      const fetchCol = async (col: string, setter: (d: any) => void, q?: any) => {
        try {
          const s = await getDocs(q || query(collection(db, col), limit(50)));
          if (!isMounted) return;
          const data = s.docs.map(d => ({ id: d.id, uid: d.id, ...(d.data() as any) }));
          if (data) setter(data);
        } catch (e) {
          console.warn(`Fetch ${col} failed`, e);
        }
      };

      const fetchDocItem = async (path: string, setter: (d: any) => void) => {
        try {
          const parts = path.split('/');
          const s = await getDoc(doc(db, parts[0], parts[1]));
          if (!isMounted) return;
          if (s.exists()) {
            setter({ id: s.id, ...(s.data() as any) });
          }
        } catch (e) {
          console.warn(`Fetch doc ${path} failed`, e);
        }
      };

      try {
        // Priority 1: Instant Core Data required for Home UI & Navigation
        await Promise.allSettled([
          fetchDocItem('settings/ai_config', setAiConfig),
          fetchDocItem('settings/newsCategories', (s) => s?.list && setNewsCategories(s.list)),
          fetchDocItem('settings/newsTags', (s) => s?.tags && setNewsTags(s.tags)),
          fetchDocItem('settings/sidebar_layout', (s) => s?.items && setSidebarMenuItems(s.items)),
          fetchDocItem('city_info/alexandria', setCityInfo),
          fetchCol('ads', setAds, query(collection(db, 'ads'), where('active', '==', true), orderBy('order', 'asc'))),
          fetchCol('custom_pages', setCustomPages, query(collection(db, 'custom_pages'), orderBy('createdAt', 'desc'), limit(20))),
          fetchCol('clubs', setClubs, query(collection(db, 'clubs'), limit(30))),
          fetchCol('club_stadiums', setStadiums, query(collection(db, 'club_stadiums'), limit(20))),
          fetchCol('club_timeline', setHistoryEvents, query(collection(db, 'club_timeline'), limit(30))),
          fetchCol('club_titles', setClubTitles, query(collection(db, 'club_titles'), limit(20))),
          fetchCol('club_stats', setClubStats, query(collection(db, 'club_stats'), limit(20)))
        ]);

        if (isMounted) {
          isInitialFetchDoneRef.current = true;
          setDataLoaded(true);
        }

        // Priority 2: Staggered Secondary Data (Media, Songs, Books, World Fans, Businesses)
        // Loaded smoothly in the background without blocking the UI thread
        setTimeout(async () => {
          if (!isMounted) return;
          try {
            await Promise.allSettled([
              fetchCol('media', setMedia, query(collection(db, 'media'), orderBy('date', 'desc'), limit(30))),
              fetchCol('songs', setSongs, query(collection(db, 'songs'), limit(50))),
              fetchCol('albums', setAlbums, query(collection(db, 'albums'), limit(30))),
              fetchCol('playlists', setPlaylists, query(collection(db, 'playlists'), limit(30))),
              fetchCol('books', setBooks, query(collection(db, 'books'), limit(30))),
              fetchCol('media_playlists', setMediaPlaylists, query(collection(db, 'media_playlists'), limit(30))),
              fetchCol('products', setProducts, query(collection(db, 'products'), limit(30))),
              fetchCol('businesses', setBusinesses, query(collection(db, 'businesses'), limit(30))),
              fetchCol('business_updates', setBusinessUpdates, query(collection(db, 'business_updates'), limit(30))),
              fetchCol('business_reports', setBusinessReports, query(collection(db, 'business_reports'), limit(30))),
              fetchCol('world_countries', (data) => {
                if (!data || data.length === 0) {
                  setWorldCountries(defaultWorldCountries);
                } else {
                  const merged = [...defaultWorldCountries];
                  data.forEach((vc: any) => {
                    const idx = merged.findIndex(m => m.id === vc.id);
                    if (idx >= 0) merged[idx] = { ...merged[idx], ...vc };
                    else merged.push(vc);
                  });
                  setWorldCountries(merged);
                }
              }),
              fetchCol('world_groups', setWorldGroups, query(collection(db, 'world_groups'), limit(30))),
              fetchCol('world_posts', setWorldPosts, query(collection(db, 'world_posts'), orderBy('createdAt', 'desc'), limit(30))),
              fetchCol('world_events', setWorldEvents, query(collection(db, 'world_events'), orderBy('date', 'asc'), limit(20))),
              fetchCol('world_help_requests', setWorldHelpRequests, query(collection(db, 'world_help_requests'), orderBy('createdAt', 'desc'), limit(20))),
              fetchCol('world_applications', setWorldApplications, query(collection(db, 'world_applications'), limit(20)))
            ]);
          } catch (bgErr) {
            console.warn('Background data fetch notice:', bgErr);
          }
        }, 500);

      } catch (err) {
        console.warn('Error fetching static data:', err);
        if (isMounted) setDataLoaded(true);
      }
    };

    fetchStaticData();

    return () => {
      isMounted = false;
      unsubs.forEach(unsub => {
        try {
          unsub();
        } catch (e) {}
      });
    };
  }, []); // Strictly empty dependency array: starts once, never affected by Auth state changes

  // 2. User-specific Data Effect - Starts/stops purely based on Auth state without touching public data
  useEffect(() => {
    let userUnsubs: (() => void)[] = [];
    let currentSubscribedUid: string | null = null;

    const unsubAuth = auth.onAuthStateChanged((currentUser) => {
      const newUid = currentUser ? currentUser.uid : null;

      // Avoid redundant resubscription if UID hasn't changed
      if (newUid === currentSubscribedUid) return;
      currentSubscribedUid = newUid;

      // Clean up existing user listeners
      userUnsubs.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      userUnsubs = [];

      if (!currentUser) {
        // User logged out: clear user-specific data and do not touch public listeners
        if (import.meta.env.DEV) {
          console.debug('[Firestore] User logged out: cleaned up user listeners.');
        }
        setOrders([]);
        return;
      }

      if (import.meta.env.DEV) {
        console.debug('[Firestore] User listeners started for UID:', currentUser.uid);
      }

      // User Profile listener
      try {
        const unsubProfile = onSnapshot(
          doc(db, 'users', currentUser.uid),
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as any;
              updateProfile({ ...userData, uid: currentUser.uid });
            }
          },
          (err) => {
            if (err?.code !== 'permission-denied') {
              handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
            }
          }
        );
        userUnsubs.push(unsubProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
      }

      // Orders listener (limited to user's orders)
      try {
        const ordersQuery = query(
          collection(db, 'orders'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const unsubOrders = onSnapshot(
          ordersQuery,
          (s) => {
            setOrders(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
          },
          (err) => {
            if (err?.code !== 'permission-denied') {
              handleFirestoreError(err, OperationType.LIST, 'orders');
            }
          }
        );
        userUnsubs.push(unsubOrders);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'orders');
      }

      // Activity timestamp update (strictly throttled to once every 2 hours)
      const lastUpdateKey = `last_active_update_${currentUser.uid}`;
      try {
        const lastUpdate = typeof window !== 'undefined' ? localStorage.getItem(lastUpdateKey) : null;
        const now = Date.now();
        if (!lastUpdate || now - parseInt(lastUpdate, 10) > 7200000) {
          updateDoc(doc(db, 'users', currentUser.uid), { lastActive: new Date().toISOString() })
            .then(() => {
              try {
                if (typeof window !== 'undefined') localStorage.setItem(lastUpdateKey, now.toString());
              } catch (e) {}
            })
            .catch(() => {});
        }
      } catch (e) {}
    });

    return () => {
      unsubAuth();
      userUnsubs.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      userUnsubs = [];
    };
  }, [setOrders, updateProfile]);
}
