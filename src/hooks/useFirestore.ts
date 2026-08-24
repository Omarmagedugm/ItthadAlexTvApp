import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, limit, updateDoc, where, getDocs, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAppStore } from '../store';
import { defaultWorldCountries } from '../data/defaultWorldFansData';

export function useFirestoreSync() {
  const { 
    setNews, setMedia, setMatches, setClubs, setPolls, setPredictions, setFanPosts,
    setUsers, setSettings, setAiConfig, updateLiveStreams, updateProfile, setCityInfo, setAds, setCustomPages,
    setNewsCategories, setNewsTags, setHomeSections, setSidebarMenuItems, setProducts, setSongs, setAlbums, setPlaylists, setMediaPlaylists, setBooks,
    setClubStats, setClubTitles, setHistoryEvents, setStadiums, setDataLoaded, setOrders,
    setClubCommittees, setClubAnnouncements, setClubServices, setClubTrips, setClubMembersSettings, setMemberDiscounts,
    setBusinesses, setBusinessUpdates, setBusinessReports,
    setWorldCountries, setWorldGroups, setWorldPosts, setWorldEvents, setWorldHelpRequests, setWorldApplications,
    setAuditLogs
  } = useAppStore();

  const isInitialFetchDoneRef = useRef(false);

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

    // 1. Essential Dynamic Listeners ONLY (Matches, News, Live Settings, Interactive Posts)
    // Avoid blanket listeners on static collections to protect Firestore read quota
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

      unsubs.push(
        unsubLiveFootball,
        unsubLiveBasketball,
        unsubLivePrograms,
        unsubLayout,
        unsubGlobalSettings,
        unsubMatches,
        unsubNews,
        unsubFanPosts,
        unsubPolls,
        unsubPredictions
      );

      // User Profile listener (only if logged in)
      const currentUser = auth.currentUser;
      if (currentUser) {
        const unsubProfile = subscribeSnapshot(
          doc(db, 'users', currentUser.uid), 
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as any;
              updateProfile({ ...userData, uid: currentUser.uid });
            }
          }, 
          `users/${currentUser.uid}`, 
          OperationType.GET
        );
        unsubs.push(unsubProfile);

        // Orders listener (limited to user's orders)
        const ordersQuery = query(
          collection(db, 'orders'), 
          where('userId', '==', currentUser.uid), 
          orderBy('createdAt', 'desc'), 
          limit(20)
        );
        unsubs.push(subscribeSnapshot(ordersQuery, (s) => setOrders(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any), 'orders'));

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
      }
    };

    setupRealtimeSync();

    // 2. Fetch Reference / Static Data ONCE (getDocs with limits, no realtime subscription loops)
    const fetchStaticData = async () => {
      if (isInitialFetchDoneRef.current) return;

      const fetchCol = async (col: string, setter: (d: any) => void, q?: any) => {
        try {
          const s = await getDocs(q || query(collection(db, col), limit(100)));
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
        await Promise.allSettled([
          // Settings & Info
          fetchDocItem('settings/ai_config', setAiConfig),
          fetchDocItem('settings/newsCategories', (s) => s?.list && setNewsCategories(s.list)),
          fetchDocItem('settings/newsTags', (s) => s?.tags && setNewsTags(s.tags)),
          fetchDocItem('settings/sidebar_layout', (s) => s?.items && setSidebarMenuItems(s.items)),
          fetchDocItem('city_info/alexandria', setCityInfo),
          fetchDocItem('club_members_settings/main', setClubMembersSettings),
          
          // Media & Music
          fetchCol('media', setMedia, query(collection(db, 'media'), orderBy('date', 'desc'), limit(60))),
          fetchCol('songs', setSongs, query(collection(db, 'songs'), limit(100))),
          fetchCol('albums', setAlbums, query(collection(db, 'albums'), limit(50))),
          fetchCol('playlists', setPlaylists, query(collection(db, 'playlists'), limit(50))),
          fetchCol('books', setBooks, query(collection(db, 'books'), limit(50))),
          fetchCol('media_playlists', setMediaPlaylists, query(collection(db, 'media_playlists'), limit(50))),
          
          // Club & Business & Static Sections
          fetchCol('clubs', setClubs),
          fetchCol('products', setProducts),
          fetchCol('ads', setAds, query(collection(db, 'ads'), where('active', '==', true), orderBy('order', 'asc'))),
          fetchCol('custom_pages', setCustomPages, query(collection(db, 'custom_pages'), orderBy('createdAt', 'desc'), limit(30))),
          fetchCol('businesses', setBusinesses, query(collection(db, 'businesses'), limit(50))),
          fetchCol('business_updates', setBusinessUpdates, query(collection(db, 'business_updates'), limit(50))),
          fetchCol('business_reports', setBusinessReports, query(collection(db, 'business_reports'), limit(50))),
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
          fetchCol('world_groups', setWorldGroups, query(collection(db, 'world_groups'), limit(50))),
          fetchCol('world_posts', setWorldPosts, query(collection(db, 'world_posts'), orderBy('createdAt', 'desc'), limit(40))),
          fetchCol('world_events', setWorldEvents, query(collection(db, 'world_events'), orderBy('date', 'asc'), limit(30))),
          fetchCol('world_help_requests', setWorldHelpRequests, query(collection(db, 'world_help_requests'), orderBy('createdAt', 'desc'), limit(30))),
          fetchCol('world_applications', setWorldApplications, query(collection(db, 'world_applications'), limit(30))),
          fetchCol('club_services', setClubServices),
          fetchCol('club_stadiums', setStadiums),
          fetchCol('club_timeline', setHistoryEvents),
          fetchCol('club_titles', setClubTitles),
          fetchCol('club_stats', setClubStats),
          fetchCol('club_committees', setClubCommittees),
          fetchCol('club_announcements', setClubAnnouncements),
          fetchCol('club_trips', setClubTrips),
          fetchCol('member_discounts', setMemberDiscounts)
        ]);
      } catch (err) {
        console.warn('Error fetching static data:', err);
      } finally {
        if (isMounted) {
          isInitialFetchDoneRef.current = true;
          setDataLoaded(true);
        }
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
  }, [auth.currentUser?.uid]);
}
