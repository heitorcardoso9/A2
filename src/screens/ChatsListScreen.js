import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export default function ChatsListScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const myUid = auth.currentUser.uid;

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', myUid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Conversas</Text>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma conversa ainda.</Text>}
        renderItem={({ item }) => {
          const otherUid = item.participants.find((p) => p !== myUid);
          const otherEmail = item.participantEmails?.[otherUid] || 'Usuário';
          const nome = otherEmail.split('@')[0];
          const iniciais = nome.slice(0, 2).toUpperCase();
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('Chat', {
                withUserId: otherUid,
                withUserEmail: otherEmail,
                activityTitle: item.activityTitle,
              })}
            >
              <View style={styles.avatar}><Text style={styles.avatarText}>{iniciais}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{nome}</Text>
                <Text style={styles.last} numberOfLines={1}>{item.lastMessage || 'Sem mensagens ainda'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 12 },
  title: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E3F0EA', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 13, color: '#0A4334' },
  name: { fontWeight: '700', fontSize: 14 },
  last: { fontSize: 12, color: '#5C6962', marginTop: 2 },
  empty: { textAlign: 'center', color: '#8B958F', marginTop: 40 },
});