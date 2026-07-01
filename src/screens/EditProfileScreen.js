import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

const TIPOS = ['Restaurante', 'Esporte', 'Cinema', 'Shows e eventos', 'Passeio', 'Viagem', 'Outros'];
const MAX_FOTOS = 6;

export default function EditProfileScreen({ navigation }) {
  const myUid = auth.currentUser.uid;
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [photos, setPhotos] = useState([]); // {id, uri, url?, path?, isNew}
  const [photosOriginais, setPhotosOriginais] = useState([]); // snapshot do que existia ao abrir a tela
  const [profileId, setProfileId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, 'users', myUid));
      if (snap.exists()) {
        const data = snap.data();
        setBio(data.bio || '');
        setInterests(data.interests || []);
        setUsername(data.username || '');
        const existentes = (data.photos || []).map((p, i) => ({
          id: `existing-${i}`,
          uri: p.url,
          url: p.url,
          path: p.path,
          isNew: false,
        }));
        setPhotos(existentes);
        setPhotosOriginais(existentes);
        const fotoPerfil = existentes.find((p) => p.url === data.profilePhotoUrl);
        setProfileId(fotoPerfil ? fotoPerfil.id : existentes[0]?.id || null);
      }
      setLoading(false);
    })();
  }, []);

  function toggleInteresse(tipo) {
    setInterests((prev) => (prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]));
  }

  async function adicionarFotos() {
    const vagas = MAX_FOTOS - photos.length;
    if (vagas <= 0) {
      Alert.alert('Limite atingido', `Você pode ter no máximo ${MAX_FOTOS} fotos.`);
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
      quality: 0.6,
    });
    if (resultado.canceled) return;

    if (resultado.assets.length > vagas) {
      Alert.alert('Algumas fotos não foram adicionadas', `Você só tinha espaço para mais ${vagas} foto(s), então adicionamos só as primeiras.`);
    }

    const novas = resultado.assets.slice(0, vagas).map((asset, i) => ({
      id: `new-${Date.now()}-${i}`,
      uri: asset.uri,
      isNew: true,
    }));
    const atualizadas = [...photos, ...novas];
    setPhotos(atualizadas);
    if (!profileId && atualizadas.length > 0) setProfileId(atualizadas[0].id);
  }

  function removerFoto(item) {
    // Não apaga nada do Storage aqui. Só tira da lista local.
    // A exclusão de verdade só acontece em handleSalvar, comparando com photosOriginais.
    const restantes = photos.filter((p) => p.id !== item.id);
    setPhotos(restantes);
    if (profileId === item.id) {
      setProfileId(restantes[0]?.id || null);
    }
  }

  async function handleSalvar() {
    const usernameLimpo = username.trim();
    if (usernameLimpo && !/^[\p{L}0-9_ ]{3,20}$/u.test(usernameLimpo)) {
      Alert.alert('Nome de usuário inválido', 'Use de 3 a 20 letras, números, espaço ou "_".');
      return;
    }
    setSaving(true);
    try {
      const finais = [];
      for (let i = 0; i < photos.length; i++) {
        const item = photos[i];
        if (item.isNew) {
          const resposta = await fetch(item.uri);
          const blob = await resposta.blob();
          const path = `profile-photos/${myUid}/${Date.now()}-${i}.jpg`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          finais.push({ url, path, _id: item.id });
        } else {
          finais.push({ url: item.url, path: item.path, _id: item.id });
        }
      }
      const fotoEscolhida = finais.find((f) => f._id === profileId);
      await updateDoc(doc(db, 'users', myUid), {
        username: usernameLimpo,
        bio: bio.trim(),
        interests,
        photos: finais.map(({ url, path }) => ({ url, path })),
        profilePhotoUrl: fotoEscolhida ? fotoEscolhida.url : null,
      });

      // Só agora, depois de salvar com sucesso, apaga do Storage as fotos
      // que existiam originalmente e não estão mais na lista final.
      const pathsFinais = new Set(finais.map((f) => f.path));
      const removidas = photosOriginais.filter((orig) => !pathsFinais.has(orig.path));
      await Promise.all(
        removidas.map((item) =>
          deleteObject(ref(storage, item.path)).catch(() => {
            // se já não existir no Storage, ignora
          })
        )
      );

      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar agora. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Editar perfil" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Fotos ({photos.length}/{MAX_FOTOS})</Text>
          <Text style={styles.hint}>Toque numa foto pra marcar como foto de perfil.</Text>
          <View style={styles.photoGrid}>
            {photos.map((item) => (
              <TouchableOpacity key={item.id} style={styles.photoWrap} onPress={() => setProfileId(item.id)}>
                <Image source={{ uri: item.uri }} style={styles.photoImg} />
                {profileId === item.id && (
                  <View style={styles.profileBadge}>
                    <Ionicons name="star" size={12} color={colors.white} />
                  </View>
                )}
                <TouchableOpacity style={styles.removeBtn} onPress={() => removerFoto(item)}>
                  <Ionicons name="close" size={12} color={colors.white} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {photos.length < MAX_FOTOS && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={adicionarFotos}>
                <Ionicons name="add" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Nome de usuário</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="ex: heitor_mc"
            autoCapitalize="none"
            maxLength={20}
          />
          <Text style={styles.counter}>{username.length}/20</Text>

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Conte um pouco sobre você"
            multiline
            maxLength={500}
          />
          <Text style={styles.counter}>{bio.length}/500</Text>

          <Text style={styles.label}>Interesses</Text>
          <View style={styles.chipsRow}>
            {TIPOS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, interests.includes(t) && styles.chipActive]}
                onPress={() => toggleInteresse(t)}
              >
                <Text style={[styles.chipText, interests.includes(t) && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            label={saving ? 'Salvando...' : 'Salvar alterações'}
            onPress={handleSalvar}
            disabled={saving}
            style={{ marginTop: spacing.xl + 6 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textSecondary, marginTop: spacing.md + 2, marginBottom: spacing.sm - 2 },
  hint: { fontSize: fontSize.sm, color: colors.textFaint, marginBottom: spacing.sm + 2 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2, marginBottom: spacing.sm },
  photoWrap: { width: 84, height: 84, borderRadius: radius.lg - 2, overflow: 'visible' },
  photoImg: { width: 84, height: 84, borderRadius: radius.lg - 2 },
  profileBadge: { position: 'absolute', bottom: 4, left: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  removeBtn: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { width: 84, height: 84, borderRadius: radius.lg - 2, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.base },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md + 2 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
  chipTextActive: { color: colors.white },
  counter: { fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'right', marginTop: 4 },
});