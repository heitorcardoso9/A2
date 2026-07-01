import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import PhotoViewerModal from '../components/PhotoViewerModal';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

export default function ProfileScreen({ navigation }) {
  const myUid = auth.currentUser.uid;
  const [profile, setProfile] = useState({ bio: '', interests: [], photos: [], profilePhotoUrl: null });
  const [minhasAtividades, setMinhasAtividades] = useState([]);
  const [participacoes, setParticipacoes] = useState([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [expandParticipar, setExpandParticipar] = useState(false);
  const [expandMinhas, setExpandMinhas] = useState(false);

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

  useEffect(() => {
    const q = query(collection(db, 'participations'), where('userId', '==', myUid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const itens = await Promise.all(
        snapshot.docs.map(async (d) => {
          const participacao = d.data();
          const activitySnap = await getDoc(doc(db, 'activities', participacao.activityId));
          return {
            id: d.id,
            status: participacao.status,
            activity: activitySnap.exists() ? { id: activitySnap.id, ...activitySnap.data() } : null,
          };
        })
      );
      setParticipacoes(itens.filter((p) => p.activity));
    });
    return unsubscribe;
  }, []);

  function handleSair() {
    Alert.alert('Sair', 'Tem certeza que quer sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  }

  function confirmarExclusao(activity) {
    Alert.alert('Excluir atividade', `Tem certeza que quer excluir "${activity.title}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => excluirAtividade(activity) },
    ]);
  }

  async function excluirAtividade(activity) {
    try {
      const q = query(collection(db, 'participations'), where('activityId', '==', activity.id));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'participations', d.id))));
      await deleteDoc(doc(db, 'activities', activity.id));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível excluir agora. Tente de novo.');
    }
  }

  function abrirFoto(index) {
    setViewerIndex(index);
    setViewerVisible(true);
  }

  function labelStatus(status) {
    const mapa = { pendente: 'Aguardando resposta', confirmado: 'Confirmado', recusado: 'Recusado' };
    return mapa[status] || status;
  }

  const STATUS_STYLE_KEY = { pendente: 'statusPendente', confirmado: 'statusConfirmado', recusado: 'statusRecusado' };

  const iniciais = auth.currentUser.email.slice(0, 2).toUpperCase();
  const outrasFotos = (profile.photos || []).filter((p) => p.url !== profile.profilePhotoUrl);
  const allPhotoUrls = profile.profilePhotoUrl
    ? [profile.profilePhotoUrl, ...outrasFotos.map((p) => p.url)]
    : outrasFotos.map((p) => p.url);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
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
          <Text style={styles.username}>{profile.username || auth.currentUser.email.split('@')[0]}</Text>
          <Text style={styles.email}>{auth.currentUser.email}</Text>
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
                <Image source={{ uri: item.url }} style={styles.thumb} />
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

        <Button label="Editar perfil" variant="outline" onPress={() => navigation.navigate('EditProfile')} style={{ marginBottom: spacing.sm }} />
        <Button label="Sair" variant="ghost" onPress={handleSair} />

        <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpandParticipar(!expandParticipar)}>
          <Text style={styles.sectionLabel}>Vou participar ({participacoes.length})</Text>
          <Ionicons name={expandParticipar ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        {expandParticipar && (
          participacoes.length === 0 ? (
            <Text style={[styles.empty, { marginBottom: spacing.xl }]}>Você ainda não demonstrou interesse em nenhuma atividade.</Text>
          ) : (
            participacoes.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.activityRow}
                onPress={() => navigation.navigate('ActivityDetail', { activity: p.activity, mine: p.activity.ownerId === myUid })}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={styles.activityTitle} numberOfLines={1} ellipsizeMode="tail">{p.activity.title}</Text>
                    <Text style={[styles.statusBadge, styles[STATUS_STYLE_KEY[p.status]]]}>{labelStatus(p.status)}</Text>
                  </View>
                  <Text style={styles.activityMeta}>{p.activity.date} · {p.activity.local}</Text>
                </View>
              </TouchableOpacity>
            ))
          )
        )}

        <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpandMinhas(!expandMinhas)}>
          <Text style={styles.sectionLabel}>Minhas atividades ({minhasAtividades.length})</Text>
          <Ionicons name={expandMinhas ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        {expandMinhas && (
          minhasAtividades.length === 0 ? (
            <Text style={styles.empty}>Você ainda não criou nenhuma atividade.</Text>
          ) : (
            minhasAtividades.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('ActivityDetail', { activity: item, mine: true })}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityMeta}>{item.date} · {item.local}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.activityIconBtn} onPress={() => navigation.navigate('EditActivity', { activity: item })}>
                  <Text style={{ fontSize: 14 }}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.activityIconBtn} onPress={() => confirmarExclusao(item)}>
                  <Text style={{ fontSize: 14 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )
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
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarImg: { width: 64, height: 64, borderRadius: 32, marginBottom: spacing.sm },
  avatarText: { fontWeight: fontWeight.bold, fontSize: fontSize.xl, color: colors.primaryDark },
  username: { fontWeight: fontWeight.bold, fontSize: fontSize.xl, marginTop: 2 },
  email: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: 1 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  bio: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md + 2, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: spacing.xl },
  chip: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl - 2, marginBottom: spacing.md, paddingVertical: 4 },
  sectionLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textSecondary, textTransform: 'uppercase' },
  activityRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm + 2 },
  activityIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontWeight: fontWeight.bold, fontSize: fontSize.base, flex: 1 },
  activityMeta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: fontSize.md },
  statusBadge: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, paddingVertical: 3, paddingHorizontal: spacing.sm + 1, borderRadius: radius.pill, flexShrink: 0 },
  statusPendente: { backgroundColor: colors.warningBg, color: colors.warning },
  statusConfirmado: { backgroundColor: colors.successBg, color: colors.success },
  statusRecusado: { backgroundColor: colors.disabled, color: colors.textSecondary },
});