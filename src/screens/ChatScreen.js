import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

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
    setDoc(
      doc(db, 'chats', chatId),
      {
        participants: [myUid, withUserId],
        participantEmails: { [myUid]: auth.currentUser.email, [withUserId]: withUserEmail },
        activityTitle: activityTitle || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

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
      await setDoc(doc(db, 'chats', chatId), { updatedAt: serverTimestamp(), lastMessage: conteudo }, { merge: true });
    } catch (e) {
      // poderia mostrar um alerta de erro aqui
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? bottomInset : 0}
    >
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{withUserEmail?.split('@')[0] || 'Conversa'}</Text>
          {activityTitle ? <Text style={styles.activity}>{activityTitle}</Text> : null}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
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
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBF1EC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { color: '#0E5C46', fontWeight: '700', fontSize: 14 },
  headerInfo: { alignItems: 'flex-end' },
  name: { fontWeight: '700', fontSize: 14 },
  activity: { fontSize: 12, color: '#5C6962' },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#0E5C46', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: '#1B231F' },
  bubbleTextMine: { fontSize: 14, color: '#fff' },
  inputBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  sendBtn: { backgroundColor: '#DD6433', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});