import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, Image, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import UserName from '../components/UserName';
import UserAvatar from '../components/UserAvatar';
import SearchablePickerModal from '../components/SearchablePickerModal';
import Button from '../components/Button';
import useUserProfile from '../hooks/useUserProfile';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';
import { useIBGEEstados, useIBGECidades } from '../hooks/useIBGELocations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const FILTROS = ['Todos', 'Restaurante', 'Esporte', 'Cinema', 'Shows e eventos', 'Passeio', 'Viagem', 'Outros'];

function normalizar(texto) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function getDate(activity) {
  if (!activity.dateTime) return null;
  return activity.dateTime.toDate ? activity.dateTime.toDate() : new Date(activity.dateTime);
}

function formatarDataCurta(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function toDateString(d) {
  if (!d) return null;
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function fromDateString(s) {
  const [ano, mes, dia] = s.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export default function FeedScreen({ navigation }) {
  const [activities, setActivities] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [busca, setBusca] = useState('');

  const [showFiltrosModal, setShowFiltrosModal] = useState(false);
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);

  const [ufFiltro, setUfFiltro] = useState('');
  const [cidadeFiltro, setCidadeFiltro] = useState('');
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showCidadeModal, setShowCidadeModal] = useState(false);

  const estados = useIBGEEstados() || [];
  const { cidades = [], carregando: carregandoCidades } = useIBGECidades(ufFiltro);

  const myUid = auth.currentUser?.uid;
  const myProfile = useUserProfile(myUid);
  const meusInteresses = myProfile?.interests || [];
  const minhaCidade = myProfile?.cidade || '';
  const minhaUf = myProfile?.uf || '';

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setActivities(lista);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const qP = query(collection(db, 'participations'), where('status', 'in', ['confirmado', 'espera']));
    const unsub = onSnapshot(qP, (snap) => {
      setParticipations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const confirmadosPorAtividade = useMemo(() => {
    const m = new Map();
    for (const p of participations) {
      if (p.status === 'confirmado') m.set(p.activityId, (m.get(p.activityId) || 0) + 1);
    }
    return m;
  }, [participations]);

  const esperaPorAtividade = useMemo(() => {
    const m = new Map();
    for (const p of participations) {
      if (p.status === 'espera') m.set(p.activityId, (m.get(p.activityId) || 0) + 1);
    }
    return m;
  }, [participations]);

  function onSelectEstadoFiltro(sigla) {
    setUfFiltro(sigla);
    setCidadeFiltro('');
  }

  function handleDiaPress(day) {
    const data = fromDateString(day.dateString);
    if (!dataInicio || (dataInicio && dataFim)) {
      setDataInicio(data);
      setDataFim(null);
    } else if (data < dataInicio) {
      setDataInicio(data);
      setDataFim(null);
    } else {
      setDataFim(data);
    }
  }

  const markedDates = useMemo(() => {
    const marks = {};
    if (dataInicio && !dataFim) {
      marks[toDateString(dataInicio)] = { startingDay: true, endingDay: true, color: colors.primary, textColor: colors.white };
    } else if (dataInicio && dataFim) {
      const atual = new Date(dataInicio);
      while (atual <= dataFim) {
        const key = toDateString(atual);
        marks[key] = {
          color: colors.primary,
          textColor: colors.white,
          startingDay: key === toDateString(dataInicio),
          endingDay: key === toDateString(dataFim),
        };
        atual.setDate(atual.getDate() + 1);
      }
    }
    return marks;
  }, [dataInicio, dataFim]);

  function limparFiltros() {
    setDataInicio(null);
    setDataFim(null);
    setUfFiltro('');
    setCidadeFiltro('');
  }

  function scoreAtividade(a, agoraTs) {
    const matchInteresse = meusInteresses.length > 0 && meusInteresses.includes(a.type);
    const mesmaCidade = !!(minhaCidade && a.cidade && a.cidade === minhaCidade && minhaUf && a.uf && a.uf === minhaUf);
    const mesmoUf = !!(minhaUf && a.uf && a.uf === minhaUf);
    const dt = getDate(a);
    const diasPara = dt ? Math.max(0, (dt.getTime() - agoraTs) / (1000 * 60 * 60 * 24)) : 0;
    const recencia = Math.max(0, Math.min(5, 5 - diasPara * 0.05));
    let score = 0;
    if (mesmaCidade) score += 100;
    if (matchInteresse) score += 50;
    if (mesmoUf && !mesmaCidade) score += 10;
    score += recencia;
    return {
      score,
      matchInteresse,
      mesmaCidade,
      mesmoUf,
      dataTs: dt ? dt.getTime() : 0,
    };
  }

  const lista = useMemo(() => {
    const agora = new Date();
    const agoraTs = agora.getTime();
    const termo = normalizar(busca);
    const temPerfilRelevancia = !!(minhaCidade || meusInteresses.length > 0);
    const temFiltroManual = !!(filtro !== 'Todos' || ufFiltro || cidadeFiltro || dataInicio || dataFim);

    const filtradas = activities.filter((a) => {
      const dt = getDate(a);
      if (dt && dt < agora) return false;
      if (filtro !== 'Todos' && a.type !== filtro) return false;
      if (dataInicio && dt && dt < dataInicio) return false;
      if (dataFim && dt) {
        const fimDoDia = new Date(dataFim);
        fimDoDia.setHours(23, 59, 59, 999);
        if (dt > fimDoDia) return false;
      }
      if (ufFiltro && a.uf !== ufFiltro) return false;
      if (cidadeFiltro && a.cidade !== cidadeFiltro) return false;
      if (busca.trim()) {
        const tituloOk = normalizar(a.title || '').includes(termo);
        const descOk = normalizar(a.desc || '').includes(termo);
        const localOk = normalizar(a.local || '').includes(termo);
        if (!tituloOk && !descOk && !localOk) return false;
      }
      return true;
    });

    const relevadas = filtradas.map((a) => {
      const meta = temPerfilRelevancia && !temFiltroManual
        ? scoreAtividade(a, agoraTs)
        : { score: 0, matchInteresse: false, mesmaCidade: false, mesmoUf: false, dataTs: getDate(a)?.getTime() || 0 };
      return {
        ...a,
        _relevanceScore: meta.score,
        _matchInteresse: meta.matchInteresse,
        _matchCidade: meta.mesmaCidade,
        _matchUf: meta.mesmoUf,
        _dataTs: meta.dataTs,
      };
    });

    if (temPerfilRelevancia && !temFiltroManual) {
      relevadas.sort((a, b) => {
        if (b._relevanceScore !== a._relevanceScore) return b._relevanceScore - a._relevanceScore;
        if (a._dataTs && b._dataTs) return a._dataTs - b._dataTs;
        if (a._dataTs) return -1;
        if (b._dataTs) return 1;
        return 0;
      });
    } else {
      relevadas.sort((a, b) => {
        const da = getDate(a);
        const db_ = getDate(b);
        if (da && db_) return da - db_;
        if (da) return -1;
        if (db_) return 1;
        return 0;
      });
    }

    return relevadas;
  }, [activities, filtro, busca, dataInicio, dataFim, ufFiltro, cidadeFiltro, minhaCidade, minhaUf, meusInteresses]);

  const filtrosAtivosCount = [dataInicio, dataFim, ufFiltro, cidadeFiltro].filter(Boolean).length;
  const nomeEstadoFiltro = ufFiltro ? estados.find((e) => e.sigla === ufFiltro)?.nome : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {FILTROS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filtro === f && styles.filterChipActive]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[styles.filterText, filtro === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar atividades..."
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusca('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterIconBtn}
          onPress={() => setShowFiltrosModal(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={20} color={colors.primary} />
          {filtrosAtivosCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filtrosAtivosCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={lista}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma atividade encontrada com esses filtros.</Text>}
        renderItem={({ item }) => {
          const mine = item.ownerId === auth.currentUser?.uid;
          const coverUrl =
            item.photoUrls && item.photoUrls.length > 0
              ? (typeof item.photoUrls[0] === 'string' ? item.photoUrls[0] : item.photoUrls[0].url)
              : null;
          const extrasCount = (item.photoUrls?.length || 0) - 1;
          const maxP = item.maxParticipants ?? null;
          const qtdConf = confirmadosPorAtividade.get(item.id) || 0;
          const qtdEspera = esperaPorAtividade.get(item.id) || 0;
          const estaLotado = maxP != null && qtdConf >= maxP;
          const restantes = maxP == null ? Infinity : Math.max(0, maxP - qtdConf);
          const temBadgeVagas = maxP != null;

          let badgeVagasLabel = null;
          let badgeVagasVariant = 'info'; // 'danger' | 'warning' | 'info'
          if (maxP != null) {
            if (estaLotado) {
              badgeVagasLabel = qtdEspera > 0 ? `🔴 Lotado · ${qtdEspera} na fila` : '🔴 Lotado';
              badgeVagasVariant = 'danger';
            } else if (restantes === 1) {
              badgeVagasLabel = '⚡ Última vaga!';
              badgeVagasVariant = 'warning';
            } else if (restantes <= 3) {
              badgeVagasLabel = `⚡ ${restantes} vagas restantes`;
              badgeVagasVariant = 'warning';
            } else {
              badgeVagasLabel = `👥 ${qtdConf}/${maxP}`;
              badgeVagasVariant = 'info';
            }
          }

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('ActivityDetail', { activity: item, mine })}
            >
              <View style={styles.coverWrap}>
                {coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={styles.coverImg} resizeMode="cover" />
                ) : (
                  <View style={styles.coverEmpty}>
                    <Ionicons name="calendar-outline" size={38} color={colors.textFaint} />
                    <Text style={styles.coverEmptyText}>Sem foto</Text>
                  </View>
                )}

                {temBadgeVagas && (
                  <View
                    style={[
                      styles.vagasBadge,
                      badgeVagasVariant === 'danger' && styles.vagasBadgeDanger,
                      badgeVagasVariant === 'warning' && styles.vagasBadgeWarning,
                      badgeVagasVariant === 'info' && styles.vagasBadgeInfo,
                    ]}
                  >
                    <Text style={styles.vagasBadgeText} numberOfLines={1}>
                      {badgeVagasLabel}
                    </Text>
                  </View>
                )}

                {extrasCount > 0 && (
                  <View style={styles.extrasBadge}>
                    <Ionicons name="images-outline" size={13} color={colors.white} />
                    <Text style={styles.extrasBadgeText}>+{extrasCount}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                {!mine && (item._matchCidade || item._matchInteresse) && (
                  <View style={styles.relevanceRow}>
                    {item._matchCidade && (
                      <View style={[styles.relevanceBadge, styles.relevanceBadgeAccent]}>
                        <Ionicons name="location-outline" size={12} color={colors.accent} />
                        <Text style={[styles.relevanceText, styles.relevanceTextAccent]}>Na sua cidade</Text>
                      </View>
                    )}
                    {item._matchInteresse && (
                      <View style={[styles.relevanceBadge, styles.relevanceBadgeAccent]}>
                        <Ionicons name="star-outline" size={12} color={colors.accent} />
                        <Text style={[styles.relevanceText, styles.relevanceTextAccent]}>Seu interesse</Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.chipsRow}>
                  <Text style={styles.chip}>{item.type}</Text>
                  {mine && <Text style={[styles.chip, styles.chipMine]}>Sua atividade</Text>}
                </View>

                <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">
                  {item.title}
                </Text>

                <View style={styles.cardMetaRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textFaint} />
                  <Text style={styles.cardMetaText}>{item.date}</Text>
                </View>
                <View style={styles.cardMetaRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textFaint} />
                  <Text style={styles.cardMetaText} numberOfLines={1}>{item.local}</Text>
                </View>

                <View style={styles.footerRow}>
                  <View style={styles.ownerWrap}>
                    <UserAvatar userId={item.ownerId} fallbackEmail={item.ownerEmail} size={22} />
                    <Text style={styles.cardOwner} numberOfLines={1}>
                      <UserName userId={item.ownerId} fallbackEmail={item.ownerEmail} />
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={showFiltrosModal} transparent animationType="slide" onRequestClose={() => setShowFiltrosModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFiltrosModal(false)}>
          {/* Substituído o onPress vazio por stopPropagation para blindar o modal contra cliques fantasmas */}
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFiltrosModal(false)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Período</Text>
            <Text style={styles.periodoResumo}>
              {dataInicio && dataFim
                ? `${formatarDataCurta(dataInicio)} até ${formatarDataCurta(dataFim)}`
                : dataInicio
                  ? `${formatarDataCurta(dataInicio)} até... (toque na data final)`
                  : 'Toque numa data para começar'}
            </Text>

            <Calendar
              markingType="period"
              markedDates={markedDates}
              onDayPress={handleDiaPress}
              minDate={toDateString(new Date())}
              theme={{
                todayTextColor: colors.primary,
                arrowColor: colors.primary,
                textDayFontSize: 13,
                textMonthFontSize: 14,
              }}
            />

            <Text style={styles.modalLabel}>Local</Text>
            <TouchableOpacity style={styles.modalInput} onPress={() => setShowEstadoModal(true)}>
              <Text style={styles.modalInputText}>{nomeEstadoFiltro || 'Qualquer estado'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalInput, { marginTop: spacing.sm }, !ufFiltro && styles.inputDisabled]}
              onPress={() => ufFiltro && setShowCidadeModal(true)}
              disabled={!ufFiltro}
            >
              <Text style={styles.modalInputText}>
                {cidadeFiltro || (!ufFiltro ? 'Selecione o estado primeiro' : carregandoCidades ? 'Carregando...' : 'Qualquer cidade')}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, marginBottom: 4 }}>
              <Button label="Limpar" variant="outline" onPress={limparFiltros} style={{ flex: 1 }} />
              <Button label="Aplicar" onPress={() => setShowFiltrosModal(false)} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <SearchablePickerModal
        visible={showEstadoModal}
        title="Selecione o estado"
        placeholder="Pesquisar estado..."
        options={estados.map((e) => ({ label: e.nome, value: e.sigla }))}
        onSelect={onSelectEstadoFiltro}
        onClose={() => setShowEstadoModal(false)}
      />
      <SearchablePickerModal
        visible={showCidadeModal}
        title="Selecione a cidade"
        placeholder="Pesquisar cidade..."
        options={(cidades || []).map((c) => ({ label: c, value: c }))}
        onSelect={setCidadeFiltro}
        onClose={() => setShowCidadeModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.md },
  filterIconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, flexShrink: 0 },
  filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { color: colors.white, fontSize: 10, fontWeight: fontWeight.bold },
  filterContainer: { height: 44, marginTop: spacing.md, marginBottom: spacing.sm },
  filterScrollContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md + 2 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
  filterTextActive: { color: colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm + 2 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.white },
  searchInput: { flex: 1, paddingVertical: 2, fontSize: fontSize.base },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    overflow: 'hidden',
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
  coverWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.disabled,
    position: 'relative',
  },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint || colors.disabled,
    gap: spacing.xs || 2,
  },
  coverEmptyText: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    fontWeight: fontWeight.semibold,
    marginTop: 2,
  },
  vagasBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    maxWidth: '75%',
  },
  vagasBadgeDanger: { backgroundColor: colors.danger || '#ef4444' },
  vagasBadgeWarning: { backgroundColor: colors.accent || '#f59e0b' },
  vagasBadgeInfo: { backgroundColor: 'rgba(0,0,0,0.68)' },
  vagasBadgeText: { color: colors.white, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  extrasBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
  },
  extrasBadgeText: { color: colors.white, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  cardBody: {
    padding: spacing.md + 2,
    gap: 5,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 2,
  },
  chip: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, backgroundColor: colors.primaryTint, color: colors.primaryDark, paddingVertical: 3, paddingHorizontal: spacing.sm + 1, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipMine: { backgroundColor: colors.accentTint, color: colors.accent },
  relevanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  relevanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill },
  relevanceBadgeAccent: { backgroundColor: colors.accentTint },
  relevanceText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  relevanceTextAccent: { color: colors.accent },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
    marginBottom: 2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  cardMetaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  footerRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardOwner: {
    fontSize: fontSize.sm,
    color: colors.textFaint,
    flex: 1,
  },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 40 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 32, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm + 2 },
  modalTitle: { fontWeight: fontWeight.bold, fontSize: fontSize.xl },
  modalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textSecondary, marginTop: spacing.md + 2, marginBottom: spacing.sm - 2 },
  periodoResumo: { fontSize: fontSize.md, color: colors.text, marginBottom: spacing.sm },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, justifyContent: 'center' },
  modalInputText: { fontSize: fontSize.base, color: colors.text },
  inputDisabled: { opacity: 0.5 },
});