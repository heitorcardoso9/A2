import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

const TIPOS = ['Trilha', 'Cinema', 'Corrida', 'Viagem'];

export default function CreateActivityScreen({ navigation }) {
  const [tipo, setTipo] = useState('Trilha');
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [local, setLocal] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePublicar() {
    if (!titulo || !data || !local) {
      Alert.alert('Ops', 'Preencha pelo menos título, data e local.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'activities'), {
        type: tipo,
        title: titulo,
        date: data,
        local: local,
        desc: desc || 'Sem descrição.',
        ownerId: auth.currentUser.uid,
        ownerEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
      });
      setTitulo(''); setData(''); setLocal(''); setDesc('');
      Alert.alert('Pronto!', 'Atividade publicada.');
      navigation.navigate('Feed');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível publicar agora. Tente de novo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chipRow}>
        {TIPOS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, tipo === t && styles.chipActive]}
            onPress={() => setTipo(t)}
          >
            <Text style={[styles.chipText, tipo === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Título</Text>
      <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Ex: Trilha na Pedra Grande" />

      <Text style={styles.label}>Data e horário</Text>
      <TextInput style={styles.input} value={data} onChangeText={setData} placeholder="Ex: Sábado, 9h" />

      <Text style={styles.label}>Local</Text>
      <TextInput style={styles.input} value={local} onChangeText={setLocal} placeholder="Ex: Atibaia, SP" />

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
        value={desc}
        onChangeText={setDesc}
        placeholder="Conte mais sobre essa atividade"
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handlePublicar} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Publicando...' : 'Publicar atividade'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  label: { fontSize: 13, fontWeight: '700', color: '#5C6962', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  chipActive: { backgroundColor: '#0E5C46', borderColor: '#0E5C46' },
  chipText: { color: '#5C6962', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  button: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10, marginTop: 22 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
});