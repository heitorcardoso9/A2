import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import UserAvatar from '../components/UserAvatar';
import UserName from '../components/UserName';
import PhotoViewerModal from '../components/PhotoViewerModal';
import Button from '../components/Button';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ActivityDetailScreen({ navigation, route }) {
  const { activity, mine } = route.params;
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(!mine);
  const [sending, setSending] = useState(false);
  const [interessados, setInteressados] = useState([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [tabAtiva, setTabAtiva] = useState('todos');

  const maxParticipants = activity.maxParticipants ?? null;
  const confirmados = interessados.filter((p) => p.status === 'confirmado');
  const qtdConfirmados = confirmados.length;
  const estaLotado = maxParticipants != null && qtdConfirmados >= maxParticipants;
  const vagasRestantes = maxParticipants == null ? Infinity : Math.max(0, maxParticipants - qtdConfirmados);
  const porcentagemOcupada = maxParticipants ? Math.min(100, (qtdConfirmados / maxParticipants) * 100) : 0;

  useEffect(() => {
    if (mine) return;
    checkInterest();
  }, []);

  useEffect(() => {
    if (!mine) return;
    const q = query(collection(db, 'participations'), where('activityId', '==', activity.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInteressados(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  async function checkInterest() {
    try {
      const q = query(
        collection(db, 'participations'),
        where('activityId', '==', activity.id),
        where('userId', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      setSent(!snap.empty);
    } catch (e) {
      // Falha silenciosa na checagem é aceitável: deixa o botão normal
    } finally {
      setChecking(false);
    }
  }

  async function handleParticipar() {
    setSending(true);
    try {
      const novoStatus = estaLotado ? 'espera' : 'pendente';
      await addDoc(collection(db, 'participations'), {
        activityId: activity.id,
        activityTitle: activity.title,
        activityDate: activity.date,
        activityLocal: activity.local,
        activityOwnerId: activity.ownerId,
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        status: novoStatus,
        createdAt: serverTimestamp(),
      });
      setSent(true);
      if (estaLotado) {
        Alert.alert('Inscrito na lista de espera!', 'As vagas estão esgotadas, mas você está na fila. Se alguém sair, você é o próximo a ser chamado.');
      }
    } catch (e) {
      Alert.alert('Ops', 'Não foi possível enviar seu interesse agora. Verifique sua conexão e tente de novo.');
    } finally {
      setSending(false);
    }
  }

  async function promoverProximoDaFila(participationIdsAtualizados) {
    try {
      const max = maxParticipants;
      if (max == null) return;
      const confirmadosAgora = interessados.filter((p) => {
        if (participationIdsAtualizados?.includes(p.id)) return false;
        return p.status === 'confirmado';
      }).length + (participationIdsAtualizados?.length || 0);
      const emEspera = interessados
        .filter((p) => p.status === 'espera' && !participationIdsAtualizados?.includes(p.id))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return ta - tb;
        });
      while (confirmadosAgora < max && emEspera.length > 0) {
        const proximo = emEspera.shift();
        try {
          await updateDoc(doc(db, 'participations', proximo.id), { status: 'pendente' });
        } catch (e) {
          console.warn('[promo] falhou ao promover', proximo.id, e);
        }
      }
    } catch (e) {
      console.warn('[promo] erro geral:', e);
    }
  }

  async function atualizarStatus(participationId, novoStatus, opts = {}) {
    try {
      await updateDoc(doc(db, 'participations', participationId), { status: novoStatus });
      const eraConfirmado = interessados.find((p) => p.id === participationId)?.status === 'confirmado';
      const saindoDoConfirmado = eraConfirmado && novoStatus !== 'confirmado';
      if (saindoDoConfirmado && maxParticipants != null) {
        await promoverProximoDaFila([participationId]);
      }
    } catch (e) {
      Alert.alert('Ops', 'Não foi possível atualizar o status agora. Tente de novo.');
    }
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

  function corStatus(status) {
    switch (status) {
      case 'confirmado': return colors.success;
      case 'pendente': return colors.accent;
      case 'recusado': return colors.danger;
      case 'espera': return colors.info || colors.primary;
      default: return colors.textSecondary;
    }
  }

  const TABS = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendente', label: 'Pendentes' },
    { key: 'confirmado', label: 'Confirmados' },
    { key: 'espera', label: 'Espera' },
    { key: 'recusado', label: 'Recusados' },
  ];
  const interessadosFiltrados = tabAtiva === 'todos'
    ? interessados
    : interessados.filter((p) => p.status === tabAtiva);
  const contagemTab = (k) => k === 'todos'
    ? interessados.length
    : interessados.filter((p) => p.status === k).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.xxl + 2 }}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.chip}>{activity.type}</Text>
        <Text style={styles.title}>{activity.title}</Text>
        <Text style={styles.meta}>📅 {activity.date}</Text>
        <Text style={styles.meta}>📍 {activity.local}</Text>
        {mine ? (
          <Text style={styles.owner}>Organizado por você</Text>
        ) : (
          <TouchableOpacity style={styles.ownerRow} onPress={() => navigation.navigate('UserProfile', { userId: activity.ownerId })}>
            <UserAvatar userId={activity.ownerId} fallbackEmail={activity.ownerEmail} size={28} />
            <Text style={[styles.owner, styles.ownerLink]}>
              Organizado por <UserName userId={activity.ownerId} fallbackEmail={activity.ownerEmail} /> ›
            </Text>
          </TouchableOpacity>
        )}

        {maxParticipants != null && (
          <View style={styles.capacidadeCard}>
            <View style={styles.capacidadeHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="people-outline" size={18} color={colors.primaryDark} />
                <Text style={styles.capacidadeTitulo}>Capacidade</Text>
              </View>
              {estaLotado ? (
                <Text style={styles.capacidadeLotado}>🔴 Lotado</Text>
              ) : (
                <Text style={styles.capacidadeDisponivel}>
                  {vagasRestantes === 1
                    ? 'Última vaga!'
                    : vagasRestantes <= 3
                    ? `${vagasRestantes} vagas restantes`
                    : `${vagasRestantes} vagas`}
                </Text>
              )}
            </View>
            <Text style={styles.capacidadeContador}>
              <Text style={{ fontWeight: fontWeight.extrabold }}>{qtdConfirmados}</Text>
              <Text style={{ color: colors.textFaint }}> / {maxParticipants} confirmados</Text>
            </Text>
            <View style={styles.capacidadeBarBg}>
              <View
                style={[
                  styles.capacidadeBarFill,
                  {
                    width: `${porcentagemOcupada}%`,
                    backgroundColor: estaLotado
                      ? colors.danger
                      : porcentagemOcupada >= 80
                      ? colors.accent
                      : colors.success,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {activity.photoUrls && activity.photoUrls.length > 0 && (
          <View style={styles.photoSection}>
            <View style={styles.photoGrid}>
              {activity.photoUrls.slice(0, 4).map((url, index) => {
                const ehUltimoVisivel = index === 3 && activity.photoUrls.length > 4;
                const quantiaEscondida = activity.photoUrls.length - 4;
                return (
                  <TouchableOpacity
                    key={`${url}-${index}`}
                    style={[
                      styles.thumbWrap,
                      activity.photoUrls.length === 1 && styles.thumbSingle,
                    ]}
                    onPress={() => {
                      setViewerIndex(index);
                      setViewerVisible(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: typeof url === 'string' ? url : url.url }} style={styles.thumbImg} resizeMode="cover" />
                    {ehUltimoVisivel && (
                      <View style={styles.moreOverlay}>
                        <Ionicons name="images-outline" size={16} color={colors.white} />
                        <Text style={styles.moreText}>+{quantiaEscondida}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <Text style={styles.desc}>{activity.desc}</Text>

        {mine && (
          <View>
            <Text style={styles.sectionLabel}>Interessados</Text>
            <View style={styles.tabsRow}>
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabItem, tabAtiva === t.key && styles.tabItemActive]}
                  onPress={() => setTabAtiva(t.key)}
                >
                  <Text style={[styles.tabText, tabAtiva === t.key && styles.tabTextActive]}>
                    {t.label}
                    <Text style={styles.tabCount}> {contagemTab(t.key)}</Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {interessados.length === 0 ? (
              <Text style={styles.empty}>Ninguém demonstrou interesse ainda.</Text>
            ) : interessadosFiltrados.length === 0 ? (
              <Text style={styles.empty}>Nenhuma pessoa na aba "{TABS.find(t => t.key === tabAtiva)?.label}".</Text>
            ) : (
              interessadosFiltrados.map((item) => (
                <View key={item.id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowTouchable}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
                  >
                    <UserAvatar userId={item.userId} fallbackEmail={item.userEmail} size={38} />
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                        <UserName userId={item.userId} fallbackEmail={item.userEmail} />
                      </Text>
                      <Text style={[styles.statusLabel, { color: corStatus(item.status) }]}>
                        {labelStatus(item.status)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {(item.status === 'pendente' || item.status === 'espera') && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity style={styles.iconBtnOk} onPress={() => atualizarStatus(item.id, 'confirmado')}>
                        <Ionicons name="checkmark" size={16} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconBtnX} onPress={() => atualizarStatus(item.id, 'recusado')}>
                        <Ionicons name="close" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {item.status === 'confirmado' && (
                    <TouchableOpacity style={styles.iconBtnX} onPress={() => atualizarStatus(item.id, 'recusado')}>
                      <Ionicons name="person-remove-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                  {item.status === 'recusado' && (
                    <TouchableOpacity
                      style={styles.iconBtnOk}
                      onPress={() => atualizarStatus(item.id, 'pendente')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-undo-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() => navigation.navigate('Chat', { withUserId: item.userId, withUserEmail: item.userEmail, activityTitle: activity.title })}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {!mine && (
        <View style={styles.fixedFooter}>
          <Button
            label={
              checking
                ? 'Verificando...'
                : sent
                ? estaLotado && interessados.find((p) => p.userId === auth.currentUser?.uid)?.status === 'espera'
                  ? '✓ Na lista de espera'
                  : '✓ Interesse enviado'
                : sending
                ? 'Enviando...'
                : estaLotado
                ? 'Entrar na lista de espera'
                : 'Quero participar'
            }
            variant={estaLotado && !sent ? 'outline' : 'accent'}
            onPress={handleParticipar}
            disabled={sent || sending || checking}
            style={{ marginBottom: spacing.sm + 2 }}
          />
          <Button
            label="Conversar com quem organizou"
            variant="outline"
            onPress={() => navigation.navigate('Chat', {
              withUserId: activity.ownerId,
              withUserEmail: activity.ownerEmail,
              activityTitle: activity.title,
            })}
          />
        </View>
      )}

      <PhotoViewerModal
        visible={viewerVisible}
        photos={activity.photoUrls?.map?.((u) => (typeof u === 'string' ? u : u.url)) || []}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.xl },
  chip: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, backgroundColor: colors.primaryTint, color: colors.primaryDark, paddingVertical: 3, paddingHorizontal: spacing.sm + 1, borderRadius: radius.pill, alignSelf: 'flex-start' },
  title: { fontSize: fontSize.heading, fontWeight: fontWeight.extrabold, marginTop: spacing.md - 2, marginBottom: spacing.md - 2 },
  meta: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.sm },
  owner: { fontSize: fontSize.md, color: colors.textFaint, marginTop: spacing.sm },
  ownerLink: { color: colors.primary, fontWeight: fontWeight.bold, marginTop: 0, marginLeft: spacing.sm },
  capacidadeCard: {
    marginTop: spacing.md + 2,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface || colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  capacidadeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  capacidadeTitulo: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primaryDark },
  capacidadeDisponivel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.success },
  capacidadeLotado: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.danger },
  capacidadeContador: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 8 },
  capacidadeBarBg: { height: 8, borderRadius: radius.pill, backgroundColor: colors.disabled, overflow: 'hidden' },
  capacidadeBarFill: { height: '100%', borderRadius: radius.pill },
  photoSection: { marginTop: spacing.md, marginBottom: spacing.sm },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbWrap: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.sm) / 2,
    height: 130,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.disabled,
  },
  thumbSingle: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    height: 220,
  },
  thumbImg: { width: '100%', height: '100%' },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  moreText: { color: colors.white, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  desc: { fontSize: fontSize.base, lineHeight: 20, marginTop: spacing.md + 2, marginBottom: spacing.xl + 2 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  sectionLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.md, textTransform: 'uppercase' },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  tabItem: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tabItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabCount: {
    fontWeight: fontWeight.bold,
    opacity: 0.75,
  },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: fontSize.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md + 2 },
  rowTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  rowTextWrap: { flex: 1, minWidth: 0, marginLeft: spacing.sm + 2 },
  name: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  statusLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  iconBtnOk: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  iconBtnX: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.disabled, alignItems: 'center', justifyContent: 'center' },
  chatBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  fixedFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.background },
});