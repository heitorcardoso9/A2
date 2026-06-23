import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function useUserProfile(userId) {
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        if (!userId) return;
        const unsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
            setProfile(snap.exists() ? snap.data() : null);
        });
        return unsubscribe;
    }, [userId]);

    return profile;
}