import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform, LogBox, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
    // Garante compatibilidade: campo antigo `username` / `profilePhotoUrl` continuam valendo
    // Copia eles pros campos novos `name` / `avatarUrl` se esses estiverem vazios (unifica)
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
      migrateUserProfile(currentUser);
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