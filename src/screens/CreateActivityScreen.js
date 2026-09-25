import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, KeyboardAvoidingView, Dimensions } from 'react-native';
import { Image as RNExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../services/firebase';
import SearchablePickerModal from '../components/SearchablePickerModal';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';
import { useIBGEEstados, useIBGECidades } from '../hooks/useIBGELocations';

const TIPOS = ['Restaurante', 'Esporte', 'Cinema', 'Shows e eventos', 'Passeio', 'Viagem', 'Outros'];
const TIPO_ICONS = {
  'Restaurante': '🍽️',
  'Esporte': '⚽',
  'Cinema': '🎬',
  'Shows e eventos': '🎤',
  'Passeio': '🌳',
  'Viagem': '✈️',
  'Outros': '✨',
};
const TIPO_SUGESTOES = {
  'Restaurante': 'Ex: Jantar japonês sábado 20h',
  'Esporte': 'Ex: Futebol no clube sábado a tarde',
  'Cinema': 'Ex: Filme novo no shopping 19h',
  'Shows e eventos': 'Ex: Show de rock na casa de shows',
  'Passeio': 'Ex: Trilha na Pedra Grande domingo manhã',
  'Viagem': 'Ex: Final de semana na praia',
  'Outros': 'Ex: Encontro para tomar um café',
};
const MAX_FOTOS_ATIVIDADE = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HORARIOS_POPULARES = [
  { hora: 8, minuto: 0, label: '08:00', tag: 'Manhã' },
  { hora: 9, minuto: 0, label: '09:00', tag: 'Manhã' },
  { hora: 10, minuto: 0, label: '10:00', tag: 'Manhã' },
  { hora: 11, minuto: 0, label: '11:00', tag: 'Manhã' },
  { hora: 12, minuto: 0, label: '12:00', tag: 'Almoço' },
  { hora: 13, minuto: 0, label: '13:00', tag: 'Almoço' },
  { hora: 14, minuto: 0, label: '14:00', tag: 'Tarde' },
  { hora: 15, minuto: 0, label: '15:00', tag: 'Tarde' },
  { hora: 16, minuto: 0, label: '16:00', tag: 'Tarde' },
  { hora: 17, minuto: 0, label: '17:00', tag: 'Tarde' },
  { hora: 18, minuto: 0, label: '18:00', tag: 'Noite' },
  { hora: 19, minuto: 0, label: '19:00', tag: 'Noite' },
  { hora: 20, minuto: 0, label: '20:00', tag: 'Noite' },
  { hora: 21, minuto: 0, label: '21:00', tag: 'Noite' },
  { hora: 22, minuto: 0, label: '22:00', tag: 'Noite' },
];

export default function CreateActivityScreen({ navigation, route }) {
  const activityParam = route.params?.activity || null;
  const isEditing = !!activityParam;

  const [tipo, setTipo] = useState(isEditing ? (activityParam.type || TIPOS[0]) : null);
  const [titulo, setTitulo] = useState('');
  const [desc, setDesc] = useState('');
  const [dataSelecionada, setDataSelecionada] = useState(isEditing ? null : null);
  const [horaSelecionada, setHoraSelecionada] = useState(isEditing ? null : null);
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
  const [showTypeHint, setShowTypeHint] = useState(false);

  const estados = useIBGEEstados() || [];
  const { cidades = [], carregando: carregandoCidades } = useIBGECidades(uf);

  useEffect(() => {
    if (isEditing) {
      setTipo(activityParam.type || TIPOS[0]);
      setTitulo(activityParam.title || '');
      setDesc(activityParam.desc || '');
      setVagas(activityParam.maxParticipants != null ? String(activityParam.maxParticipants) : '0');
      if (activityParam.dateTime) {
        const d = activityParam.dateTime.toDate ? activityParam.dateTime.toDate() : new Date(activityParam.dateTime);
        setDataSelecionada(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        setHoraSelecionada({ hora: d.getHours(), minuto: d.getMinutes(), label: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
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

  const dataHora = useMemo(() => {
    if (!dataSelecionada && !horaSelecionada) return null;
    const d = dataSelecionada ? new Date(dataSelecionada) : new Date();
    if (horaSelecionada) {
      d.setHours(horaSelecionada.hora, horaSelecionada.minuto, 0, 0);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }, [dataSelecionada, horaSelecionada]);

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
    setDataSelecionada(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()));
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
    setHoraSelecionada({
      hora: selected.getHours(),
      minuto: selected.getMinutes(),
      label: selected.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  function onDismissTime() {
    setShowTimePicker(false);
  }

  function resetForm() {
    setTipo(null);
    setTitulo('');
    setDesc('');
    setDataSelecionada(null);
    setHoraSelecionada(null);
    setUf('');
    setCidade('');
    setVagas('0');
    setPhotos([]);
    setPhotosOriginais([]);
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
    if (!tipo) {
      Alert.alert('Ops', 'Escolha o tipo da atividade.');
      return;
    }
    if (!titulo.trim()) {
      Alert.alert('Ops', 'Preencha o título da atividade.');
      return;
    }
    if (!uf || !cidade) {
      Alert.alert('Ops', 'Selecione o estado e a cidade.');
      return;
    }
    if (!dataHora) {
      Alert.alert('Ops', 'Selecione a data e o horário da atividade.');
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
              blob = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.onload = function () {
                  resolve(xhr.response);
                };
                xhr.onerror = function (err) {
                  reject(err || new Error('XHR blob falhou'));
                };
                xhr.responseType = 'blob';
                xhr.open('GET', item.uri, true);
                xhr.send(null);
              });
              console.log(`[upload] foto ${i + 1}: XHR blob nativo ok (size ${blob?.size ?? '?'} bytes)`);
            } catch (e) {
              console.error(`[upload] foto ${i + 1}: ERRO no XHR blob`, e);
              throw e;
            }
            const path = `activities/${activityId}/${Date.now()}-${i}.jpg`;
            const storageRef = ref(storage, path);
            console.log(`[upload] foto ${i + 1}: uploadBytes (blob nativo pronto) -> ${path}`);
            try {
              await uploadBytes(storageRef, blob);
            } catch (e) {
              console.error(`[upload] foto ${i + 1}: ERRO no uploadBytes`, e?.code || '', e?.message || '', e?.serverResponse || '');
              throw e;
            } finally {
              if (blob && typeof blob.close === 'function') {
                try { blob.close(); } catch {}
              }
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

  const progresso = useMemo(() => {
    const itens = [
      !!tipo,
      !!titulo.trim(),
      !!dataSelecionada,
      !!horaSelecionada,
      !!uf,
      !!cidade,
    ];
    const base = itens.filter(Boolean).length / itens.length;
    let bonus = 0;
    if (desc.trim()) bonus += 0.03;
    if (photos.length > 0) bonus += 0.03;
    if (Number(vagas) > 0) bonus += 0.02;
    return Math.min(1, base + bonus);
  }, [tipo, titulo, dataSelecionada, horaSelecionada, uf, cidade, desc, photos, vagas]);

  const placeholderTitulo = tipo ? TIPO_SUGESTOES[tipo] : 'Ex: Trilha na Pedra Grande';
  const textoProgresso = progresso >= 1
    ? 'Tudo pronto para publicar! 🎉'
    : `${Math.round(progresso * 100)}% preenchido`;
  const bordaErroTipo = !tipo && showTypeHint;

  useEffect(() => {
    if (isEditing) return;
    const t = setTimeout(() => setShowTypeHint(true), 1500);
    return () => clearTimeout(t);
  }, [isEditing]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Barra de progresso STICKY (sempre visível no topo) */}
        <View style={styles.progressSticky}>
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progresso * 100}%`, backgroundColor: progresso >= 1 ? colors.success : colors.primary }]} />
            </View>
            <Text style={styles.progressText}>{textoProgresso}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.xxl + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* SEÇÃO 1: TIPO */}
          <View style={[styles.sectionCard, bordaErroTipo && styles.sectionCardHint]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Text style={{ fontSize: fontSize.md }}>🧩</Text>
              </View>
              <Text style={styles.sectionTitle}>Qual o tipo do rolê?</Text>
              {bordaErroTipo && (
                <Ionicons name="alert-circle" size={18} color={colors.accent} style={{ marginLeft: 'auto' }} />
              )}
            </View>
            <View style={styles.chipRow}>
              {TIPOS.map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, tipo === t && styles.chipActive]} onPress={() => { setTipo(t); if (showTypeHint) setShowTypeHint(false); }}>
                  <Text style={styles.chipEmoji}>{TIPO_ICONS[t]}</Text>
                  <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {bordaErroTipo && (
              <Text style={styles.hintError}>Toque em um tipo para escolher</Text>
            )}
          </View>

          {/* SEÇÃO 2: SOBRE (Título + Descrição) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Sobre o rolê</Text>
            </View>

            <Text style={styles.labelInline}>Título</Text>
            <TextInput
              style={[styles.input, styles.inputInsideCard]}
              value={titulo}
              onChangeText={setTitulo}
              placeholder={placeholderTitulo}
              placeholderTextColor={colors.textFaint}
              maxLength={60}
            />
            <Text style={styles.counter}>{titulo.length}/60</Text>

            <Text style={styles.labelInline}>Descrição <Text style={styles.labelOptional}>(opcional)</Text></Text>
            <TextInput
              style={[styles.input, styles.inputInsideCard, styles.inputMultiline]}
              value={desc}
              onChangeText={setDesc}
              placeholder="Conte mais sobre o que vai rolar"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={500}
            />
            <Text style={styles.counter}>{desc.length}/500</Text>
          </View>

          {/* SEÇÃO 3: QUANDO E ONDE */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Quando e onde?</Text>
            </View>

            <Text style={styles.labelInline}>Data</Text>
            <TouchableOpacity style={[styles.input, styles.inputInsideCard, styles.inputRow]} onPress={() => setShowDatePicker((v) => !v)}>
              <Text style={[styles.inputText, !dataSelecionada && styles.inputTextDim]}>{dataSelecionada ? formatarData(dataSelecionada) : 'Selecione a data'}</Text>
              <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {showDatePicker && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={dataSelecionada || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                  minimumDate={new Date()}
                  onValueChange={onValueChangeDate}
                  onDismiss={onDismissDate}
                />
              </View>
            )}

            <Text style={styles.labelInline}>Horário</Text>
            <View style={{ marginTop: spacing.sm - 4 }}>
              {['Manhã', 'Almoço', 'Tarde', 'Noite'].map((turno) => {
                const itensTurno = HORARIOS_POPULARES.filter((h) => h.tag === turno);
                return (
                  <View key={turno} style={{ marginBottom: spacing.sm }}>
                    <Text style={styles.turnoLabel}>{turno}</Text>
                    <View style={styles.chipRowHorarios}>
                      {itensTurno.map((h) => {
                        const selecionado = horaSelecionada && horaSelecionada.hora === h.hora && horaSelecionada.minuto === h.minuto;
                        return (
                          <TouchableOpacity
                            key={`${h.hora}-${h.minuto}`}
                            style={[styles.horarioChip, selecionado && styles.horarioChipActive]}
                            onPress={() => setHoraSelecionada(h)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.horarioChipText, selecionado && styles.horarioChipTextActive]}>{h.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={[styles.outroHorarioBtn, showTimePicker && styles.outroHorarioBtnActive]}
                onPress={() => setShowTimePicker((v) => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={16} color={showTimePicker ? colors.primary : colors.textSecondary} />
                <Text style={[styles.outroHorarioText, showTimePicker && { color: colors.primary, fontWeight: fontWeight.bold }]}>
                  {horaSelecionada && !HORARIOS_POPULARES.some((h) => h.hora === horaSelecionada.hora && h.minuto === horaSelecionada.minuto)
                    ? `Horário selecionado: ${horaSelecionada.label}`
                    : 'Outro horário...'}
                </Text>
                <Ionicons name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={16} color={showTimePicker ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
              {showTimePicker && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={(() => {
                      if (dataSelecionada && horaSelecionada) {
                        const d = new Date(dataSelecionada);
                        d.setHours(horaSelecionada.hora, horaSelecionada.minuto, 0, 0);
                        return d;
                      }
                      if (dataSelecionada) return new Date(dataSelecionada);
                      return new Date();
                    })()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={onValueChangeTime}
                    onDismiss={onDismissTime}
                  />
                </View>
              )}
            </View>

            <Text style={styles.labelInline}>Estado</Text>
            <TouchableOpacity style={[styles.input, styles.inputInsideCard, styles.inputRow]} onPress={() => setShowEstadoModal(true)}>
              <Text style={[styles.inputText, !nomeEstadoSelecionado && styles.inputTextDim]} numberOfLines={1}>
                {nomeEstadoSelecionado || 'Selecione o estado'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={styles.labelInline}>Cidade</Text>
            <TouchableOpacity
              style={[styles.input, styles.inputInsideCard, styles.inputRow, !uf && styles.inputDisabled]}
              onPress={() => uf && setShowCidadeModal(true)}
              disabled={!uf}
            >
              <Text style={[styles.inputText, !cidade && styles.inputTextDim]} numberOfLines={1}>
                {cidade || (!uf ? 'Selecione o estado primeiro' : carregandoCidades ? 'Carregando cidades...' : 'Selecione a cidade')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={!uf ? colors.textFaint : colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* SEÇÃO 4: FINALIZAÇÃO (Vagas + Fotos) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="people-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Participantes</Text>
            </View>

            <Text style={styles.labelInline}>Máximo de vagas</Text>
            <TextInput
              style={[styles.input, styles.inputInsideCard]}
              value={vagas}
              onChangeText={(t) => setVagas(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="0 = ilimitadas"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>Deixe 0 para permitir quantas pessoas quiserem.</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="images-outline" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Fotos ({photos.length}/{MAX_FOTOS_ATIVIDADE})</Text>
                <Text style={styles.hintInline}>Até {MAX_FOTOS_ATIVIDADE} fotos para ilustrar</Text>
              </View>
            </View>
            <View style={styles.photoGrid}>
              {photos.map((item) => (
                <View key={item.id} style={styles.photoWrap}>
                  <RNExpoImage source={{ uri: item.uri }} style={styles.photoImg} contentFit="cover" />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removerFoto(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_FOTOS_ATIVIDADE && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={adicionarFotos}>
                  <View style={styles.addPhotoInner}>
                    <Ionicons name="add" size={28} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

        {/* BOTÃO STICKY NO RODAPÉ */}
        <View style={styles.footerSticky}>
          {!isEditing && (
            <TouchableOpacity onPress={handleCancelar} disabled={loading} style={styles.footerCancel} activeOpacity={0.6}>
              <Text style={styles.footerCancelText}>Cancelar</Text>
            </TouchableOpacity>
          )}
          <Button
            label={loading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Publicar atividade'}
            onPress={handlePublicar}
            disabled={loading}
            style={[{ flex: 1 }, isEditing ? null : {}]}
          />
        </View>
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
  labelInline: { fontSize: fontSize.sm + 1, fontWeight: fontWeight.bold, color: colors.textSecondary, marginTop: spacing.md - 1, marginBottom: spacing.sm - 1 },
  labelOptional: { fontSize: fontSize.xs, color: colors.textFaint, fontWeight: fontWeight.regular },
  hint: { fontSize: fontSize.sm, color: colors.textFaint, marginBottom: spacing.sm, marginTop: 4 },
  hintInline: { fontSize: fontSize.xs, color: colors.textFaint, marginTop: 1 },
  hintError: { fontSize: fontSize.sm, color: colors.accent, marginTop: spacing.sm, fontWeight: fontWeight.medium },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.base, justifyContent: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputInsideCard: { backgroundColor: colors.backgroundAlt, borderColor: colors.borderLight },
  inputDisabled: { opacity: 0.5 },
  inputMultiline: { height: 100, textAlignVertical: 'top', paddingTop: spacing.md - 2 },
  inputText: { fontSize: fontSize.base, color: colors.text },
  inputTextDim: { color: colors.textFaint },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: 4 },
  doneBtnText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  progressWrap: { marginBottom: 0 },
  progressSticky: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: colors.black || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  progressBar: { height: 8, backgroundColor: colors.borderLight, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width 0.3s ease' },
  progressText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, fontWeight: fontWeight.medium },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: colors.black || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: { elevation: 1 },
    }),
  },
  sectionCardHint: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md - 2,
  },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.base + 1,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipEmoji: { fontSize: fontSize.md, lineHeight: 18 },
  chipText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.md - 1 },
  chipTextActive: { color: colors.white },
  pickerWrap: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  counter: { fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'right', marginTop: 4 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  photoWrap: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3,
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
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primaryTint,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  addPhotoInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnoLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: spacing.sm - 2,
    marginBottom: 6,
  },
  chipRowHorarios: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm - 4,
  },
  horarioChip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minWidth: 72,
    alignItems: 'center',
  },
  horarioChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  horarioChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  horarioChipTextActive: {
    color: colors.white,
  },
  outroHorarioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.sm,
  },
  outroHorarioBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  outroHorarioText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  footerSticky: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: colors.black || '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  footerCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  footerCancelText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
});