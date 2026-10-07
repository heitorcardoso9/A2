import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { Image as RNExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, collection, query, where, getDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';
import RatingModal from '../components/RatingModal';
import UserAvatar from '../components/UserAvatar';
import UserName from '../components/UserName';

export default function MyActivitiesScreen({ navigation }) {
  const myUid = auth.currentUser?.uid;
  const [tab, setTab] = useState('participar');
  const [minhasAtividades, setMinhasAtividades] = useState([]);
  const [participacoes, setParticipacoes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userReviewsDone, setUserReviewsDone] = useState(new Map());
  const [participantesPorAtividade, setParticipantesPorAtividade] = useState(new Map());
  const [ratingVisible, setRatingVisible] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);

  useEffect(() => {
    if (!myUid) return;
    const qActivities = query(
      collection(db, 'activities'),
      where('ownerId', '==', myUid)
    );
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      const dedup = new Map();
      for (const d of snapshot.docs) {
        dedup.set(d.id, { id: d.id, ...d.data() });
      }
      // Dedup extra por activityId (garantia total)
      const dedupAct = new Map();
      for (const item of dedup.values()) dedupAct.set(item.id, item);
      const itens = Array.from(dedupAct.values());
      itens.sort((a, b) => compareActivityDate(a, b));
      setMinhasAtividades(itens);
    });

    const qPart = query(
      collection(db, 'participations'),
      where('userId', '==', myUid)
    );
    const STATUS_PRIORITY = { confirmado: 4, espera: 3, pendente: 2, recusado: 1 };
    const unsubscribe = onSnapshot(qPart, (snapshot) => {
      const dedupByDocId = new Map();
      for (const d of snapshot.docs) {
        const data = d.data();
        const pid = d.id;
        if (!data.activityDateTime || !data.coverUrl) {
          (async () => {
            try {
              const actSnap = await getDoc(doc(db, 'activities', data.activityId));
              if (actSnap.exists()) {
                const actData = actSnap.data();
                const atualizacoes = {};
                if (actData.dateTime && !data.activityDateTime) {
                  atualizacoes.activityDateTime = actData.dateTime;
                }
                if (!data.coverUrl) {
                  const foto = (actData.photoUrls && actData.photoUrls[0]) || actData.coverUrl || null;
                  if (foto) atualizacoes.coverUrl = typeof foto === 'string' ? foto : foto.url;
                }
                if (Object.keys(atualizacoes).length > 0) {
                  await updateDoc(doc(db, 'participations', pid), atualizacoes);
                }
              }
            } catch (_) {}
          })();
        }
        dedupByDocId.set(pid, {
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
            ownerName: data.activityOwnerName || null,
            ownerEmail: data.activityOwnerEmail || null,
            coverUrl: data.coverUrl || null,
          },
          _createdAt: data.createdAt || 0,
        });
      }
      // DEDUP FORTE POR ACTIVITYID: se mesma atividade aparecer com docs diferentes (pid distinto),
      // mantém apenas 1 — com melhor status (confirmado > espera > pendente > recusado)
      const byActivity = new Map();
      for (const p of dedupByDocId.values()) {
        const key = p.activityId;
        const existing = byActivity.get(key);
        if (!existing) {
          byActivity.set(key, p);
        } else {
          const p1 = STATUS_PRIORITY[existing.status] || 0;
          const p2 = STATUS_PRIORITY[p.status] || 0;
          if (p2 > p1) byActivity.set(key, p);
        }
      }
      const itens = Array.from(byActivity.values());
      itens.sort((a, b) => {
        const ta = (a._createdAt && a._createdAt.toDate ? a._createdAt.toDate().getTime() : a._createdAt) || 0;
        const tb = (b._createdAt && b._createdAt.toDate ? b._createdAt.toDate().getTime() : b._createdAt) || 0;
        return tb - ta;
      });
      setParticipacoes(itens);
    });

    const qReviews = query(
      collection(db, 'reviews'),
      where('reviewerId', '==', myUid)
    );
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const map = new Map();
      for (const d of snap.docs) {
        const rev = d.data();
        if (rev.activityId && rev.reviewedId) {
          const key = `${rev.activityId}:${rev.reviewedId}`;
          map.set(key, rev);
        }
      }
      setUserReviewsDone(map);
    });

    return () => {
      unsubActivities();
      unsubscribe();
      unsubReviews();
    };
  }, [myUid]);

  useEffect(() => {
    if (!myUid || minhasAtividades.length === 0) return;
    const passadas = minhasAtividades.filter((a) => !isFutureActivity(a));
    if (passadas.length === 0) {
      setParticipantesPorAtividade(new Map());
      return;
    }
    const activityIds = passadas.map((a) => a.id);
    // SÓ status confirmado — lista de espera, pendentes, recusados não podem ser avaliados
    const q = query(collection(db, 'participations'), where('activityId', 'in', activityIds), where('status', '==', 'confirmado'));
    const unsub = onSnapshot(q, async (snap) => {
      const participationsByAct = {};
      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        if (!participationsByAct[d.activityId]) participationsByAct[d.activityId] = new Map();
        if (!participationsByAct[d.activityId].has(d.userId)) {
          participationsByAct[d.activityId].set(d.userId, {
            id: docSnap.id,
            userId: d.userId,
            userEmail: d.userEmail || null,
            userName: d.userName || null,
            userAvatar: d.userAvatar || null,
            status: d.status,
          });
        }
      }
      for (const actId of Object.keys(participationsByAct)) {
        const usersMap = participationsByAct[actId];
        const users = Array.from(usersMap.values());
        for (const u of users) {
          if (!u.userName || !u.userAvatar) {
            try {
              const us = await getDoc(doc(db, 'users', u.userId));
              if (us.exists()) {
                const ud = us.data();
                u.userName = u.userName || ud.username || ud.name || 'Usuário';
                u.userAvatar = u.userAvatar || ud.profilePhotoUrl || ud.avatarUrl || null;
              }
            } catch {}
          }
        }
        participationsByAct[actId] = users;
      }
      setParticipantesPorAtividade(new Map(Object.entries(participationsByAct)));
    });
    return () => unsub();
  }, [myUid, minhasAtividades]);

  function getReviewStatus(activityId, reviewedId) {
    const key = `${activityId}:${reviewedId}`;
    return userReviewsDone.has(key) ? userReviewsDone.get(key) : null;
  }

  function abrirAvaliacaoOrganizador(participation) {
    if (!participation?.activityPreview?.ownerId || !myUid || myUid === participation.activityPreview.ownerId) return;
    // Só posso avaliar organizador se MINHA participação foi CONFIRMADA (não fui só pra lista de espera/pendente)
    if (participation.status !== 'confirmado') return;
    const existing = getReviewStatus(participation.activityId, participation.activityPreview.ownerId);
    setReviewTarget({
      reviewedUserId: participation.activityPreview.ownerId,
      reviewedUserEmail: participation.activityPreview.ownerEmail,
      reviewedUserName: null,
      reviewedUserAvatar: null,
      activityPreview: participation.activityPreview,
      existingInitial: existing,
    });
    setRatingVisible(true);
  }

  function abrirAvaliacaoParticipante(activity, participant) {
    if (!participant?.userId || !myUid || myUid === participant.userId) return;
    const existing = getReviewStatus(activity.id, participant.userId);
    const coverUrl = activity?.photoUrls?.[0] || activity?.coverUrl || null;
    setReviewTarget({
      reviewedUserId: participant.userId,
      reviewedUserEmail: participant.userEmail,
      reviewedUserName: null,
      reviewedUserAvatar: null,
      activityPreview: {
        id: activity.id,
        title: activity.title,
        date: activity.date,
        activityDateTime: activity.dateTime || null,
        local: activity.local,
        coverUrl,
      },
      existingInitial: existing,
    });
    setRatingVisible(true);
  }

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
    return (
      <>
        <TabParticiparContent participacoes={participacoes} refreshing={refreshing} onRefresh={refreshAll} renderTabBar={renderTabBar} activityCache={activityCache} myUid={myUid} abrirDetalhes={abrirDetalhes} confirmarCancelarParticipacao={confirmarCancelarParticipacao} getReviewStatus={getReviewStatus} abrirAvaliacaoOrganizador={abrirAvaliacaoOrganizador} />
        <RatingModal
          key={'p-' + (reviewTarget?.reviewedUserId + '_' + reviewTarget?.activityPreview?.id)}
          visible={ratingVisible && !!reviewTarget}
          onClose={() => { setRatingVisible(false); setReviewTarget(null); }}
          reviewedUserId={reviewTarget?.reviewedUserId}
          reviewedUserEmail={reviewTarget?.reviewedUserEmail}
          reviewedUserName={reviewTarget?.reviewedUserName}
          reviewedUserAvatar={reviewTarget?.reviewedUserAvatar}
          activityPreview={reviewTarget?.activityPreview}
          existingInitial={reviewTarget?.existingInitial}
          onSubmitted={() => { setRatingVisible(false); setReviewTarget(null); }}
        />
      </>
    );
  }
  return (
    <>
      <TabMinhasContent minhasAtividades={minhasAtividades} refreshing={refreshing} onRefresh={refreshAll} renderTabBar={renderTabBar} navigation={navigation} abrirDetalhes={abrirDetalhes} confirmarExclusao={confirmarExclusao} participantesPorAtividade={participantesPorAtividade} getReviewStatus={getReviewStatus} abrirAvaliacaoParticipante={abrirAvaliacaoParticipante} />
      <RatingModal
        key={'m-' + (reviewTarget?.reviewedUserId + '_' + reviewTarget?.activityPreview?.id)}
        visible={ratingVisible && !!reviewTarget}
        onClose={() => { setRatingVisible(false); setReviewTarget(null); }}
        reviewedUserId={reviewTarget?.reviewedUserId}
        reviewedUserEmail={reviewTarget?.reviewedUserEmail}
        reviewedUserName={reviewTarget?.reviewedUserName}
        reviewedUserAvatar={reviewTarget?.reviewedUserAvatar}
        activityPreview={reviewTarget?.activityPreview}
        existingInitial={reviewTarget?.existingInitial}
        onSubmitted={() => { setRatingVisible(false); setReviewTarget(null); }}
      />
    </>
  );
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
        return insc >= now - 60 * 60 * 1000;
      } catch {}
    }
    if (activity?.createdAt) {
      try {
        const insc = activity.createdAt.toDate ? activity.createdAt.toDate().getTime() : new Date(activity.createdAt).getTime();
        return insc >= now - 60 * 60 * 1000;
      } catch {}
    }
    return false;
  }
  if (__DEV__) {
    const diffHoras = (ms - now) / 3600000;
    console.log(`[MyActivities] isFuture? title=${activity?.activityPreview?.title || activity?.activityPreview?.activityTitle || activity?.title || activity?.activityTitle || '-'} ms=${new Date(ms).toLocaleString()} now=${new Date(now).toLocaleString()} diffHoras=${diffHoras.toFixed(2)}h`);
  }
  return ms >= now - 2 * 60 * 60 * 1000;
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

function TabParticiparContent({ participacoes, refreshing, onRefresh, renderTabBar, abrirDetalhes, confirmarCancelarParticipacao, getReviewStatus, abrirAvaliacaoOrganizador }) {
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
        {passadas.length > 0 && passadas.map((p) => {
          const ownerId = p.activityPreview.ownerId;
          const review = ownerId ? getReviewStatus(p.activityId, ownerId) : null;
          // SÓ mostra chip de avaliação se MINHA participação foi confirmada
          const temAvaliacaoHabilitada = p.status === 'confirmado';
          return (
            <View key={p.id} style={{ marginBottom: spacing.md }}>
              <ParticipationCard item={p} onPress={() => abrirDetalhes(p.activityPreview)} opacidade={0.92} />
              {ownerId && temAvaliacaoHabilitada ? (
                <View style={styles.reviewRow}>
                  {review ? (
                  <View style={[styles.reviewChip, styles.reviewChipDone]}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                    <Text style={[styles.reviewChipText, styles.reviewChipTextDone]}>Você avaliou · ⭐ {review.rating}</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.reviewChip, styles.reviewChipPending]} activeOpacity={0.7} onPress={() => abrirAvaliacaoOrganizador(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="star" size={15} color={colors.accent || '#DD6433'} />
                    <Text style={[styles.reviewChipText, styles.reviewChipTextPending]} numberOfLines={1}>Avaliar organizador</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabMinhasContent({ minhasAtividades, refreshing, onRefresh, renderTabBar, navigation, abrirDetalhes, confirmarExclusao, participantesPorAtividade, getReviewStatus, abrirAvaliacaoParticipante }) {
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
        {passadas.length > 0 && passadas.map((a) => {
          const participantes = participantesPorAtividade.get(a.id) || [];
          // SÓ quem teve status = confirmado pode ser avaliado. Organizador não se avalia.
          const paraAvaliar = participantes.filter((p) => p.userId !== auth.currentUser?.uid && p.status === 'confirmado');
          return (
            <View key={a.id} style={{ marginBottom: spacing.md }}>
              <MineActivityCard activity={a} onPress={() => abrirDetalhes(a, true)} opacidade={0.92} />
              {paraAvaliar.length > 0 ? (
                <View style={{ marginLeft: 104, gap: spacing.sm - 2, marginTop: -spacing.sm }}>
                  {paraAvaliar.map((p) => {
                    const review = getReviewStatus(a.id, p.userId);
                    return review ? (
                      <View key={p.userId + '-' + a.id} style={[styles.reviewChip, styles.reviewChipDone]}>
                        <UserAvatar userId={p.userId} fallbackEmail={p.userEmail} size={22} />
                        <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                        <Text style={[styles.reviewChipText, styles.reviewChipTextDone]}>Você avaliou · ⭐ {review.rating}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        key={p.userId + '-' + a.id}
                        style={[styles.reviewChip, styles.reviewChipPending]}
                        activeOpacity={0.75}
                        onPress={() => abrirAvaliacaoParticipante(a, p)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <UserAvatar userId={p.userId} fallbackEmail={p.userEmail} size={22} />
                        <Ionicons name="star" size={15} color={colors.accent || '#DD6433'} />
                        <Text style={[styles.reviewChipText, styles.reviewChipTextPending]} numberOfLines={1}>Avaliar participante</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
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
  const preview = item?.activityPreview || {};
  const coverUrl = preview?.coverUrl
    || (preview?.photoUrls && (typeof preview.photoUrls[0] === 'string' ? preview.photoUrls[0] : preview.photoUrls[0]?.url))
    || null;
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
  reviewRow: {
    marginTop: -spacing.sm,
    marginLeft: 104,
    marginBottom: 2,
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: spacing.md - 1,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  reviewChipPending: {
    backgroundColor: colors.warningBg || '#FEF3C7',
  },
  reviewChipDone: {
    backgroundColor: colors.successBg || '#E1F0E6',
  },
  reviewChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  reviewChipTextPending: {
    color: colors.warning || '#8A5A12',
  },
  reviewChipTextDone: {
    color: colors.success || '#1F6B43',
  },
});
