import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, limit, updateDoc, where, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAppStore } from '../store';
import { defaultWorldCountries } from '../data/defaultWorldFansData';
import { DEFAULT_MEDIA_ITEMS, DEFAULT_MEDIA_PLAYLISTS } from '../data/defaultMediaData';
import { DEFAULT_RADIO_STATIONS } from '../data/defaultRadioData';

export function useFirestoreSync() {
  const { 
    setNews, setMedia, setMatches, setClubs, setPolls, setPredictions, setFanPosts,
    setUsers, setSettings, setAiConfig, updateLiveStream, updateLiveStreams, updateProfile, setCityInfo, setAds, setCustomPages,
    setNewsCategories, setNewsTags, setHomeSections, setSidebarMenuItems, setRadioStations, setProducts, setSongs, setAlbums, setPlaylists, setMediaPlaylists, setBooks,
    setClubStats, setClubTitles, setHistoryEvents, setStadiums, setDataLoaded, setOrders,
    setClubCommittees, setClubAnnouncements, setClubServices, setClubTrips, setClubMembersSettings, setMemberDiscounts,
    setBusinesses, setBusinessUpdates, setBusinessReports,
    setWorldCountries, setWorldGroups, setWorldPosts, setWorldEvents, setWorldHelpRequests, setWorldApplications,
    setAuditLogs
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

      const unsubMedia = subscribeSnapshot(query(collection(db, 'media'), orderBy('date', 'desc'), limit(150)), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0) {
          setMedia(data as any);
        } else {
          // If media collection is empty or deleted, restore default media photos and videos
          setMedia(DEFAULT_MEDIA_ITEMS);
          import('firebase/firestore').then(({ setDoc, doc }) => {
            DEFAULT_MEDIA_ITEMS.forEach(item => {
              setDoc(doc(db, 'media', item.id), item, { merge: true }).catch(() => {});
            });
          });
        }
      }, 'media');

      // Audit Logs & Recycle Bin (سجل نشاط المشرفين وسلة المحذوفات)
      const unsubAuditLogs = subscribeSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(150)), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setAuditLogs(data as any);
      }, 'audit_logs');

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

      // Realtime listeners strictly for frequently changing social/interactive and core member data
      unsubs.push(subscribeSnapshot(query(collection(db, 'fan_posts'), orderBy('createdAt', 'desc'), limit(50)), s => setFanPosts(s.docs.map(d => ({id: d.id, ...(d.data() as any)})) as any), 'fan_posts'));
      unsubs.push(subscribeSnapshot(query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(15)), s => setPolls(s.docs.map(d => ({id: d.id, ...(d.data() as any)})) as any), 'polls'));
      unsubs.push(subscribeSnapshot(query(collection(db, 'predictions'), orderBy('createdAt', 'desc'), limit(50)), s => setPredictions(s.docs.map(d => ({id: d.id, ...(d.data() as any)})) as any), 'predictions'));
      
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
        
        // Clean up old Germany documents if they still exist in Firestore
        const deDoc = rawData.find(c => c.id === 'de' || c.id === 'germany' || c.code === 'DE' || c.name === 'ألمانيا' || c.nameAr === 'ألمانيا');
        if (deDoc) {
          import('firebase/firestore').then(({ deleteDoc }) => {
            deleteDoc(doc(db, 'world_countries', deDoc.id)).catch(() => {});
          });
        }

        // Use Firestore data merged with defaultWorldCountries to ensure Bahrain and all GCC countries are always present
        const validCountries = rawData
          .filter(c => c.id !== 'de' && c.id !== 'germany' && c.code !== 'DE' && c.name !== 'ألمانيا' && c.nameAr !== 'ألمانيا');

        if (validCountries.length === 0) {
          setWorldCountries(defaultWorldCountries);
        } else {
          const merged = [...defaultWorldCountries];
          validCountries.forEach(vc => {
            const idx = merged.findIndex(m => m.id === vc.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...vc };
            } else {
              merged.push(vc);
            }
          });
          merged.sort((a, b) => (a.order || 99) - (b.order || 99));
          setWorldCountries(merged);
        }
      }, 'world_countries'));

      unsubs.push(subscribeSnapshot(collection(db, 'world_groups'), s => {
        const rawData = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

        // Clean up dummy/sample groups if any exist from earlier test seeds
        const dummyGroupIds = ['group_uae_dubai', 'group_sa_riyadh', 'group_kw_kuwait', 'group_uk_london', 'group_eu_frankfurt', 'group_east_asia_tokyo', 'group_de_berlin', 'group_germany'];
        const dummyFound = rawData.filter(g => dummyGroupIds.includes(g.id) || g.countryId === 'de' || g.countryName === 'ألمانيا');
        if (dummyFound.length > 0) {
          import('firebase/firestore').then(({ deleteDoc }) => {
            dummyFound.forEach(dg => {
              deleteDoc(doc(db, 'world_groups', dg.id)).catch(() => {});
            });
          });
        }

        const validGroups = rawData.filter(g => 
          !dummyGroupIds.includes(g.id) &&
          g.countryId !== 'de' && 
          g.countryId !== 'germany' && 
          g.countryName !== 'ألمانيا'
        );

        setWorldGroups(validGroups);
      }, 'world_groups'));

      unsubs.push(subscribeSnapshot(query(collection(db, 'world_posts'), orderBy('createdAt', 'desc'), limit(100)), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setWorldPosts(data as any);
      }, 'world_posts'));

      unsubs.push(subscribeSnapshot(query(collection(db, 'world_events'), orderBy('date', 'asc'), limit(50)), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setWorldEvents(data as any);
      }, 'world_events'));

      unsubs.push(subscribeSnapshot(query(collection(db, 'world_help_requests'), orderBy('createdAt', 'desc'), limit(50)), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setWorldHelpRequests(data as any);
      }, 'world_help_requests'));

      unsubs.push(subscribeSnapshot(collection(db, 'world_applications'), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setWorldApplications(data as any);
      }, 'world_applications'));

      // Realtime listeners for Club Members, Stadiums, History and Audit Logs
      unsubs.push(subscribeSnapshot(collection(db, 'club_services'), s => {
        setClubServices(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_services'));

      unsubs.push(subscribeSnapshot(collection(db, 'club_stadiums'), s => {
        setStadiums(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_stadiums'));

      unsubs.push(subscribeSnapshot(collection(db, 'club_timeline'), s => {
        setHistoryEvents(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_timeline'));

      unsubs.push(subscribeSnapshot(collection(db, 'club_titles'), s => {
        setClubTitles(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_titles'));

      unsubs.push(subscribeSnapshot(collection(db, 'club_stats'), s => {
        setClubStats(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_stats'));

      unsubs.push(subscribeSnapshot(collection(db, 'club_committees'), s => {
        setClubCommittees(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_committees'));

      unsubs.push(subscribeSnapshot(collection(db, 'club_announcements'), s => {
        setClubAnnouncements(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_announcements'));

      unsubs.push(subscribeSnapshot(collection(db, 'club_trips'), s => {
        setClubTrips(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'club_trips'));

      unsubs.push(subscribeSnapshot(collection(db, 'member_discounts'), s => {
        setMemberDiscounts(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
      }, 'member_discounts'));

      // Realtime listener for Custom Pages (الصفحات المخصصة / الإضافية)
      unsubs.push(subscribeSnapshot(query(collection(db, 'custom_pages'), orderBy('createdAt', 'desc')), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setCustomPages(data as any);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('fs_cache_custom_pages', JSON.stringify({ data, timestamp: Date.now() }));
          }
        } catch (e) {}
      }, 'custom_pages'));

      let radioInitializedRef = false;
      unsubs.push(subscribeSnapshot(collection(db, 'radio_stations'), s => {
        const data = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (data.length > 0) {
          data.sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99));
          setRadioStations(data as any);
          radioInitializedRef = true;
        } else if (!radioInitializedRef) {
          // On first load, seed default stations into Firestore so they exist as real Firestore documents
          radioInitializedRef = true;
          setRadioStations(DEFAULT_RADIO_STATIONS);
          import('firebase/firestore').then(({ setDoc, doc }) => {
            DEFAULT_RADIO_STATIONS.forEach(station => {
              setDoc(doc(db, 'radio_stations', station.id), station, { merge: true }).catch(() => {});
            });
          });
        } else {
          setRadioStations([]);
        }
      }, 'radio_stations'));

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

        // Conditional Admin / Manager syncs (prevents permission denied errors & saves client quota)
        setTimeout(() => {
          const profile = useAppStore.getState().profile;
          const isOmar = currentUser.email?.toLowerCase() === 'omarmagedugm@ittihad.club';
          const isDev = currentUser.email?.toLowerCase() === 'copyrightofficialco@gmail.com';
          const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator' || (profile?.roles && (profile.roles.includes('admin') || profile.roles.includes('moderator'))) || isOmar || isDev;
          
          if (isAdmin) {
            unsubs.push(subscribeSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100)), s => {
              setAuditLogs(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any);
            }, 'audit_logs'));
            unsubs.push(subscribeSnapshot(query(collection(db, 'users'), limit(300)), s => {
              setUsers(s.docs.map(d => ({ id: d.id, uid: d.id, ...(d.data() as any) })) as any);
            }, 'users'));
          }

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
          if (data !== undefined && data !== null) setter(data);
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
          localStorage.removeItem('fs_cache_custom_pages');
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
        fetchCol('songs', setSongs),
        fetchCol('books', setBooks),
        fetchCol('media_playlists', setMediaPlaylists)
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
