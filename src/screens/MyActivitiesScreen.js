import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { Image as RNExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, collection, query, where, getDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

export default function MyActivitiesScreen({ navigation }) {
  const myUid = auth.currentUser?.uid;
  const [tab, setTab] = useState('participar');
  const [minhasAtividades, setMinhasAtividades] = useState([]);
  const [participacoes, setParticipacoes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!myUid) return;
    const qActivities = query(
      collection(db, 'activities'),
      where('ownerId', '==', myUid)
    );
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      const itens = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      itens.sort((a, b) => compareActivityDate(a, b));
      setMinhasAtividades(itens);
    });

    const qPart = query(
      collection(db, 'participations'),
      where('userId', '==', myUid)
    );
    const unsubscribe = onSnapshot(qPart, (snapshot) => {
      const itens = snapshot.docs.map((d) => {
        const data = d.data();
        const pid = d.id;
        if (!data.activityDateTime) {
          (async () => {
            try {
              const actSnap = await getDoc(doc(db, 'activities', data.activityId));
              if (actSnap.exists()) {
                const actData = actSnap.data();
                if (actData.dateTime) {
                  await updateDoc(doc(db, 'participations', pid), { activityDateTime: actData.dateTime });
                }
              }
            } catch (_) {}
          })();
        }
        return {
          id: pid,
          status: data.status,
          activityId: data.activityId,
          activityPreview: {
            id: data.activityId,
            title: data.activityTitle || 'Atividade removida',
            date: data.activityDate || '',
            activityDateTime: data.activityDateTime || null,
            local: data.activityLocal || '',
            ownerId: data.activityOwnerId,
          },
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
    return () => {
      unsubActivities();
      unsubscribe();
    };
  }, [myUid]);

  async function refreshAll() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  const activityCache = useMemo(() => new Map(), []);
  async function abrirDetalhes(activityOrPreview, mineOverride) {
    try {
      const maybeFull = activityOrPreview;
      if (maybeFull && (maybeFull.description || maybeFull.photoUrls || maybeFull.ownerName)) {
        navigation.navigate('ActivityDetail', { activity: maybeFull, mine: typeof mineOverride === 'boolean' ? mineOverride : maybeFull.ownerId === myUid });
        return;
      }
      const activityId = maybeFull?.id || maybeFull?.activityId;
      if (!activityId) return;
      if (activityCache.has(activityId)) {
        const cached = activityCache.get(activityId);
        navigation.navigate('ActivityDetail', { activity: cached, mine: cached.ownerId === myUid });
        return;
      }
      const snap = await getDoc(doc(db, 'activities', activityId));
      if (snap.exists()) {
        const full = { id: snap.id, ...snap.data() };
        activityCache.set(activityId, full);
        navigation.navigate('ActivityDetail', { activity: full, mine: full.ownerId === myUid });
      } else {
        Alert.alert('Ops', 'Essa atividade não existe mais.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir a atividade.');
    }
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

  function confirmarCancelarParticipacao(participation) {
    Alert.alert('Cancelar participação', `Tem certeza que deseja cancelar sua participação em "${participation.activityPreview.title}"?`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar participação', style: 'destructive', onPress: () => cancelarParticipacao(participation) },
    ]);
  }

  async function cancelarParticipacao(participation) {
    try {
      await deleteDoc(doc(db, 'participations', participation.id));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível cancelar agora. Tente de novo.');
    }
  }

  function renderTabBar() {
    return (
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'participar' ? styles.tabBtnActive : null]}
          onPress={() => setTab('participar')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={tab === 'participar' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabBtnText, tab === 'participar' ? styles.tabBtnTextActive : null]}>
            Vou participar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'minhas' ? styles.tabBtnActive : null]}
          onPress={() => setTab('minhas')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="person-circle-outline"
            size={16}
            color={tab === 'minhas' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.tabBtnText, tab === 'minhas' ? styles.tabBtnTextActive : null]}>
            Criadas por mim
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (tab === 'participar') {
    return <TabParticiparContent participacoes={participacoes} refreshing={refreshing} onRefresh={refreshAll} renderTabBar={renderTabBar} activityCache={activityCache} myUid={myUid} abrirDetalhes={abrirDetalhes} confirmarCancelarParticipacao={confirmarCancelarParticipacao} />;
  }
  return <TabMinhasContent minhasAtividades={minhasAtividades} refreshing={refreshing} onRefresh={refreshAll} renderTabBar={renderTabBar} navigation={navigation} abrirDetalhes={abrirDetalhes} confirmarExclusao={confirmarExclusao} />;
}

function compareActivityDate(a, b, asc = false) {
  const ta = getActivityMs(a);
  const tb = getActivityMs(b);
  if (asc) return ta - tb;
  return tb - ta;
}

function getActivityMs(activity) {
  if (activity?.dateTime) {
    try {
      return activity.dateTime.toDate ? activity.dateTime.toDate().getTime() : new Date(activity.dateTime).getTime();
    } catch {}
  }
  if (activity?.activityDateTime) {
    try {
      return activity.activityDateTime.toDate ? activity.activityDateTime.toDate().getTime() : new Date(activity.activityDateTime).getTime();
    } catch {}
  }
  if (activity?.activityPreview?.dateTime) {
    try {
      return activity.activityPreview.dateTime.toDate ? activity.activityPreview.dateTime.toDate().getTime() : new Date(activity.activityPreview.dateTime).getTime();
    } catch {}
  }
  if (activity?.activityPreview?.activityDateTime) {
    try {
      return activity.activityPreview.activityDateTime.toDate ? activity.activityPreview.activityDateTime.toDate().getTime() : new Date(activity.activityPreview.activityDateTime).getTime();
    } catch {}
  }
  if (activity?.activity && activity.activity.dateTime) {
    try {
      return activity.activity.dateTime.toDate ? activity.activity.dateTime.toDate().getTime() : new Date(activity.activity.dateTime).getTime();
    } catch {}
  }
  if (activity?._createdAt) {
    try {
      return activity._createdAt.toDate ? activity._createdAt.toDate().getTime() : new Date(activity._createdAt).getTime();
    } catch {}
  }
  if (activity?.createdAt) {
    try {
      return activity.createdAt.toDate ? activity.createdAt.toDate().getTime() : new Date(activity.createdAt).getTime();
    } catch {}
  }
  return 0;
}

function isFutureActivity(activity) {
  const now = Date.now();
  const ms = getActivityMs(activity);
  if (ms === 0) {
    if (activity?._createdAt) {
      try {
        const insc = activity._createdAt.toDate ? activity._createdAt.toDate().getTime() : new Date(activity._createdAt).getTime();
        return insc >= now - 24 * 60 * 60 * 1000;
      } catch {}
    }
    if (activity?.createdAt) {
      try {
        const insc = activity.createdAt.toDate ? activity.createdAt.toDate().getTime() : new Date(activity.createdAt).getTime();
        return insc >= now - 24 * 60 * 60 * 1000;
      } catch {}
    }
    return false;
  }
  return ms >= now - 24 * 60 * 60 * 1000;
}

function labelStatus(status) {
  const mapa = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    recusado: 'Recusado',
    espera: 'Lista de espera',
  };
  return mapa[status] || status;
}

const STATUS_STYLE_KEY = { pendente: 'statusPendente', confirmado: 'statusConfirmado', recusado: 'statusRecusado', espera: 'statusEspera' };

function TabParticiparContent({ participacoes, refreshing, onRefresh, renderTabBar, abrirDetalhes, confirmarCancelarParticipacao }) {
  const { futuras, passadas, enriched } = useMemo(() => {
    const list = participacoes.slice();
    list.sort((a, b) => {
      const ma = getActivityMs(a.activityPreview);
      const mb = getActivityMs(b.activityPreview);
      return ma - mb;
    });
    const futuras = [];
    const passadas = [];
    const enriched = [];
    for (const p of list) {
      const act = p.activityPreview;
      if (isFutureActivity(act)) futuras.push(p);
      else passadas.push(p);
      enriched.push(p);
    }
    return { futuras, passadas, enriched };
  }, [participacoes]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {renderTabBar()}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {renderSectionHeader('Futuras', futuras.length)}
        {futuras.length === 0 ? (
          <EmptyCard text="Você ainda não está inscrito em nenhuma atividade futura. Explore o Feed e confirme presença!" />
        ) : (
          futuras.map((p) => <ParticipationCard key={p.id} item={p} onPress={() => abrirDetalhes(p.activityPreview)} actionButtonRight={() => (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} activeOpacity={0.7} onPress={() => confirmarCancelarParticipacao(p)}>
              <Text style={[styles.actionBtnText, styles.actionBtnTextOutline]}>Cancelar</Text>
            </TouchableOpacity>
          )} />)
        )}
        {passadas.length > 0 && renderSectionHeader('Passadas', passadas.length, true)}
        {passadas.length > 0 && passadas.map((p) => <ParticipationCard key={p.id} item={p} onPress={() => abrirDetalhes(p.activityPreview)} opacidade={0.88} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabMinhasContent({ minhasAtividades, refreshing, onRefresh, renderTabBar, navigation, abrirDetalhes, confirmarExclusao }) {
  const { futuras, passadas } = useMemo(() => {
    const list = minhasAtividades.slice();
    list.sort(compareActivityDate);
    const futuras = [];
    const passadas = [];
    for (const a of list) {
      if (isFutureActivity(a)) futuras.push(a);
      else passadas.push(a);
    }
    return { futuras, passadas };
  }, [minhasAtividades]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {renderTabBar()}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {renderSectionHeader('Futuras', futuras.length)}
        {futuras.length === 0 ? (
          <EmptyCard text="Você ainda não criou nenhuma atividade futura. Toque em Criar no menu principal e organize seu primeiro encontro!" />
        ) : (
          futuras.map((a) => <MineActivityCard key={a.id} activity={a} onPress={() => abrirDetalhes(a, true)} actionButtonsRight={() => (
            <>
              <TouchableOpacity
                style={styles.iconBtnPrimary}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => navigation.navigate('EditActivity', { activity: a })}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtnAccent}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => confirmarExclusao(a)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            </>
          )} />)
        )}
        {passadas.length > 0 && renderSectionHeader('Passadas', passadas.length, true)}
        {passadas.length > 0 && passadas.map((a) => <MineActivityCard key={a.id} activity={a} onPress={() => abrirDetalhes(a, true)} opacidade={0.88} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function renderSectionHeader(titulo, quantidade, discreto = false) {
  return (
    <View style={[styles.sectionHeader, discreto ? { marginTop: spacing.xl } : null]}>
      <Text style={[styles.sectionLabel, discreto ? { color: colors.textFaint } : null]}>
        {titulo}
      </Text>
      <View style={[styles.sectionCountBadge, discreto ? { backgroundColor: colors.borderLight, color: colors.textSecondary } : null]}>
        <Text style={[styles.sectionCountText, discreto ? { color: colors.textSecondary } : null]}>
          {quantidade}
        </Text>
      </View>
    </View>
  );
}

function ParticipationCard({ item, onPress, actionButtonRight, opacidade = 1 }) {
  const hasAction = typeof actionButtonRight === 'function';
  return (
    <TouchableOpacity style={[styles.card, { opacity: opacidade }]} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardThumbWrap}>
        {item.activityPreview?.coverUrl ? (
          <RNExpoImage source={{ uri: item.activityPreview.coverUrl }} style={styles.cardThumb} contentFit="cover" />
        ) : (
          <View style={[styles.cardThumb, styles.cardThumbFallback]}>
            <Ionicons name="image-outline" size={22} color={colors.textFaint} />
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {item.activityPreview.title}
          </Text>
        </View>
        {item.status ? (
          <View style={styles.cardBadgeRow}>
            <Text style={[styles.statusBadge, styles[STATUS_STYLE_KEY[item.status]]]}>{labelStatus(item.status)}</Text>
          </View>
        ) : null}
        <View style={styles.cardMetaRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.textFaint} />
          <Text style={styles.cardMetaText} numberOfLines={1} ellipsizeMode="tail">
            {item.activityPreview.date} · {item.activityPreview.local}
          </Text>
        </View>
      </View>
      {hasAction ? (
        <View style={styles.cardActionsRight}>
          {actionButtonRight()}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function MineActivityCard({ activity, onPress, actionButtonsRight, opacidade = 1 }) {
  const coverUrl = activity?.photoUrls?.[0] || activity?.coverUrl || null;
  const hasActions = typeof actionButtonsRight === 'function';
  return (
    <TouchableOpacity style={[styles.card, { opacity: opacidade }]} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardThumbWrap}>
        {coverUrl ? (
          <RNExpoImage source={{ uri: coverUrl }} style={styles.cardThumb} contentFit="cover" />
        ) : (
          <View style={[styles.cardThumb, styles.cardThumbFallback]}>
            <Ionicons name="image-outline" size={22} color={colors.textFaint} />
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {activity.title}
          </Text>
        </View>
        {activity.category ? (
          <View style={styles.cardBadgeRow}>
            <Text style={styles.categoryChip}>{activity.category}</Text>
          </View>
        ) : null}
        <View style={styles.cardMetaRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.textFaint} />
          <Text style={styles.cardMetaText} numberOfLines={1} ellipsizeMode="tail">
            {activity.date} · {activity.local}
          </Text>
        </View>
      </View>
      {hasActions ? (
        <View style={styles.cardActionsRight}>
          {actionButtonsRight()}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function EmptyCard({ text }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="bookmarks-outline" size={30} color={colors.textFaint} style={{ marginBottom: spacing.sm }} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabBtnActive: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  tabBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 2,
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionCountBadge: {
    minWidth: 26,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.black || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardThumbWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  cardThumb: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundAlt,
  },
  cardThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  categoryChip: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    backgroundColor: colors.primaryTint,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  statusBadge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 1,
    borderRadius: radius.pill,
    flexShrink: 0,
    overflow: 'hidden',
  },
  statusPendente: { backgroundColor: colors.warningBg, color: colors.warning },
  statusConfirmado: { backgroundColor: colors.successBg, color: colors.success },
  statusRecusado: { backgroundColor: colors.disabled, color: colors.textSecondary },
  statusEspera: { backgroundColor: colors.infoBg || colors.primaryTint, color: colors.info || colors.primary },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  cardMetaText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  cardActionsRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
    marginLeft: spacing.md,
    maxWidth: 96,
  },
  iconBtnPrimary: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  iconBtnAccent: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentTint,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnOutline: {
    backgroundColor: colors.white,
    borderColor: colors.borderLight,
  },
  actionBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  actionBtnTextOutline: {
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 20,
  },
});
