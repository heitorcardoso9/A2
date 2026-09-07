import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import UserName from '../components/UserName';
import UserAvatar from '../components/UserAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export default function ChatScreen({ navigation, route }) {
  const { withUserId, withUserEmail, activityTitle } = route.params;
  const insets = useSafeAreaInsets();
  const [bottomInset] = useState(insets.bottom);
  const [topInset] = useState(insets.top);
  const myUid = auth.currentUser.uid;
  const chatId = getChatId(myUid, withUserId);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  async function handleSend() {
    const conteudo = text.trim();
    if (!conteudo) return;
    setText('');
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: conteudo,
        senderId: myUid,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'chats', chatId),
        {
          participants: [myUid, withUserId],
          participantEmails: { [myUid]: auth.currentUser.email, [withUserId]: withUserEmail },
          activityTitle: activityTitle || null,
          updatedAt: serverTimestamp(),
          lastMessage: conteudo,
        },
        { merge: true }
      );
    } catch (e) {
      Alert.alert('Ops', 'Não foi possível enviar a mensagem. Verifique sua conexão e tente de novo.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? bottomInset : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerInfo} onPress={() => navigation.navigate('UserProfile', { userId: withUserId })}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.name}><UserName userId={withUserId} fallbackEmail={withUserEmail} /></Text>
            {activityTitle ? <Text style={styles.activity}>{activityTitle}</Text> : null}
          </View>
          <UserAvatar userId={withUserId} fallbackEmail={withUserEmail} size={32} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md - 2 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.emptyChat}>Nenhuma mensagem ainda. Diga oi! 👋</Text>}
        renderItem={({ item }) => {
          const mine = item.senderId === myUid;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>{item.text}</Text>
            </View>
          );
        }}
      />

      <View style={[styles.inputBar, { paddingBottom: bottomInset }]}>
        <TextInput
          style={styles.input}
          placeholder="Escreva uma mensagem"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={{ color: colors.white, fontWeight: fontWeight.bold }}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  activity: { fontSize: fontSize.sm, color: colors.textSecondary },
  bubble: { maxWidth: '75%', padding: spacing.sm + 2, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderLight, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: fontSize.base, color: colors.text },
  bubbleTextMine: { fontSize: fontSize.base, color: colors.white },
  emptyChat: { textAlign: 'center', color: colors.textFaint, marginTop: 40, fontSize: fontSize.md },
  inputBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.borderLight },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.base },
  sendBtn: { backgroundColor: colors.accent, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});