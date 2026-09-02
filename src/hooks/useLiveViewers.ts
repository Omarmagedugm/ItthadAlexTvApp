import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp
} from 'firebase/firestore';

export type LiveSportChannel = 'football' | 'basketball' | 'programs';

// Generate or retrieve a persistent session-based viewer ID per tab
function getSessionViewerId(): string {
  try {
    let sid = sessionStorage.getItem('ittihad_live_viewer_id');
    if (!sid) {
      sid = 'v_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      sessionStorage.setItem('ittihad_live_viewer_id', sid);
    }
    return sid;
  } catch (e) {
    return 'v_' + Math.random().toString(36).substring(2, 10);
  }
}

export function useLiveViewers(
  channel: LiveSportChannel,
  userName?: string
) {
  const [realActiveViewers, setRealActiveViewers] = useState<number>(1);
  const [channelViewers, setChannelViewers] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const viewerIdRef = useRef<string>(getSessionViewerId());

  // 1. Heartbeat & Presence Registration for the active viewer on this page
  useEffect(() => {
    const viewerId = viewerIdRef.current;
    const viewerDocRef = doc(db, 'live_viewers', viewerId);

    const updatePresence = async () => {
      try {
        await setDoc(viewerDocRef, {
          viewerId,
          channel,
          userId: auth.currentUser?.uid || 'guest',
          userName: userName || (auth.currentUser ? 'مشجع اتحادي' : 'زائر'),
          updatedAt: Date.now(),
          lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        // Silently ignore if offline
      }
    };

    // Initial presence write on page mount
    updatePresence();

    // Regular heartbeat every 15 seconds to prove user is still currently in page
    const interval = setInterval(updatePresence, 15000);

    // Immediate cleanup when user closes the tab, navigates away, or unmounts
    const handleUnload = () => {
      try {
        deleteDoc(viewerDocRef).catch(() => {});
      } catch (e) {
        // Ignore
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      handleUnload();
    };
  }, [channel, userName]);

  // 2. Real-time Subscription to active viewers currently in the page
  useEffect(() => {
    setIsLoading(true);

    // Listen to all viewers currently in the live section
    const colRef = collection(db, 'live_viewers');

    const unsubscribe = onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const now = Date.now();
        // A user is considered currently in the page if they sent a heartbeat within the last 35 seconds
        const activeDocs = snapshot.docs.filter((d) => {
          const data = d.data();
          const updatedAt = Number(data.updatedAt || 0);
          
          // Cleanup stale orphaned docs older than 90 seconds
          if (updatedAt && now - updatedAt > 90000) {
            deleteDoc(d.ref).catch(() => {});
            return false;
          }

          if (updatedAt && now - updatedAt < 35000) {
            return true;
          }
          if (data.lastSeen?.toMillis && now - data.lastSeen.toMillis() < 35000) {
            return true;
          }
          return false;
        });

        // Filter channel-specific if needed
        const activeInChannel = activeDocs.filter(d => d.data().channel === channel);

        // Always at least 1 viewer since the current user is active on this page right now
        const totalReal = Math.max(activeDocs.length, 1);
        const channelReal = Math.max(activeInChannel.length, 1);

        setRealActiveViewers(totalReal);
        setChannelViewers(channelReal);
        setIsLoading(false);
      },
      (error) => {
        if (error?.code !== 'permission-denied') {
          console.warn('Live viewers snapshot error:', error);
        }
        setRealActiveViewers(1);
        setChannelViewers(1);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [channel]);

  return {
    totalViewers: realActiveViewers,
    realActiveViewers,
    channelViewers,
    isLoading
  };
}
