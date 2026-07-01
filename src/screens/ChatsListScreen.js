import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserName from '../components/UserName';
import UserAvatar from '../components/UserAvatar';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';

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
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md + 2 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma conversa ainda.</Text>}
        renderItem={({ item }) => {
          const otherUid = item.participants.find((p) => p !== myUid);
          const otherEmail = item.participantEmails?.[otherUid] || 'Usuário';
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('Chat', {
                withUserId: otherUid,
                withUserEmail: otherEmail,
                activityTitle: item.activityTitle,
              })}
            >
              <UserAvatar userId={otherUid} fallbackEmail={otherEmail} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}><UserName userId={otherUid} fallbackEmail={otherEmail} /></Text>
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
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  name: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  last: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 40 },
});