import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, Alert } from 'react-native';
import { Image as RNExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import PhotoViewerModal from '../components/PhotoViewerModal';
import UserReviewsModal from '../components/UserReviewsModal';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

export default function ProfileScreen({ navigation }) {
  const myUid = auth.currentUser?.uid;
  const [profile, setProfile] = useState({ bio: '', interests: [], photos: [], profilePhotoUrl: null });
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [reviewsVisible, setReviewsVisible] = useState(false);

  useEffect(() => {
    if (!myUid) return;
    const unsubUser = onSnapshot(doc(db, 'users', myUid), (snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
    return () => {
      unsubUser();
    };
  }, [myUid]);

  function handleSair() {
    Alert.alert('Sair', 'Tem certeza que quer sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  }

  function abrirFoto(index) {
    setViewerIndex(index);
    setViewerVisible(true);
  }

  const iniciais = (auth.currentUser?.email || '??').slice(0, 2).toUpperCase();
  const outrasFotos = (profile.photos || []).filter((p) => p.url !== profile.profilePhotoUrl);
  const allPhotoUrls = profile.profilePhotoUrl
    ? [profile.profilePhotoUrl, ...outrasFotos.map((p) => p.url)]
    : outrasFotos.map((p) => p.url);

  const avgRating = profile.avgRating;
  const totalReviews = Number(profile._reviewCount || 0);
  const showRatingRow = avgRating && totalReviews > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <View style={styles.head}>
          <TouchableOpacity onPress={() => allPhotoUrls.length > 0 && abrirFoto(0)}>
            {profile.profilePhotoUrl ? (
              <RNExpoImage source={{ uri: profile.profilePhotoUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{iniciais}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.username}>{profile.username || (auth.currentUser?.email || '').split('@')[0]}</Text>
          <Text style={styles.email}>{auth.currentUser?.email}</Text>

          {showRatingRow ? (
            <TouchableOpacity
              style={styles.ratingRow}
              activeOpacity={0.8}
              onPress={() => setReviewsVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.ratingStars}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.ratingValue}>{Number(avgRating).toFixed(1)}</Text>
              </View>
              <View style={styles.ratingDivider} />
              <Text style={styles.ratingTotal}>{totalReviews} {totalReviews === 1 ? 'avaliação' : 'avaliações'}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.ratingHint}>Sem avaliações por enquanto</Text>
          )}

          {profile.cidade && profile.uf && (
            <View style={[styles.locationRow, { marginTop: spacing.sm }]}>
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
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md + 2, flexGrow: 1, justifyContent: 'center' }}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => abrirFoto(index + (profile.profilePhotoUrl ? 1 : 0))}>
                <RNExpoImage source={{ uri: item.url }} style={styles.thumb} contentFit="cover" />
              </TouchableOpacity>
            )}
          />
        )}

        <Text style={styles.bio}>{profile.bio || 'Adicione uma bio pra contar um pouco sobre você.'}</Text>

        <View style={styles.chipsRow}>
          {profile.interests && profile.interests.length > 0 ? (
            profile.interests.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Nenhum interesse selecionado ainda</Text>
          )}
        </View>

        <Button label="Sair" variant="ghost" onPress={handleSair} />
      </ScrollView>
      <PhotoViewerModal
        visible={viewerVisible}
        photos={allPhotoUrls}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
      <UserReviewsModal
        visible={reviewsVisible}
        onClose={() => setReviewsVisible(false)}
        userId={myUid}
        fallbackEmail={auth.currentUser?.email}
        avgRating={avgRating}
        totalReviews={totalReviews}
        badgesCount={profile._badgesCount || {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  head: { alignItems: 'center', marginBottom: spacing.md + 2 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarImg: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.sm },
  avatarText: { fontWeight: fontWeight.bold, fontSize: fontSize.xl, color: colors.primaryDark },
  username: { fontWeight: fontWeight.bold, fontSize: fontSize.xl, marginTop: 2 },
  email: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: 1 },
  ratingRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.borderLight,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 3,
    gap: spacing.sm,
  },
  ratingStars: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  ratingDivider: { width: 1, height: 14, backgroundColor: colors.borderLight },
  ratingTotal: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  ratingHint: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  locationText: { fontSize: fontSize.sm, color: colors.textSecondary },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  bio: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md + 2, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: spacing.xl },
  chip: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: fontSize.md },
});
