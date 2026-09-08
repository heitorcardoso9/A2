import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDoc, deleteDoc, getDocs, orderBy } from 'firebase/firestore';
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
    const q = query(
      collection(db, 'activities'),
      where('ownerId', '==', myUid)
    );
    const unsubActivities = onSnapshot(q, (snapshot) => {
      const itens = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      itens.sort((a, b) => {
        const ta = (a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : a.createdAt) || 0;
        const tb = (b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : b.createdAt) || 0;
        return tb - ta;
      });
      setMinhasAtividades(itens);
    });
    return () => {
      unsubUser();
      unsubActivities();
    };
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'participations'),
      where('userId', '==', myUid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itens = snapshot.docs.map((d) => {
        const data = d.data();
        const activityPreview = {
          id: data.activityId,
          title: data.activityTitle || 'Atividade removida',
          date: data.activityDate || '',
          local: data.activityLocal || '',
          ownerId: data.activityOwnerId,
        };
        return {
          id: d.id,
          status: data.status,
          activityId: data.activityId,
          activity: activityPreview,
          _activityLoaded: false,
          _createdAt: data.createdAt || 0,
        };
      });
      itens.sort((a, b) => {
        const ta = (a._createdAt && a._createdAt.toDate ? a._createdAt.toDate().getTime() : a._createdAt) || 0;
        const tb = (b._createdAt && b._createdAt.toDate ? b._createdAt.toDate().getTime() : b._createdAt) || 0;
        return tb - ta;
      });
      setParticipacoes(itens);
    });
    return unsubscribe;
  }, []);

  const activityCache = new Map();
  async function abrirParticipacao(p) {
    try {
      if (activityCache.has(p.activityId)) {
        navigation.navigate('ActivityDetail', { activity: activityCache.get(p.activityId), mine: false });
        return;
      }
      const snap = await getDoc(doc(db, 'activities', p.activityId));
      if (snap.exists()) {
        const full = { id: snap.id, ...snap.data() };
        activityCache.set(p.activityId, full);
        navigation.navigate('ActivityDetail', { activity: full, mine: full.ownerId === myUid });
      } else {
        Alert.alert('Ops', 'Essa atividade não existe mais.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir a atividade.');
    }
  }

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
    const mapa = {
      pendente: 'Aguardando resposta',
      confirmado: 'Confirmado',
      recusado: 'Recusado',
      espera: 'Na lista de espera',
    };
    return mapa[status] || status;
  }

  const STATUS_STYLE_KEY = { pendente: 'statusPendente', confirmado: 'statusConfirmado', recusado: 'statusRecusado', espera: 'statusEspera' };

  const iniciais = auth.currentUser.email.slice(0, 2).toUpperCase();
  const outrasFotos = (profile.photos || []).filter((p) => p.url !== profile.profilePhotoUrl);
  const allPhotoUrls = profile.profilePhotoUrl
    ? [profile.profilePhotoUrl, ...outrasFotos.map((p) => p.url)]
    : outrasFotos.map((p) => p.url);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
                onPress={() => abrirParticipacao(p)}
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
                  <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.activityIconBtn} onPress={() => confirmarExclusao(item)}>
                  <Ionicons name="trash-outline" size={16} color={colors.accent} />
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
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarImg: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.sm },
  avatarText: { fontWeight: fontWeight.bold, fontSize: fontSize.xl, color: colors.primaryDark },
  username: { fontWeight: fontWeight.bold, fontSize: fontSize.xl, marginTop: 2 },
  email: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  locationText: { fontSize: fontSize.sm, color: colors.textSecondary },
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
  statusEspera: { backgroundColor: colors.infoBg || colors.primaryTint, color: colors.info || colors.primary },
});