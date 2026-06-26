import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import UserName from '../components/UserName';
import SearchablePickerModal from '../components/SearchablePickerModal';

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

export default function FeedScreen({ navigation }) {
  const [activities, setActivities] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [busca, setBusca] = useState('');

  const [showFiltrosModal, setShowFiltrosModal] = useState(false);
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [showInicioPicker, setShowInicioPicker] = useState(false);
  const [showFimPicker, setShowFimPicker] = useState(false);

  const [estados, setEstados] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [ufFiltro, setUfFiltro] = useState('');
  const [cidadeFiltro, setCidadeFiltro] = useState('');
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showCidadeModal, setShowCidadeModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setActivities(lista);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then((r) => r.json())
      .then(setEstados)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ufFiltro) {
      setCidades([]);
      return;
    }
    setCarregandoCidades(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufFiltro}/municipios`)
      .then((r) => r.json())
      .then((lista) => setCidades(lista.map((m) => m.nome).sort((a, b) => a.localeCompare(b))))
      .catch(() => setCidades([]))
      .finally(() => setCarregandoCidades(false));
  }, [ufFiltro]);

  function onSelectEstadoFiltro(sigla) {
    setUfFiltro(sigla);
    setCidadeFiltro('');
  }

  function onChangeInicio(event, selected) {
    setShowInicioPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;
    setDataInicio(selected);
  }

  function onChangeFim(event, selected) {
    setShowFimPicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;
    setDataFim(selected);
  }

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
      if (dt && dt < agora) return false; // esconde atividades que já passaram
      if (filtro !== 'Todos' && a.type !== filtro) return false;
      if (dataInicio && dt && dt < dataInicio) return false;
      if (dataFim && dt) {
        const fimDoDia = new Date(dataFim);
        fimDoDia.setHours(23, 59, 59, 999);
        if (dt > fimDoDia) return false;
      }
      if (ufFiltro && a.uf !== ufFiltro) return false;
      if (cidadeFiltro && a.cidade !== cidadeFiltro) return false;
      if (filtro === 'Outros' && busca.trim()) {
        const tituloOk = normalizar(a.title || '').includes(termo);
        const descOk = normalizar(a.desc || '').includes(termo);
        if (!tituloOk && !descOk) return false;
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
          <Ionicons name="options-outline" size={20} color="#0E5C46" />
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

      {filtro === 'Outros' && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#8B958F" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar em Outros..."
            value={busca}
            onChangeText={setBusca}
          />
        </View>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={lista}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma atividade encontrada com esses filtros.</Text>}
        renderItem={({ item }) => {
          const mine = item.ownerId === auth.currentUser?.uid;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('ActivityDetail', { activity: item, mine })}
            >
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Text style={styles.chip}>{item.type}</Text>
                {mine && <Text style={[styles.chip, styles.chipMine]}>Sua atividade</Text>}
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>{item.date} · {item.local}</Text>
              {!mine && (
                <Text style={styles.cardOwner}>
                  com <UserName userId={item.ownerId} fallbackEmail={item.ownerEmail} />
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={showFiltrosModal} transparent animationType="slide" onRequestClose={() => setShowFiltrosModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFiltrosModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFiltrosModal(false)}>
                <Ionicons name="close" size={20} color="#5C6962" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Período</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.modalInput, { flex: 1 }]} onPress={() => setShowInicioPicker(true)}>
                <Text style={styles.modalInputText}>{dataInicio ? formatarDataCurta(dataInicio) : 'De'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalInput, { flex: 1 }]} onPress={() => setShowFimPicker(true)}>
                <Text style={styles.modalInputText}>{dataFim ? formatarDataCurta(dataFim) : 'Até'}</Text>
              </TouchableOpacity>
            </View>

            {showInicioPicker && (
              <DateTimePicker
                value={dataInicio || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={onChangeInicio}
              />
            )}
            {Platform.OS === 'ios' && showInicioPicker && (
              <TouchableOpacity style={styles.doneBtn} onPress={() => setShowInicioPicker(false)}>
                <Text style={styles.doneBtnText}>Concluído</Text>
              </TouchableOpacity>
            )}
            {showFimPicker && (
              <DateTimePicker
                value={dataFim || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={onChangeFim}
              />
            )}
            {Platform.OS === 'ios' && showFimPicker && (
              <TouchableOpacity style={styles.doneBtn} onPress={() => setShowFimPicker(false)}>
                <Text style={styles.doneBtnText}>Concluído</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.modalLabel}>Local</Text>
            <TouchableOpacity style={styles.modalInput} onPress={() => setShowEstadoModal(true)}>
              <Text style={styles.modalInputText}>{nomeEstadoFiltro || 'Qualquer estado'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalInput, { marginTop: 8 }, !ufFiltro && styles.inputDisabled]}
              onPress={() => ufFiltro && setShowCidadeModal(true)}
              disabled={!ufFiltro}
            >
              <Text style={styles.modalInputText}>
                {cidadeFiltro || (!ufFiltro ? 'Selecione o estado primeiro' : carregandoCidades ? 'Carregando...' : 'Qualquer cidade')}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <TouchableOpacity style={styles.modalBtnGhost} onPress={limparFiltros}>
                <Text style={styles.modalBtnGhostText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setShowFiltrosModal(false)}>
                <Text style={styles.modalBtnPrimaryText}>Aplicar</Text>
              </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  wordmark: { fontSize: 18, fontWeight: '800', color: '#0E5C46' },
  filterIconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#DD6433', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  filterContainer: { height: 44, marginBottom: 8 },
  filterScrollContent: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
  filterChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  filterChipActive: { backgroundColor: '#0E5C46', borderColor: '#0E5C46' },
  filterText: { color: '#5C6962', fontWeight: '600', fontSize: 13 },
  filterTextActive: { color: '#fff' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14 },
  chip: { fontSize: 11, fontWeight: '700', backgroundColor: '#E3F0EA', color: '#0A4334', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, alignSelf: 'flex-start' },
  chipMine: { backgroundColor: '#FBE7DB', color: '#DD6433' },
  cardTitle: { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#5C6962' },
  cardOwner: { fontSize: 12, color: '#8B958F', marginTop: 4 },
  empty: { textAlign: 'center', color: '#8B958F', marginTop: 40 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontWeight: '700', fontSize: 16 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#5C6962', marginTop: 14, marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, justifyContent: 'center' },
  modalInputText: { fontSize: 14, color: '#1B231F' },
  inputDisabled: { opacity: 0.5 },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  doneBtnText: { color: '#0E5C46', fontWeight: '700', fontSize: 14 },
  modalBtnGhost: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  modalBtnGhostText: { textAlign: 'center', fontWeight: '700', color: '#5C6962' },
  modalBtnPrimary: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#0E5C46' },
  modalBtnPrimaryText: { textAlign: 'center', fontWeight: '700', color: '#fff' },
});