import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, limit, updateDoc, where, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAppStore } from '../store';
import { defaultWorldCountries, defaultWorldGroups, defaultWorldPosts, defaultWorldEvents, defaultWorldHelpRequests } from '../data/defaultWorldFansData';

export function useFirestoreSync() {
  const { 
    setNews, setMedia, setMatches, setClubs, setPolls, setPredictions, setFanPosts,
    setUsers, setSettings, setAiConfig, updateLiveStream, updateLiveStreams, updateProfile, setCityInfo, setAds, setCustomPages,
    setNewsCategories, setNewsTags, setHomeSections, setSidebarMenuItems, setProducts, setSongs, setAlbums, setPlaylists, setMediaPlaylists, setBooks,
    setClubStats, setClubTitles, setHistoryEvents, setStadiums, setDataLoaded, setOrders,
    setClubCommittees, setClubAnnouncements, setClubServices, setClubTrips, setClubMembersSettings, setMemberDiscounts,
    setBusinesses, setBusinessUpdates, setBusinessReports,
    setWorldCountries, setWorldGroups, setWorldPosts, setWorldEvents, setWorldHelpRequests, setWorldApplications
  } = useAppStore();

  const isFetchedRef = useRef(false);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

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
            try {
              onNext(snap);
            } catch (e) {
              console.warn(`Snapshot callback error for ${path}:`, e);
            }
          }, 
          (err) => {
            handleFirestoreError(err, op, path);
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

    // Optimized Real-time Sync: Strictly limit to dynamic & live content
    const setupRealtimeSync = () => {
      const unsubProfile = (uid: string) => subscribeSnapshot(doc(db, 'users', uid), (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as any;
          updateProfile({ ...userData, uid });
          
          const email = auth.currentUser?.email?.toLowerCase();
          if ((email === 'copyrightofficialco@gmail.com' || email === 'omarmagedugm@ittihad.club') && userData.role !== 'admin') {
            updateDoc(doc(db, 'users', uid), { role: 'admin' }).catch(() => {});
          }
        }
      }, `users/${uid}`, OperationType.GET);

      const unsubLiveFootball = subscribeSnapshot(doc(db, 'settings', 'liveStream'), (snap) => {
        if (snap.exists()) updateLiveStreams({ football: snap.data() as any });
      }, 'settings/liveStream', OperationType.GET);

      const unsubLiveBasketball = subscribeSnapshot(doc(db, 'settings', 'liveStream_basketball'), (snap) => {
        if (snap.exists()) updateLiveStreams({ basketball: snap.data() as any });
      }, 'settings/liveStream_basketball', OperationType.GET);

      // Quota Optimization: Added strict limit(25) to prevent reading large collections on every sync
      const unsubMatches = subscribeSnapshot(query(collection(db, 'matches'), orderBy('date', 'desc'), limit(25)), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0 || !isFetchedRef.current) setMatches(data as any);
      }, 'matches');

      const unsubNews = subscribeSnapshot(query(collection(db, 'news'), orderBy('date', 'desc'), limit(25)), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0 || !isFetchedRef.current) setNews(data as any);
      }, 'news');

      const unsubMedia = subscribeSnapshot(query(collection(db, 'media'), orderBy('date', 'desc'), limit(25)), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0 || !isFetchedRef.current) setMedia(data as any);
      }, 'media');

      const unsubLayout = subscribeSnapshot(doc(db, 'settings', 'homeLayout'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.sections) {
            const uniqueSectionsMap = new Map();
            data.sections.forEach((s: any) => { if (s && s.id) uniqueSectionsMap.set(s.id, s); });
            const mergedSections = Array.from(uniqueSectionsMap.values());
            const initialSections = [
              { id: 'hero', type: 'hero', active: true, order: 0 },
              { id: 'ads', type: 'ads', active: true, order: 0.5 },
              { id: 'matches', type: 'matches', active: true, order: 1 },
              { id: 'ai_banner', type: 'ai_banner', active: true, order: 1.2 },
              { id: 'city', type: 'city', active: true, order: 1.5, title: 'عروس البحر المتوسط' },
              { id: 'news', type: 'news', active: true, order: 2 },
              { id: 'media', type: 'media', active: true, order: 3 },
            ];
            initialSections.forEach(ds => { if (!uniqueSectionsMap.has(ds.id)) mergedSections.push(ds); });
            setHomeSections(mergedSections);
          }
        }
      }, 'settings/homeLayout', OperationType.GET);

      // Realtime listeners strictly for frequently changing social/interactive and core member data
      unsubs.push(subscribeSnapshot(query(collection(db, 'fan_posts'), orderBy('createdAt', 'desc'), limit(100)), s => setFanPosts(s.docs.map(d => ({id: d.id, ...(d.data() as any)})) as any), 'fan_posts'));
      unsubs.push(subscribeSnapshot(query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(20)), s => setPolls(s.docs.map(d => ({id: d.id, ...(d.data() as any)})) as any), 'polls'));
      unsubs.push(subscribeSnapshot(query(collection(db, 'predictions'), orderBy('createdAt', 'desc'), limit(100)), s => setPredictions(s.docs.map(d => ({id: d.id, ...(d.data() as any)})) as any), 'predictions'));
      unsubs.push(subscribeSnapshot(collection(db, 'users'), s => setUsers(s.docs.map(d => ({id: d.id, uid: d.id, ...(d.data() as any)})) as any), 'users'));
      
      unsubs.push(unsubLiveFootball, unsubLiveBasketball, unsubMatches, unsubNews, unsubMedia, unsubLayout);

      const unsubNewsCategories = subscribeSnapshot(doc(db, 'settings', 'newsCategories'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.list)) {
            setNewsCategories(data.list);
          }
        }
      }, 'settings/newsCategories', OperationType.GET);

      const unsubNewsTags = subscribeSnapshot(doc(db, 'settings', 'newsTags'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.tags)) {
            setNewsTags(data.tags);
          }
        }
      }, 'settings/newsTags', OperationType.GET);

      const unsubSidebarLayout = subscribeSnapshot(doc(db, 'settings', 'sidebar_layout'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.items)) {
            setSidebarMenuItems(data.items);
          }
        }
      }, 'settings/sidebar_layout', OperationType.GET);

      const unsubGlobalSettings = subscribeSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data) {
            setSettings({ id: snap.id, ...data });
          }
        }
      }, 'settings/global', OperationType.GET);

      unsubs.push(unsubNewsCategories, unsubNewsTags, unsubSidebarLayout, unsubGlobalSettings);

      // Realtime listeners for Ittihad Business, updates, and reports
      unsubs.push(subscribeSnapshot(collection(db, 'businesses'), s => {
        setBusinesses(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'businesses'));
      unsubs.push(subscribeSnapshot(collection(db, 'business_updates'), s => {
        setBusinessUpdates(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'business_updates'));
      unsubs.push(subscribeSnapshot(collection(db, 'business_reports'), s => {
        setBusinessReports(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'business_reports'));

      // Realtime listeners for World Fans (Groups, Countries, Posts, Events, Help Requests, Applications)
      unsubs.push(subscribeSnapshot(collection(db, 'world_countries'), s => {
        const rawData = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        
        if (rawData.length === 0) {
          // If Firestore collection is completely empty, provide fallback
          setWorldCountries(defaultWorldCountries);
        } else {
          // Clean up old Germany documents if they still exist in Firestore
          const deDoc = rawData.find(c => c.id === 'de' || c.id === 'germany' || c.code === 'DE' || c.name === 'ألمانيا' || c.nameAr === 'ألمانيا');
          if (deDoc) {
            import('firebase/firestore').then(({ deleteDoc }) => {
              deleteDoc(doc(db, 'world_countries', deDoc.id)).catch(() => {});
            });
          }

          // Use real Firestore data, sorted by order
          const validCountries = rawData
            .filter(c => c.id !== 'de' && c.id !== 'germany' && c.code !== 'DE' && c.name !== 'ألمانيا' && c.nameAr !== 'ألمانيا')
            .sort((a, b) => (a.order || 99) - (b.order || 99));

          setWorldCountries(validCountries);
        }
      }, 'world_countries'));

      unsubs.push(subscribeSnapshot(collection(db, 'world_groups'), s => {
        const rawData = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

        if (rawData.length === 0) {
          setWorldGroups([]);
        } else {
          // Clean up old Germany groups if any
          const oldDeGroup = rawData.find(g => g.countryId === 'de' || g.countryName === 'ألمانيا' || g.id === 'group_de_berlin' || g.id === 'group_germany');
          if (oldDeGroup) {
            import('firebase/firestore').then(({ deleteDoc }) => {
              deleteDoc(doc(db, 'world_groups', oldDeGroup.id)).catch(() => {});
            });
          }

          const validGroups = rawData.filter(g => 
            g.countryId !== 'de' && 
            g.countryId !== 'germany' && 
            g.countryName !== 'ألمانيا' && 
            g.id !== 'group_de_berlin' && 
            g.id !== 'group_germany'
          );

          setWorldGroups(validGroups);
        }
      }, 'world_groups'));

      unsubs.push(subscribeSnapshot(query(collection(db, 'world_posts'), orderBy('createdAt', 'desc'), limit(100)), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0) setWorldPosts(data as any);
      }, 'world_posts'));

      unsubs.push(subscribeSnapshot(query(collection(db, 'world_events'), orderBy('date', 'asc'), limit(50)), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0) setWorldEvents(data as any);
      }, 'world_events'));

      unsubs.push(subscribeSnapshot(query(collection(db, 'world_help_requests'), orderBy('createdAt', 'desc'), limit(50)), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0) setWorldHelpRequests(data as any);
      }, 'world_help_requests'));

      unsubs.push(subscribeSnapshot(collection(db, 'world_applications'), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setWorldApplications(data as any);
      }, 'world_applications'));

      const currentUser = auth.currentUser;
      if (currentUser) {
        unsubs.push(unsubProfile(currentUser.uid));
        
        // Activity Update: Throttled to 30 minutes (1800000ms) to cut write operations by 83%
        const lastUpdateKey = `last_active_update_${currentUser.uid}`;
        try {
          const lastUpdate = typeof window !== 'undefined' ? localStorage.getItem(lastUpdateKey) : null;
          const now = Date.now();
          if (!lastUpdate || now - parseInt(lastUpdate) > 1800000) {
            updateDoc(doc(db, 'users', currentUser.uid), { lastActive: new Date().toISOString() })
              .then(() => {
                try {
                  if (typeof window !== 'undefined') localStorage.setItem(lastUpdateKey, now.toString());
                } catch (e) {}
              })
              .catch(() => {});
          }
        } catch (e) {
          console.warn('Activity update tracking failed', e);
        }

        // Orders sync with strict limit
        setTimeout(() => {
          const profile = useAppStore.getState().profile;
          const isAdmin = profile?.role === 'admin' || (profile?.roles && profile.roles.includes('admin'));
          const ordersQuery = isAdmin 
            ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(30))
            : query(collection(db, 'orders'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(30));
            
          unsubs.push(subscribeSnapshot(ordersQuery, (s) => setOrders(s.docs.map(d => ({id: d.id, ...(d.data() as any)})) as any), 'orders'));
        }, 1500);
      }
    };

    setupRealtimeSync();

    const dataLoadTimeout = setTimeout(() => {
      if (!isFetchedRef.current) {
        console.warn('Initial data load taking too long (6s), forcing ready state');
        setDataLoaded(true);
      }
    }, 6000);

    // Static Reference Data Fetching with 1-hour LocalStorage cache
    const fetchStaticData = async () => {
      const fetchWithCache = async (key: string, fetcher: () => Promise<any>) => {
        const cacheKey = `fs_cache_${key}`;
        try {
          const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // 1 hour cache (3600000ms) to prevent re-fetching static data on every reload
            if (Date.now() - timestamp < 3600000 && data) {
              return data;
            }
          }
        } catch (e) {
          console.warn('Cache read failed', e);
        }

        const data = await fetcher();
        try { 
          if (typeof window !== 'undefined' && data) {
            localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() })); 
          }
        } catch (e) {
          console.warn('Cache write failed', e);
        }
        return data;
      };

      const fetchCol = async (col: string, setter: (d: any) => void, q?: any) => {
        try {
          const data = await fetchWithCache(col, async () => {
            const s = await getDocs(q || collection(db, col));
            return s.docs.map(d => ({ id: d.id, uid: d.id, ...(d.data() as any) }));
          });
          if (data && data.length > 0) setter(data);
        } catch (e) { console.warn(`Fetch ${col} failed`, e); }
      };

      const fetchDocItem = async (path: string, setter: (d: any) => void) => {
        try {
          const parts = path.split('/');
          const data = await fetchWithCache(path.replace('/', '_'), async () => {
            const s = await getDoc(doc(db, parts[0], parts[1]));
            return s.exists() ? { id: s.id, ...(s.data() as any) } : null;
          });
          if (data) setter(data);
        } catch (e) { console.warn(`Fetch doc ${path} failed`, e); }
      };

      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('fs_cache_users');
          localStorage.removeItem('fs_cache_businesses');
          localStorage.removeItem('fs_cache_business_updates');
          localStorage.removeItem('fs_cache_business_reports');
          localStorage.removeItem('fs_cache_world_countries');
          localStorage.removeItem('fs_cache_world_groups');
          localStorage.removeItem('fs_cache_world_posts');
          localStorage.removeItem('fs_cache_world_events');
          localStorage.removeItem('fs_cache_world_help_requests');
          localStorage.removeItem('fs_cache_world_applications');
        }
      } catch (e) {}

      await Promise.allSettled([
        fetchDocItem('settings/global', setSettings),
        fetchDocItem('settings/ai_config', setAiConfig),
        fetchDocItem('city_info/alexandria', setCityInfo),
        fetchDocItem('club_members_settings/main', setClubMembersSettings),
        fetchCol('clubs', setClubs),
        fetchCol('products', setProducts),
        fetchCol('ads', setAds, query(collection(db, 'ads'), where('active', '==', true), orderBy('order', 'asc'))),
        fetchCol('custom_pages', setCustomPages),
        fetchCol('songs', setSongs),
        fetchCol('books', setBooks),
        fetchCol('media_playlists', setMediaPlaylists),
        (async () => {
          try {
            const snap = await getDoc(doc(db, 'settings', 'newsCategories'));
            if (snap.exists() && Array.isArray(snap.data()?.list)) {
              setNewsCategories(snap.data().list);
            }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const snap = await getDoc(doc(db, 'settings', 'newsTags'));
            if (snap.exists() && Array.isArray(snap.data()?.tags)) {
              setNewsTags(snap.data().tags);
            }
          } catch (e) {}
        })(),
        (async () => {
          try {
            const snap = await getDoc(doc(db, 'settings', 'sidebar_layout'));
            if (snap.exists() && Array.isArray(snap.data()?.items)) {
              setSidebarMenuItems(snap.data().items);
            }
          } catch (e) {}
        })(),
        fetchCol('club_titles', setClubTitles),
        fetchCol('club_stats', setClubStats),
        fetchCol('club_stadiums', setStadiums),
        fetchCol('club_timeline', setHistoryEvents),
        fetchCol('club_committees', setClubCommittees),
        fetchCol('club_announcements', setClubAnnouncements),
        fetchCol('club_services', setClubServices),
        fetchCol('club_trips', setClubTrips),
        fetchCol('member_discounts', setMemberDiscounts)
      ]);
      
      isFetchedRef.current = true;
      setDataLoaded(true);
    };

    fetchStaticData();

    return () => {
      clearTimeout(dataLoadTimeout);
      unsubs.forEach(unsub => unsub());
    };
  }, [auth.currentUser?.uid]);
}
