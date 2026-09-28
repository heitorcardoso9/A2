import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const cache = new Map();
const subscribers = new Map();

function ensureListener(userId) {
  if (cache.has(userId)) return;
  const unsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
    const data = snap.exists() ? snap.data() : null;
    const entry = cache.get(userId);
    entry.data = data;
    const cbs = subscribers.get(userId);
    if (cbs) cbs.forEach((cb) => cb(data));
  });
  cache.set(userId, { data: undefined, unsubscribe, refs: 0 });
}

export default function useUserProfile(userId) {
  const [profile, setProfile] = useState(() => {
    if (!userId) return null;
    const entry = cache.get(userId);
    return entry && entry.data !== undefined ? entry.data : null;
  });

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    ensureListener(userId);

    const entry = cache.get(userId);
    entry.refs += 1;

    let cbs = subscribers.get(userId);
    if (!cbs) {
      cbs = new Set();
      subscribers.set(userId, cbs);
    }
    cbs.add(setProfile);

    if (entry.data !== undefined) setProfile(entry.data);

    return () => {
      const callbacks = subscribers.get(userId);
      if (callbacks) {
        callbacks.delete(setProfile);
        if (callbacks.size === 0) subscribers.delete(userId);
      }
      const e = cache.get(userId);
      if (e) {
        e.refs -= 1;
        if (e.refs <= 0) {
          e.unsubscribe();
          cache.delete(userId);
        }
      }
    };
  }, [userId]);

  return profile;
}
