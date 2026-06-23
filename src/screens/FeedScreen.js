import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import UserName from '../components/UserName';

const FILTROS = ['Todos', 'Trilha', 'Cinema', 'Corrida', 'Viagem'];

export default function FeedScreen({ navigation }) {
  const [activities, setActivities] = useState([]);
  const [filtro, setFiltro] = useState('Todos');

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setActivities(lista);
    });
    return unsubscribe;
  }, []);

  const lista = filtro === 'Todos' ? activities : activities.filter((a) => a.type === filtro);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.wordmark}>Companhia</Text>

      <View style={styles.filterRow}>
        {FILTROS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filtro === f && styles.filterChipActive]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filterText, filtro === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma atividade por aqui ainda.</Text>}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 12 },
  wordmark: { fontSize: 18, fontWeight: '800', color: '#0E5C46', paddingHorizontal: 16, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  filterChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  filterChipActive: { backgroundColor: '#0E5C46', borderColor: '#0E5C46' },
  filterText: { color: '#5C6962', fontWeight: '600', fontSize: 13 },
  filterTextActive: { color: '#fff' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 14, padding: 14 },
  chip: { fontSize: 11, fontWeight: '700', backgroundColor: '#E3F0EA', color: '#0A4334', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, alignSelf: 'flex-start' },
  chipMine: { backgroundColor: '#FBE7DB', color: '#DD6433' },
  cardTitle: { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#5C6962' },
  cardOwner: { fontSize: 12, color: '#8B958F', marginTop: 4 },
  empty: { textAlign: 'center', color: '#8B958F', marginTop: 40 },
});