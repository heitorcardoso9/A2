import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import PhotoViewerModal from '../components/PhotoViewerModal';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

export default function UserProfileScreen({ navigation, route }) {
  const { userId } = route.params;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (err) => {
      setLoading(false);
    });
    return unsubscribe;
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Não foi possível encontrar esse perfil.</Text>
      </SafeAreaView>
    );
  }

  const iniciais = (profile.email || 'US').slice(0, 2).toUpperCase();
  const outrasFotos = (profile.photos || []).filter((p) => p.url !== profile.profilePhotoUrl);
  const allPhotoUrls = profile.profilePhotoUrl
    ? [profile.profilePhotoUrl, ...outrasFotos.map((p) => p.url)]
    : outrasFotos.map((p) => p.url);

  function abrirFoto(index) {
    setViewerIndex(index);
    setViewerVisible(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
        <View style={styles.head}>
          <TouchableOpacity onPress={() => allPhotoUrls.length > 0 && abrirFoto(0)}>
            {profile.profilePhotoUrl ? (
              <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{iniciais}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.username}>{profile.username || (profile.email || '').split('@')[0]}</Text>
          {profile.cidade && profile.uf && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textFaint} />
              <Text style={styles.locationText}>{profile.cidade}, {profile.uf}</Text>
            </View>
          )}
        </View>

        {outrasFotos.length > 0 && (
          <FlatList
            data={outrasFotos}
            horizontal
            keyExtractor={(item) => item.path}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg, flexGrow: 1, justifyContent: 'center' }}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => abrirFoto(index + (profile.profilePhotoUrl ? 1 : 0))}>
                <Image source={{ uri: item.url }} style={styles.thumb} />
              </TouchableOpacity>
            )}
          />
        )}

        <Text style={styles.bio}>{profile.bio || 'Essa pessoa ainda não escreveu uma bio.'}</Text>

        <View style={styles.chipsRow}>
          {profile.interests && profile.interests.length > 0 ? (
            profile.interests.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Nenhum interesse listado</Text>
          )}
        </View>

        {userId !== auth.currentUser.uid && (
          <Button
            label="Conversar"
            onPress={() => navigation.navigate('Chat', { withUserId: userId, withUserEmail: profile.email })}
          />
        )}
      </ScrollView>

      <PhotoViewerModal
        visible={viewerVisible}
        photos={allPhotoUrls}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  head: { alignItems: 'center', marginBottom: spacing.md + 2 },
  username: { fontWeight: fontWeight.bold, fontSize: fontSize.lg, marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  locationText: { fontSize: fontSize.sm, color: colors.textSecondary },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarImg: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.sm },
  avatarText: { fontWeight: fontWeight.bold, fontSize: fontSize.heading, color: colors.primaryDark },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  bio: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md + 2, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: spacing.xl },
  chip: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: fontSize.md },
});