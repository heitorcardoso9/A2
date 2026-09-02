import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, Image, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import UserName from '../components/UserName';
import UserAvatar from '../components/UserAvatar';
import SearchablePickerModal from '../components/SearchablePickerModal';
import Button from '../components/Button';
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
  const [filtro, setFiltro] = useState('Todos');
  const [busca, setBusca] = useState('');

  const [showFiltrosModal, setShowFiltrosModal] = useState(false);
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);

  const [ufFiltro, setUfFiltro] = useState('');
  const [cidadeFiltro, setCidadeFiltro] = useState('');
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showCidadeModal, setShowCidadeModal] = useState(false);

  const estados = useIBGEEstados();
  const { cidades, carregando: carregandoCidades } = useIBGECidades(ufFiltro);

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setActivities(lista);
    });
    return unsubscribe;
  }, []);

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

  const lista = useMemo(() => {
    const agora = new Date();
    const termo = normalizar(busca);

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

    return filtradas.sort((a, b) => {
      const da = getDate(a);
      const db_ = getDate(b);
      if (da && db_) return da - db_;
      if (da) return -1;
      if (db_) return 1;
      return 0;
    });
  }, [activities, filtro, busca, dataInicio, dataFim, ufFiltro, cidadeFiltro]);

  const filtrosAtivosCount = [dataInicio, dataFim, ufFiltro, cidadeFiltro].filter(Boolean).length;
  const nomeEstadoFiltro = ufFiltro ? estados.find((e) => e.sigla === ufFiltro)?.nome : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.wordmark}>Companhia</Text>
        <TouchableOpacity style={styles.filterIconBtn} onPress={() => setShowFiltrosModal(true)}>
          <Ionicons name="options-outline" size={20} color={colors.primary} />
          {filtrosAtivosCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filtrosAtivosCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

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

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar atividades..."
          value={busca}
          onChangeText={setBusca}
        />
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
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('ActivityDetail', { activity: item, mine })}
            >
              {coverUrl ? (
                <View style={styles.coverWrap}>
                  <Image source={{ uri: coverUrl }} style={styles.coverImg} resizeMode="cover" />
                  {extrasCount > 0 && (
                    <View style={styles.extrasBadge}>
                      <Ionicons name="images-outline" size={13} color={colors.white} />
                      <Text style={styles.extrasBadgeText}>+{extrasCount}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.coverWrap, styles.coverEmpty]}>
                  <Ionicons name="calendar-outline" size={38} color={colors.textFaint} />
                  <Text style={styles.coverEmptyText}>Sem foto</Text>
                </View>
              )}

              <View style={styles.cardBody}>
                <View style={styles.chipsRow}>
                  <Text style={styles.chip}>{item.type}</Text>
                  {mine && <Text style={[styles.chip, styles.chipMine]}>Sua</Text>}
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
        options={cidades.map((c) => ({ label: c, value: c }))}
        onSelect={setCidadeFiltro}
        onClose={() => setShowCidadeModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  wordmark: { fontSize: fontSize.title, fontWeight: fontWeight.extrabold, color: colors.primary },
  filterIconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { color: colors.white, fontSize: 10, fontWeight: fontWeight.bold },
  filterContainer: { height: 44, marginBottom: spacing.sm },
  filterScrollContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md + 2 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
  filterTextActive: { color: colors.white },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm + 2 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: fontSize.base },
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
  },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: {
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