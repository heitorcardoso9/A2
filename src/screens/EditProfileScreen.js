import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';

const TIPOS = ['Restaurante', 'Esporte', 'Cinema', 'Shows e eventos', 'Passeio', 'Viagem', 'Outros'];
const MAX_FOTOS = 6;

export default function EditProfileScreen({ navigation }) {
  const myUid = auth.currentUser.uid;
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [photos, setPhotos] = useState([]); // {id, uri, url?, path?, isNew}
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
    const novas = resultado.assets.slice(0, vagas).map((asset, i) => ({
      id: `new-${Date.now()}-${i}`,
      uri: asset.uri,
      isNew: true,
    }));
    const atualizadas = [...photos, ...novas];
    setPhotos(atualizadas);
    if (!profileId && atualizadas.length > 0) setProfileId(atualizadas[0].id);
  }

  async function removerFoto(item) {
    if (!item.isNew) {
      try {
        await deleteObject(ref(storage, item.path));
      } catch (e) {
        // se já não existir no Storage, ignora
      }
    }
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar perfil</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Text style={styles.label}>Fotos ({photos.length}/{MAX_FOTOS})</Text>
        <Text style={styles.hint}>Toque numa foto pra marcar como foto de perfil.</Text>
        <View style={styles.photoGrid}>
          {photos.map((item) => (
            <TouchableOpacity key={item.id} style={styles.photoWrap} onPress={() => setProfileId(item.id)}>
              <Image source={{ uri: item.uri }} style={styles.photoImg} />
              {profileId === item.id && (
                <View style={styles.profileBadge}>
                  <Ionicons name="star" size={12} color="#fff" />
                </View>
              )}
              <TouchableOpacity style={styles.removeBtn} onPress={() => removerFoto(item)}>
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          {photos.length < MAX_FOTOS && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={adicionarFotos}>
              <Ionicons name="add" size={24} color="#5C6962" />
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

        <TouchableOpacity style={styles.button} onPress={handleSalvar} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Salvando...' : 'Salvar alterações'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { color: '#0E5C46', fontWeight: '700', fontSize: 16 },
  headerTitle: { fontWeight: '700', fontSize: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#5C6962', marginTop: 14, marginBottom: 6 },
  hint: { fontSize: 12, color: '#8B958F', marginBottom: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  photoWrap: { width: 84, height: 84, borderRadius: 12 },
  photoImg: { width: 84, height: 84, borderRadius: 12 },
  profileBadge: { position: 'absolute', bottom: 4, left: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#DD6433', alignItems: 'center', justifyContent: 'center' },
  removeBtn: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1B231F', alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { width: 84, height: 84, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  chipActive: { backgroundColor: '#0E5C46', borderColor: '#0E5C46' },
  chipText: { color: '#5C6962', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  button: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10, marginTop: 26 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  counter: { fontSize: 11, color: '#8B958F', textAlign: 'right', marginTop: 4 },
});