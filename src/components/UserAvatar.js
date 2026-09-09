import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as RNExpoImage } from 'expo-image';
import useUserProfile from '../hooks/useUserProfile';
import { colors, fontWeight } from '../constants/theme';

export default function UserAvatar({ userId, fallbackEmail, size = 38 }) {
  const profile = useUserProfile(userId);
  const email = profile?.email || fallbackEmail || '';
  const iniciais = email.trim().slice(0, 2).toUpperCase() || '?';
  const photoUrl = profile?.profilePhotoUrl;
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl) {
    return <RNExpoImage source={{ uri: photoUrl }} style={dimensionStyle} contentFit="cover" />;
  }
  return (
    <View style={[styles.placeholder, dimensionStyle]}>
      <Text style={[styles.text, { fontSize: size * 0.34 }]}>{iniciais}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: fontWeight.bold, color: colors.primaryDark },
});