import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function InterestedScreen({ navigation, route }) {
  const { activity } = route.params;
  const [interessados, setInteressados] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'participations'), where('activityId', '==', activity.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInteressados(lista);
    });
    return unsubscribe;
  }, []);

  async function atualizarStatus(participationId, novoStatus) {
    try {
      await updateDoc(doc(db, 'participations', participationId), { status: novoStatus });
    } catch (e) {
      // poderia mostrar um alerta de erro aqui
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>‹ Voltar</Text>
      </TouchableOpacity>

      <View style={styles.miniCard}>
        <Text style={styles.miniTitle}>{activity.title}</Text>
        <Text style={styles.miniMeta}>{activity.date} · {activity.local}</Text>
      </View>

      <FlatList
        data={interessados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>Ninguém demonstrou interesse ainda.</Text>}
        renderItem={({ item }) => {
          const nome = item.userEmail?.split('@')[0] || 'Usuário';
          const iniciais = nome.slice(0, 2).toUpperCase();
          return (
            <View style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{iniciais}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{nome}</Text>
                <Text style={styles.statusLabel}>{labelStatus(item.status)}</Text>
              </View>
              {item.status === 'pendente' && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={styles.iconBtnOk} onPress={() => atualizarStatus(item.id, 'confirmado')}>
                    <Text style={styles.iconBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtnX} onPress={() => atualizarStatus(item.id, 'recusado')}>
                    <Text style={styles.iconBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => navigation.navigate('Chat', {
                  withUserId: item.userId,
                  withUserEmail: item.userEmail,
                  activityTitle: activity.title,
                })}
              >
                <Text style={{ fontSize: 16 }}>💬</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

function labelStatus(status) {
  const mapa = { pendente: 'Aguardando resposta', confirmado: 'Confirmado', recusado: 'Recusado' };
  return mapa[status] || status;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 18 },
  back: { color: '#0E5C46', fontWeight: '700', marginBottom: 12, fontSize: 14 },
  miniCard: { backgroundColor: '#EBF1EC', borderRadius: 14, padding: 12, marginBottom: 18 },
  miniTitle: { fontWeight: '700', fontSize: 14 },
  miniMeta: { fontSize: 12, color: '#5C6962', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E3F0EA', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 13, color: '#0A4334' },
  name: { fontWeight: '700', fontSize: 14 },
  statusLabel: { fontSize: 12, color: '#5C6962' },
  iconBtnOk: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#E1F0E6', alignItems: 'center', justifyContent: 'center' },
  iconBtnX: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EFEDE7', alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontWeight: '700', color: '#1F6B43' },
  chatBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#8B958F', marginTop: 40 },
});