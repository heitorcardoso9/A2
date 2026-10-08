import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import UserName from '../components/UserName';
import UserAvatar from '../components/UserAvatar';
import { Image as RNExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { buildReviewId } from '../services/reviewsService';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

function getChatId(uid1, uid2, activityId) {
  const sortedUsers = [uid1, uid2].sort();
  if (activityId) {
    return `activity_${activityId}_${sortedUsers[0]}_${sortedUsers[1]}`;
  }
  return sortedUsers.join('_');
}

function getActivityMs(activity) {
  if (!activity) return 0;
  if (activity.activityDateTime) {
    return activity.activityDateTime.toDate ? activity.activityDateTime.toDate().getTime() : new Date(activity.activityDateTime).getTime();
  }
  return 0;
}

export default function ChatScreen({ navigation, route }) {
  const { withUserId, withUserEmail, activityTitle, activityPreview } = route.params;
  const insets = useSafeAreaInsets();
  const [bottomInset] = useState(insets.bottom);
  const [topInset] = useState(insets.top);
  const myUid = auth.currentUser.uid;
  const chatId = getChatId(myUid, withUserId, activityPreview?.id);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [activityData, setActivityData] = useState(activityPreview || null);
  const [reviewedAlready, setReviewedAlready] = useState(false);
  const listRef = useRef(null);

  const [chatReady, setChatReady] = useState(false);

  // O chat só passa a existir no primeiro envio; até lá não há mensagens para escutar
  // (as regras exigem o doc do chat para validar os participantes).
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'chats', chatId))
      .then((snap) => { if (!cancelled && snap.exists()) setChatReady(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chatId]);

  useEffect(() => {
    if (!chatReady) return;
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.warn('[ChatScreen] erro ao escutar mensagens', e?.code)
    );
    return unsubscribe;
  }, [chatId, chatReady]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'chats', chatId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.activityPreview) {
            setActivityData((prev) => prev || data.activityPreview);
          }
        }
        const act = activityData || activityPreview;
        if (act && act.id) {
          const ms = getActivityMs(act);
          if (ms > 0 && ms < Date.now()) {
            const reviewId = buildReviewId({ activityId: act.id, reviewerId: myUid, reviewedId: withUserId });
            const legacySorted = [myUid, withUserId].sort();
            const legacyId = `r_${act.id}_${legacySorted[0]}_${legacySorted[1]}`;
            const [snapR, snapLegacy] = await Promise.all([
              getDoc(doc(db, 'reviews', reviewId)),
              getDoc(doc(db, 'reviews', legacyId)),
            ]);
            if (snapR.exists() || (snapLegacy.exists() && snapLegacy.data().reviewerId === myUid)) {
              setReviewedAlready(true);
            }
          }
        }
      } catch (_) {}
    })();
  }, [activityData, activityPreview, myUid, withUserId]);

  async function handleSend() {
    const conteudo = text.trim();
    if (!conteudo) return;
    setText('');
    try {
      const docPayload = {
        participants: [myUid, withUserId],
        participantEmails: { [myUid]: auth.currentUser.email, [withUserId]: withUserEmail },
        activityId: activityPreview?.id || activityData?.id || null,
        activityTitle: activityTitle || activityPreview?.title || activityData?.title || null,
        activityPreview: activityPreview || activityData || null,
        updatedAt: serverTimestamp(),
        lastMessage: conteudo,
      };
      // Chat primeiro (cria se não existir), depois a mensagem.
      await setDoc(doc(db, 'chats', chatId), docPayload, { merge: true });
      setChatReady(true);
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: conteudo,
        senderId: myUid,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      setText(conteudo);
      Alert.alert('Ops', 'Não foi possível enviar a mensagem. Verifique sua conexão e tente de novo.');
    }
  }

  async function handleOpenActivity() {
    const id = activityData?.id || activityPreview?.id;
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'activities', id));
      if (snap.exists()) {
        const full = { id: snap.id, ...snap.data() };
        navigation.navigate('ActivityDetail', { activity: full, mine: full.ownerId === myUid });
      } else {
        Alert.alert('Ops', 'Essa atividade não existe mais.');
      }
    } catch (_) {
      Alert.alert('Ops', 'Não foi possível carregar a atividade.');
    }
  }

  const activityCoverUrl = useMemo(() => {
    const a = activityData || activityPreview;
    if (!a) return null;
    if (a.coverUrl) return a.coverUrl;
    if (a.photoUrls && a.photoUrls[0]) {
      return typeof a.photoUrls[0] === 'string' ? a.photoUrls[0] : a.photoUrls[0].url;
    }
    return null;
  }, [activityData, activityPreview]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? bottomInset : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          onPress={handleOpenActivity}
          disabled={!activityData && !activityPreview}
        >
          {activityCoverUrl ? (
            <RNExpoImage source={{ uri: activityCoverUrl }} style={styles.activityThumb} contentFit="cover" />
          ) : (activityData || activityPreview) ? (
            <View style={[styles.activityThumb, styles.activityThumbFallback]}>
              <Ionicons name="calendar-outline" size={18} color={colors.textFaint} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            {(activityData || activityPreview) ? (
              <Text style={styles.activityTitle} numberOfLines={1}>
                {activityData?.title || activityPreview?.title}
              </Text>
            ) : (
              <Text style={styles.activityTitle} numberOfLines={1}>
                <UserName userId={withUserId} fallbackEmail={withUserEmail} />
              </Text>
            )}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs - 1, marginTop: 2 }}
              onPress={() => navigation.navigate('UserProfile', { userId: withUserId })}
            >
              <UserAvatar userId={withUserId} fallbackEmail={withUserEmail} size={18} />
              <Text style={styles.nameSmall}>
                <UserName userId={withUserId} fallbackEmail={withUserEmail} />
              </Text>
            </TouchableOpacity>
            {activityData?.date ? (
              <Text style={styles.activitySmallDate}>
                <Ionicons name="time-outline" size={12} />  {activityData.date}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {(activityData || activityPreview) ? (
          <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: spacing.xs }}>
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={handleOpenActivity}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.65}
            >
              <Ionicons name="open-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            {reviewedAlready ? (
              <View style={styles.reviewedChip}>
                <Ionicons name="checkmark" size={12} color={colors.success} />
                <Text style={styles.reviewedChipText}>Avaliado</Text>
              </View>
            ) : null}
          </View>
        ) : null}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  activityThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.card },
  activityThumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight },
  activityTitle: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  activitySmallDate: { fontSize: fontSize.xs, color: colors.textFaint, marginTop: 1 },
  nameSmall: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  headerBackBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    backgroundColor: colors.successBg,
    borderRadius: 999,
  },
  reviewedChipText: { fontSize: 10, color: colors.success, fontWeight: fontWeight.bold },
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