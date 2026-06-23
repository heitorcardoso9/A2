import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import PhotoViewerModal from '../components/PhotoViewerModal';

export default function UserProfileScreen({ navigation, route }) {
  const { userId } = route.params;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) setProfile(snap.data());
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 60 }} color="#0E5C46" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>
      </View>
      <View style={{ padding: 18 }}>
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
        </View>

        {outrasFotos.length > 0 && (
          <FlatList
            data={outrasFotos}
            horizontal
            keyExtractor={(item) => item.path}
            contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
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
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Chat', { withUserId: userId, withUserEmail: profile.email })}
          >
            <Text style={styles.buttonText}>Conversar</Text>
          </TouchableOpacity>
        )}
      </View>

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
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: '#0E5C46', fontWeight: '700', fontSize: 16 },
  head: { alignItems: 'center', marginBottom: 14 },
  username: { fontWeight: '700', fontSize: 15, marginBottom: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E3F0EA', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  avatarText: { fontWeight: '700', fontSize: 18, color: '#0A4334' },
  email: { fontSize: 13, color: '#5C6962' },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  bio: { fontSize: 13, color: '#5C6962', textAlign: 'center', marginBottom: 14, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 20 },
  chip: { backgroundColor: '#E3F0EA', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#0A4334' },
  button: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#8B958F', fontSize: 13 },
});