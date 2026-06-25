import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import SearchablePickerModal from '../components/SearchablePickerModal';

const TIPOS = ['Restaurante', 'Esporte', 'Cinema', 'Viagem', 'Outros'];

function horarioPadrao() {
  const novo = new Date();
  novo.setHours(12, 0, 0, 0);
  return novo;
}

export default function CreateActivityScreen({ navigation, route }) {
  const activityParam = route.params?.activity || null;
  const isEditing = !!activityParam;

  const [tipo, setTipo] = useState(TIPOS[0]);
  const [titulo, setTitulo] = useState('');
  const [desc, setDesc] = useState('');
  const [dataHora, setDataHora] = useState(horarioPadrao);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [estados, setEstados] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [uf, setUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [pendingCidade, setPendingCidade] = useState(null);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showCidadeModal, setShowCidadeModal] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then((r) => r.json())
      .then(setEstados)
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (isEditing) {
      setTipo(activityParam.type || TIPOS[0]);
      setTitulo(activityParam.title || '');
      setDesc(activityParam.desc || '');
      if (activityParam.dateTime) {
        const d = activityParam.dateTime.toDate ? activityParam.dateTime.toDate() : new Date(activityParam.dateTime);
        setDataHora(d);
      }
      if (activityParam.uf) {
        setUf(activityParam.uf);
        if (activityParam.cidade) setPendingCidade(activityParam.cidade);
      }
    }
  }, []);

  useEffect(() => {
    if (!uf) {
      setCidades([]);
      return;
    }
    setCarregandoCidades(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then((r) => r.json())
      .then((lista) => setCidades(lista.map((m) => m.nome).sort((a, b) => a.localeCompare(b))))
      .catch(() => setCidades([]))
      .finally(() => setCarregandoCidades(false));
  }, [uf]);

  useEffect(() => {
    if (pendingCidade && cidades.includes(pendingCidade)) {
      setCidade(pendingCidade);
      setPendingCidade(null);
    }
  }, [cidades, pendingCidade]);

  function onChangeUf(novaUf) {
    setUf(novaUf);
    setCidade('');
  }

  function formatarData(d) {
    const texto = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function formatarHora(d) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function onChangeDate(event, selected) {
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;
    const nova = new Date(dataHora);
    nova.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setDataHora(nova);
  }

  function onChangeTime(event, selected) {
    setShowTimePicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;
    const nova = new Date(dataHora);
    nova.setHours(selected.getHours(), selected.getMinutes());
    setDataHora(nova);
  }

  function resetForm() {
    setTipo(TIPOS[0]);
    setTitulo('');
    setDesc('');
    setDataHora(horarioPadrao());
    setUf('');
    setCidade('');
  }

  function handleCancelar() {
    resetForm();
  }

  async function handlePublicar() {
    if (!titulo.trim()) {
      Alert.alert('Ops', 'Preencha o título da atividade.');
      return;
    }
    if (!uf || !cidade) {
      Alert.alert('Ops', 'Selecione o estado e a cidade.');
      return;
    }
    setLoading(true);
    try {
      const dados = {
        type: tipo,
        title: titulo.trim(),
        date: `${formatarData(dataHora)}, ${formatarHora(dataHora)}`,
        dateTime: dataHora,
        local: `${cidade}, ${uf}`,
        uf,
        cidade,
        desc: desc.trim() || 'Sem descrição.',
      };

      if (isEditing) {
        await updateDoc(doc(db, 'activities', activityParam.id), dados);
        Alert.alert('Pronto!', 'Atividade atualizada.');
        navigation.goBack();
      } else {
        await addDoc(collection(db, 'activities'), {
          ...dados,
          ownerId: auth.currentUser.uid,
          ownerEmail: auth.currentUser.email,
          createdAt: serverTimestamp(),
        });
        resetForm();
        Alert.alert('Pronto!', 'Atividade publicada.');
        navigation.navigate('Feed');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar agora. Tente de novo.');
    } finally {
      setLoading(false);
    }
  }

  const nomeEstadoSelecionado = uf ? estados.find((e) => e.sigla === uf)?.nome : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          {isEditing ? (
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.back}>‹ Voltar</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          )}
          <Text style={styles.headerTitle}>{isEditing ? 'Editar atividade' : 'Criar atividade'}</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.chipRow}>
            {TIPOS.map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, tipo === t && styles.chipActive]} onPress={() => setTipo(t)}>
                <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Título</Text>
          <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Ex: Trilha na Pedra Grande" maxLength={60} />
          <Text style={styles.counter}>{titulo.length}/60</Text>

          <Text style={styles.label}>Data</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputText}>{formatarData(dataHora)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dataHora}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              minimumDate={new Date()}
              onChange={onChangeDate}
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.doneBtnText}>Concluído</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Horário</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.inputText}>{formatarHora(dataHora)}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker value={dataHora} mode="time" display="spinner" onChange={onChangeTime} />
          )}
          {Platform.OS === 'ios' && showTimePicker && (
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTimePicker(false)}>
              <Text style={styles.doneBtnText}>Concluído</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Estado</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowEstadoModal(true)}>
            <Text style={styles.inputText}>{nomeEstadoSelecionado || 'Selecione o estado'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Cidade</Text>
          <TouchableOpacity
            style={[styles.input, !uf && styles.inputDisabled]}
            onPress={() => uf && setShowCidadeModal(true)}
            disabled={!uf}
          >
            <Text style={styles.inputText}>
              {cidade || (!uf ? 'Selecione o estado primeiro' : carregandoCidades ? 'Carregando cidades...' : 'Selecione a cidade')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Conte mais sobre essa atividade"
            multiline
            maxLength={500}
          />
          <Text style={styles.counter}>{desc.length}/500</Text>

          <TouchableOpacity style={styles.button} onPress={handlePublicar} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Publicar atividade'}</Text>
          </TouchableOpacity>

          {!isEditing && (
            <TouchableOpacity style={styles.buttonGhost} onPress={handleCancelar} disabled={loading}>
              <Text style={styles.buttonGhostText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SearchablePickerModal
        visible={showEstadoModal}
        title="Selecione o estado"
        placeholder="Pesquisar estado..."
        options={estados.map((e) => ({ label: e.nome, value: e.sigla }))}
        onSelect={onChangeUf}
        onClose={() => setShowEstadoModal(false)}
      />

      <SearchablePickerModal
        visible={showCidadeModal}
        title="Selecione a cidade"
        placeholder="Pesquisar cidade..."
        options={cidades.map((c) => ({ label: c, value: c }))}
        onSelect={setCidade}
        onClose={() => setShowCidadeModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  back: { color: '#0E5C46', fontWeight: '700', fontSize: 16 },
  headerTitle: { fontWeight: '700', fontSize: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#5C6962', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, justifyContent: 'center' },
  inputDisabled: { opacity: 0.5 },
  inputText: { fontSize: 14, color: '#1B231F' },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  doneBtnText: { color: '#0E5C46', fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  chipActive: { backgroundColor: '#0E5C46', borderColor: '#0E5C46' },
  chipText: { color: '#5C6962', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  button: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10, marginTop: 22 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  buttonGhost: { padding: 12, marginTop: 8 },
  buttonGhostText: { textAlign: 'center', fontWeight: '700', color: '#5C6962' },
  counter: { fontSize: 11, color: '#8B958F', textAlign: 'right', marginTop: 4 },
});