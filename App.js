import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform, LogBox, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from './src/services/firebase';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/constants/theme';

LogBox.ignoreLogs([
  'Response.blob() is using React',
  'Warning: Response.blob() is using',
  'Non-serializable values were found in the navigation state',
  'AsyncStorage has been extracted from react-native core',
  'Firebase:',
  '@firebase/firestore:',
  'BloomFilter',
  'BloomFilterError',
  'initializeAuth',
]);

function friendlyNameFromEmail(email) {
  try {
    if (!email || typeof email !== 'string') return null;
    const at = email.indexOf('@');
    const local = at > -1 ? email.slice(0, at) : email;
    const cleaned = local.replace(/[._+\-0-9]+/g, ' ').trim();
    if (!cleaned) {
      const simple = local.replace(/[._+\-]+/g, ' ').trim();
      if (simple) return simple.charAt(0).toUpperCase() + simple.slice(1).toLowerCase();
      return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
    }
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  } catch (_) { return null; }
}

async function migrateUserProfile(u) {
  if (!u) return;
  try {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const patch = {};
    if (!data.name) {
      const existingUsername = data.username && typeof data.username === 'string' && data.username.trim();
      const newName = existingUsername
        || (u.displayName && u.displayName.trim())
        || friendlyNameFromEmail(u.email)
        || null;
      if (newName) patch.name = newName;
    }
    if (!data.email && u.email) patch.email = u.email;
    if (!data.avatarUrl) {
      const existingPhoto = data.profilePhotoUrl || u.photoURL || null;
      if (existingPhoto) patch.avatarUrl = existingPhoto;
    }
    if (Object.keys(patch).length > 0) {
      console.log('[App] migrando perfil, patch:', patch);
      await setDoc(ref, patch, { merge: true });
    }
  } catch (e) {
    console.warn('[App] migrateUserProfile erro:', e);
  }
}

async function cleanupDuplicateParticipations(userId) {
  if (!userId) return;
  try {
    const q = query(collection(db, 'participations'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const todos = [];
    for (const d of snap.docs) {
      todos.push({ id: d.id, ...d.data() });
    }
    const porAtividade = new Map();
    for (const p of todos) {
      if (!porAtividade.has(p.activityId)) porAtividade.set(p.activityId, []);
      porAtividade.get(p.activityId).push(p);
    }
    const STATUS_PRIORITY = { confirmado: 4, espera: 3, pendente: 2, recusado: 1 };
    let deletadas = 0;
    const promessasDelete = [];
    for (const [, grupo] of porAtividade) {
      if (grupo.length <= 1) continue;
      grupo.sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] || 0;
        const pb = STATUS_PRIORITY[b.status] || 0;
        if (pb !== pa) return pb - pa;
        const ca = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
        const cb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
        return cb - ca;
      });
      const paraDeletar = grupo.slice(1);
      for (const extra of paraDeletar) {
        promessasDelete.push(deleteDoc(doc(db, 'participations', extra.id)));
        deletadas += 1;
      }
    }
    if (deletadas > 0) {
      console.log(`[App] Limpando ${deletadas} participations duplicadas...`);
      await Promise.all(promessasDelete);
      console.log(`[App] ${deletadas} participations duplicadas apagadas.`);
    }
  } catch (e) {
    console.warn('[App] cleanupDuplicateParticipations erro:', e);
  }
}

let _unsubscribeMyReviews = null;

function subscribeMyReviewAggregates(userId) {
  if (!userId) return;
  try {
    if (_unsubscribeMyReviews) {
      try { _unsubscribeMyReviews(); } catch (_) {}
      _unsubscribeMyReviews = null;
    }
    const q = query(collection(db, 'reviews'), where('reviewedId', '==', userId));
    let lastSignature = null;
    _unsubscribeMyReviews = onSnapshot(q, async (snap) => {
      try {
        const reviews = [];
        snap.forEach((d) => reviews.push({ id: d.id, ...d.data() }));
        // Assinatura por conteúdo: edições de nota/selos (mesma contagem) também atualizam.
        const signature = reviews
          .map((r) => `${r.id}:${r.rating}:${(r.badges || []).join(',')}`)
          .sort()
          .join('|');
        if (signature === lastSignature) return;
        lastSignature = signature;
        let sum = 0;
        const badgesCount = {};
        let withRating = 0;
        for (const r of reviews) {
          const rt = Number(r.rating || 0);
          if (rt >= 1 && rt <= 5) {
            sum += rt;
            withRating += 1;
          }
          if (Array.isArray(r.badges) && r.badges.length > 0) {
            for (const b of r.badges.slice(0, 5)) {
              badgesCount[b] = (badgesCount[b] || 0) + 1;
            }
          }
        }
        const avg = withRating > 0 ? Math.round((sum / withRating) * 10) / 10 : 0;
        const patch = {
          _reviewSum: sum,
          _reviewCount: withRating,
          avgRating: avg,
          _badgesCount: badgesCount,
        };
        if (__DEV__) {
          console.log(`[App] 🧮 Atualizando meus aggregates review: count=${withRating} avg=${avg}`);
        }
        // updateDoc substitui o mapa _badgesCount inteiro (setDoc+merge manteria chaves antigas).
        await updateDoc(doc(db, 'users', userId), patch);
      } catch (e) {
        console.warn('[App] subscribeMyReviewAggregates erro interno:', e);
      }
    }, (e) => {
      console.warn('[App] subscribeMyReviewAggregates listener erro:', e);
    });
    if (__DEV__) console.log('[App] 👂 Listener aggregates reviews ativado para uid=' + userId);
  } catch (e) {
    console.warn('[App] subscribeMyReviewAggregates setup erro:', e);
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    StatusBar.setBarStyle('dark-content', true);
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#FFFFFF', true);
      try {
        NavigationBar.setBackgroundColorAsync('#FFFFFF');
        NavigationBar.setButtonStyleAsync('light');
        NavigationBar.setVisibilityAsync('visible');
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
      if (currentUser) {
        migrateUserProfile(currentUser);
        cleanupDuplicateParticipations(currentUser.uid);
        subscribeMyReviewAggregates(currentUser.uid);
      } else {
        if (_unsubscribeMyReviews) {
          try { _unsubscribeMyReviews(); } catch (_) {}
          _unsubscribeMyReviews = null;
        }
      }
    });
    return unsubscribe;
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppNavigator isLoggedIn={!!user} />
    </NavigationContainer>
  );
}