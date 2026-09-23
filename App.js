import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform, LogBox, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/services/firebase';
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