import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationBar } from 'expo-navigation-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/services/firebase';
import AppNavigator from './src/navigation/AppNavigator';

LogBox.ignoreLogs([
  'Response.blob() is using React',
  'Warning: Response.blob() is using',
  'Non-serializable values were found in the navigation state',
  'AsyncStorage has been extracted from react-native core',
  'Firebase:',
  'initializeAuth',
]);

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setStyle('dark');
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
        <ActivityIndicator size="large" color="#0E5C46" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator isLoggedIn={!!user} />
    </NavigationContainer>
  );
}