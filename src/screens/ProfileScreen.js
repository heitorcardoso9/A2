import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export default function ProfileScreen({ navigation }) {
  const myUid = auth.currentUser.uid;
  const [profile, setProfile] = useState({ bio: '', interests: [], photos: [], profilePhotoUrl: null });
  const [minhasAtividades, setMinhasAtividades] = useState([]);

  useEffect(() => {
    const unsubUser = onSnapshot(doc(db, 'users', myUid), (snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
    const q = query(collection(db, 'activities'), where('ownerId', '==', myUid));
    const unsubActivities = onSnapshot(q, (snapshot) => {
      setMinhasAtividades(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubUser();
      unsubActivities();
    };
  }, []);

  function handleSair() {
    Alert.alert('Sair', 'Tem certeza que quer sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  }

  const iniciais = auth.currentUser.email.slice(0, 2).toUpperCase();
  const outrasFotos = (profile.photos || []).filter((p) => p.url !== profile.profilePhotoUrl);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={minhasAtividades}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 18 }}
        ListHeaderComponent={
          <>
            <View style={styles.head}>
              {profile.profilePhotoUrl ? (
                <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{iniciais}</Text>
                </View>
              )}
              <Text style={styles.email}>{auth.currentUser.email}</Text>
            </View>

            {outrasFotos.length > 0 && (
              <FlatList
                data={outrasFotos}
                horizontal
                keyExtractor={(item) => item.path}
                contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <Image source={{ uri: item.url }} style={styles.thumb} />}
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

            <TouchableOpacity style={styles.buttonOutline} onPress={() => navigation.navigate('EditProfile')}>
              <Text style={styles.buttonOutlineText}>Editar perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonGhost} onPress={handleSair}>
              <Text style={styles.buttonGhostText}>Sair</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Minhas atividades</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>Você ainda não criou nenhuma atividade.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.activityRow}
            onPress={() => navigation.navigate('ActivityDetail', { activity: item, mine: true })}
          >
            <Text style={styles.activityTitle}>{item.title}</Text>
            <Text style={styles.activityMeta}>{item.date} · {item.local}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  head: { alignItems: 'center', marginBottom: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E3F0EA', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarImg: { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  avatarText: { fontWeight: '700', fontSize: 18, color: '#0A4334' },
  email: { fontSize: 13, color: '#5C6962' },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  bio: { fontSize: 13, color: '#5C6962', textAlign: 'center', marginBottom: 14, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 20 },
  chip: { backgroundColor: '#E3F0EA', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#0A4334' },
  buttonOutline: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 8 },
  buttonOutlineText: { textAlign: 'center', fontWeight: '700', color: '#1B231F' },
  buttonGhost: { padding: 12 },
  buttonGhostText: { textAlign: 'center', fontWeight: '700', color: '#5C6962' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#5C6962', textTransform: 'uppercase', marginTop: 18, marginBottom: 10 },
  activityRow: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, marginBottom: 10 },
  activityTitle: { fontWeight: '700', fontSize: 14 },
  activityMeta: { fontSize: 12, color: '#5C6962', marginTop: 2 },
  empty: { textAlign: 'center', color: '#8B958F', fontSize: 13 },
});