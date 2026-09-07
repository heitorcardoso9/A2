import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, KeyboardAvoidingView, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../services/firebase';
import SearchablePickerModal from '../components/SearchablePickerModal';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';
import { useIBGEEstados, useIBGECidades } from '../hooks/useIBGELocations';

const TIPOS = ['Restaurante', 'Esporte', 'Cinema', 'Shows e eventos', 'Passeio', 'Viagem', 'Outros'];
const MAX_FOTOS_ATIVIDADE = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [vagas, setVagas] = useState('0');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [uf, setUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [pendingCidade, setPendingCidade] = useState(null);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showCidadeModal, setShowCidadeModal] = useState(false);

  const [photos, setPhotos] = useState([]); // {id, uri, url?, path?, isNew}
  const [photosOriginais, setPhotosOriginais] = useState([]); // snapshot para edição

  const [loading, setLoading] = useState(false);

  const estados = useIBGEEstados();
  const { cidades, carregando: carregandoCidades } = useIBGECidades(uf);

  useEffect(() => {
    if (isEditing) {
      setTipo(activityParam.type || TIPOS[0]);
      setTitulo(activityParam.title || '');
      setDesc(activityParam.desc || '');
      setVagas(activityParam.maxParticipants != null ? String(activityParam.maxParticipants) : '0');
      if (activityParam.dateTime) {
        const d = activityParam.dateTime.toDate ? activityParam.dateTime.toDate() : new Date(activityParam.dateTime);
        setDataHora(d);
      }
      if (activityParam.uf) {
        setUf(activityParam.uf);
        if (activityParam.cidade) setPendingCidade(activityParam.cidade);
      }
      const existentes = (activityParam.photoUrls || []).map((item, i) => ({
        id: `existing-${i}`,
        uri: typeof item === 'string' ? item : item.url,
        url: typeof item === 'string' ? item : item.url,
        path: typeof item === 'string' ? activityParam.photoPaths?.[i] : item.path,
        isNew: false,
      }));
      setPhotos(existentes);
      setPhotosOriginais(existentes);
    }
  }, []);

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

  function onValueChangeDate(_, selected) {
    if (Platform.OS === 'ios') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
    }
    if (!selected) return;
    const nova = new Date(dataHora);
    nova.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setDataHora(nova);
  }

  function onDismissDate() {
    setShowDatePicker(false);
  }

  function onValueChangeTime(_, selected) {
    if (Platform.OS === 'ios') {
      setShowTimePicker(true);
    } else {
      setShowTimePicker(false);
    }
    if (!selected) return;
    const nova = new Date(dataHora);
    nova.setHours(selected.getHours(), selected.getMinutes());
    setDataHora(nova);
  }

  function onDismissTime() {
    setShowTimePicker(false);
  }

  function resetForm() {
    setTipo(TIPOS[0]);
    setTitulo('');
    setDesc('');
    setDataHora(horarioPadrao());
    setUf('');
    setCidade('');
    setVagas('0');
  }

  function handleCancelar() {
    resetForm();
  }

  async function adicionarFotos() {
    const vagas = MAX_FOTOS_ATIVIDADE - photos.length;
    if (vagas <= 0) {
      Alert.alert('Limite atingido', `Cada atividade pode ter no máximo ${MAX_FOTOS_ATIVIDADE} fotos.`);
      return;
    }
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: vagas,
      quality: 0.55,
      maxWidth: 1280,
      maxHeight: 1280,
    });
    if (resultado.canceled) return;
    const assets = resultado.assets.slice(0, vagas);
    const novas = assets.map((asset, i) => ({
      id: `new-${Date.now()}-${i}`,
      uri: asset.uri,
      isNew: true,
    }));
    setPhotos((prev) => [...prev, ...novas]);
  }

  function removerFoto(item) {
    setPhotos((prev) => prev.filter((p) => p.id !== item.id));
  }

  function ehDataHoje(d) {
    const hoje = new Date();
    return (
      d.getFullYear() === hoje.getFullYear() &&
      d.getMonth() === hoje.getMonth() &&
      d.getDate() === hoje.getDate()
    );
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
    if (dataHora.getTime() < Date.now()) {
      Alert.alert('Ops', 'O horário da atividade já passou! Escolha uma data e hora futuras.');
      return;
    }
    const vagasNum = Number(String(vagas || '0').replace(/[^0-9]/g, ''));
    if (isNaN(vagasNum) || vagasNum < 0) {
      Alert.alert('Ops', 'Número de vagas inválido. Deixe 0 para ilimitadas.');
      return;
    }
    const maxParticipants = vagasNum === 0 ? null : vagasNum;
    setLoading(true);
    try {
      const dadosBase = {
        type: tipo,
        title: titulo.trim(),
        date: `${formatarData(dataHora)}, ${formatarHora(dataHora)}`,
        dateTime: dataHora,
        local: `${cidade}, ${uf}`,
        uf,
        cidade,
        desc: desc.trim() || 'Sem descrição.',
        maxParticipants,
      };

      async function uploadAllPhotosFor(activityId) {
        const finais = [];
        for (let i = 0; i < photos.length; i++) {
          const item = photos[i];
          if (item.isNew) {
            console.log(`[upload] foto ${i + 1}/${photos.length}: uri ok? ${!!item.uri}`);
            let blob;
            try {
              const resposta = await fetch(item.uri);
              blob = await resposta.blob();
              console.log(`[upload] foto ${i + 1}: blob carregado (${blob.size} bytes)`);
            } catch (e) {
              console.error(`[upload] foto ${i + 1}: ERRO ao carregar blob`, e);
              throw e;
            }
            const path = `activities/${activityId}/${Date.now()}-${i}.jpg`;
            const storageRef = ref(storage, path);
            console.log(`[upload] foto ${i + 1}: uploadBytes -> ${path}`);
            try {
              await uploadBytes(storageRef, blob);
            } catch (e) {
              console.error(`[upload] foto ${i + 1}: ERRO no uploadBytes`, e?.code || '', e?.message || '', e?.serverResponse || '');
              throw e;
            }
            let url;
            try {
              url = await getDownloadURL(storageRef);
              console.log(`[upload] foto ${i + 1}: getDownloadURL ok`);
            } catch (e) {
              console.error(`[upload] foto ${i + 1}: ERRO no getDownloadURL`, e);
              throw e;
            }
            finais.push({ url, path });
          } else {
            finais.push({ url: item.url, path: item.path });
          }
        }
        return finais;
      }

      async function apagarFotosRemovidas(finais) {
        const pathsFinais = new Set(finais.filter((f) => f.path).map((f) => f.path));
        const removidas = photosOriginais.filter((orig) => orig.path && !pathsFinais.has(orig.path));
        await Promise.all(
          removidas.map((item) =>
            deleteObject(ref(storage, item.path)).catch(() => {})
          )
        );
      }

      if (isEditing) {
        const activityId = activityParam.id;
        const finais = await uploadAllPhotosFor(activityId);
        await updateDoc(doc(db, 'activities', activityId), {
          ...dadosBase,
          photoUrls: finais.map((f) => f.url),
          photoPaths: finais.map((f) => f.path),
        });
        await apagarFotosRemovidas(finais);
        Alert.alert('Pronto!', 'Atividade atualizada.');
        navigation.goBack();
      } else {
        const docRef = await addDoc(collection(db, 'activities'), {
          ...dadosBase,
          ownerId: auth.currentUser.uid,
          ownerEmail: auth.currentUser.email,
          createdAt: serverTimestamp(),
        });
        const finais = await uploadAllPhotosFor(docRef.id);
        if (finais.length > 0) {
          await updateDoc(docRef, {
            photoUrls: finais.map((f) => f.url),
            photoPaths: finais.map((f) => f.path),
          });
        }
        resetForm();
        Alert.alert('Pronto!', 'Atividade publicada.');
        navigation.navigate('Feed');
      }
    } catch (error) {
      console.error('[CreateActivity] Erro ao publicar:', error);
      const msg = error?.message || String(error || '');
      Alert.alert(
        'Erro',
        'Não foi possível salvar agora. Tente de novo.\n\nDetalhe: ' + (msg ? msg.slice(0, 120) : 'sem detalhe')
      );
    } finally {
      setLoading(false);
    }
  }

  const nomeEstadoSelecionado = uf ? estados.find((e) => e.sigla === uf)?.nome : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title={isEditing ? 'Editar atividade' : 'Criar atividade'}
          onBack={isEditing ? () => navigation.goBack() : null}
        />

        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
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
              onValueChange={onValueChangeDate}
              onDismiss={onDismissDate}
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
            <DateTimePicker
              value={dataHora}
              mode="time"
              display="spinner"
              minimumDate={ehDataHoje(dataHora) ? new Date() : undefined}
              onValueChange={onValueChangeTime}
              onDismiss={onDismissTime}
            />
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

          <Text style={styles.label}>Vagas</Text>
          <TextInput
            style={styles.input}
            value={vagas}
            onChangeText={(t) => setVagas(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="0 = ilimitadas"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>Deixe 0 para permitir quantas pessoas quiserem.</Text>

          <Text style={styles.label}>Fotos ({photos.length}/{MAX_FOTOS_ATIVIDADE})</Text>
          <Text style={styles.hint}>Adicione até {MAX_FOTOS_ATIVIDADE} fotos para ilustrar sua atividade.</Text>
          <View style={styles.photoGrid}>
            {photos.map((item) => (
              <View key={item.id} style={styles.photoWrap}>
                <Image source={{ uri: item.uri }} style={styles.photoImg} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removerFoto(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_FOTOS_ATIVIDADE && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={adicionarFotos}>
                <Ionicons name="add" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <Button
            label={loading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Publicar atividade'}
            onPress={handlePublicar}
            disabled={loading}
            style={{ marginTop: spacing.xl + 2 }}
          />

          {!isEditing && (
            <Button label="Cancelar" variant="ghost" onPress={handleCancelar} disabled={loading} style={{ marginTop: spacing.sm }} />
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
  container: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textSecondary, marginTop: spacing.md + 2, marginBottom: spacing.sm - 2 },
  hint: { fontSize: fontSize.sm, color: colors.textFaint, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.base, justifyContent: 'center' },
  inputDisabled: { opacity: 0.5 },
  inputText: { fontSize: fontSize.base, color: colors.text },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: 4 },
  doneBtnText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md + 2 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
  chipTextActive: { color: colors.white },
  counter: { fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'right', marginTop: 4 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoWrap: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.disabled,
  },
  photoImg: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});