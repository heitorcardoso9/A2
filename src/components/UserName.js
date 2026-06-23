import React from 'react';
import { Text } from 'react-native';
import useUserProfile from '../hooks/useUserProfile';

export default function UserName({ userId, fallbackEmail, style }) {
  const profile = useUserProfile(userId);
  const nome = profile?.username || (profile?.email || fallbackEmail || '').split('@')[0] || 'Usuário';
  return <Text style={style}>{nome}</Text>;
}