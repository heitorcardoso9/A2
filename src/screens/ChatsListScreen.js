import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserName from '../components/UserName';
import UserAvatar from '../components/UserAvatar';
import { Image as RNExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { colors, spacing, fontSize, fontWeight, radius } from '../constants/theme';

function formatarHorarioChat(timestamp) {
  if (!timestamp) return '';
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const agora = new Date();
  const mesmoDia = data.toDateString() === agora.toDateString();

  if (mesmoDia) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) {
    return 'Ontem';
  }

  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getActivityMs(activity) {
  if (!activity) return 0;
  if (activity.activityDateTime) {
    return activity.activityDateTime.toDate
      ? activity.activityDateTime.toDate().getTime()
      : new Date(activity.activityDateTime).getTime();
  }
  return 0;
}

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todas' },
  { key: 'future', label: 'Futuras' },
  { key: 'past', label: 'Passadas' },
];

export default function ChatsListScreen({ navigation }) {
  const [chatsRaw, setChatsRaw] = useState([]);
  const [filter, setFilter] = useState('all');
  const myUid = auth.currentUser.uid;
  const agoraMs = Date.now();

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', myUid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatsRaw(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  const { chatsFuturos, chatsPassados, chatsSemAtividade } = useMemo(() => {
    const fut = [];
    const past = [];
    const free = [];
    for (const chat of chatsRaw) {
      const ms = getActivityMs(chat.activityPreview);
      if (!chat.activityPreview || !ms) {
        free.push(chat);
      } else if (ms >= agoraMs) {
        fut.push({ ...chat, _activityMs: ms });
      } else {
        past.push({ ...chat, _activityMs: ms });
      }
    }
    fut.sort((a, b) => a._activityMs - b._activityMs);
    past.sort((a, b) => b._activityMs - a._activityMs);
    free.sort((a, b) => {
      const t1 = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt).getTime()) : 0;
      const t2 = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt).getTime()) : 0;
      return t2 - t1;
    });
    return { chatsFuturos: fut, chatsPassados: past, chatsSemAtividade: free };
  }, [chatsRaw, agoraMs]);

  const chatsVisiveis = useMemo(() => {
    if (filter === 'future') return [...chatsFuturos, ...chatsSemAtividade];
    if (filter === 'past') return chatsPassados;
    return [...chatsFuturos, ...chatsSemAtividade, ...chatsPassados];
  }, [filter, chatsFuturos, chatsPassados, chatsSemAtividade]);

  const abrirChat = (chat) => {
    const otherUid = chat.participants.find((p) => p !== myUid);
    const otherEmail = chat.participantEmails?.[otherUid] || 'Usuário';
    navigation.navigate('Chat', {
      withUserId: otherUid,
      withUserEmail: otherEmail,
      activityTitle: chat.activityTitle,
      activityPreview: chat.activityPreview || null,
    });
  };

  const coverUrlFromActivity = (activity) => {
    if (!activity) return null;
    if (activity.coverUrl) return activity.coverUrl;
    if (activity.photoUrls && activity.photoUrls[0]) {
      return typeof activity.photoUrls[0] === 'string' ? activity.photoUrls[0] : activity.photoUrls[0].url;
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => {
          const selected = filter === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              activeOpacity={0.7}
              onPress={() => setFilter(opt.key)}
            >
              <Text style={[styles.filterLabel, selected && styles.filterLabelActive]}>{opt.label}</Text>
              {opt.key === 'future' ? (
                <Text style={[styles.filterCount, selected && styles.filterCountActive]}>{chatsFuturos.length + chatsSemAtividade.length}</Text>
              ) : opt.key === 'past' ? (
                <Text style={[styles.filterCount, selected && styles.filterCountActive]}>{chatsPassados.length}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={chatsVisiveis}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma conversa ainda.</Text>}
        renderItem={({ item }) => {
          const otherUid = item.participants.find((p) => p !== myUid);
          const otherEmail = item.participantEmails?.[otherUid] || 'Usuário';
          const ap = item.activityPreview || null;
          const cover = coverUrlFromActivity(ap);
          const agendado = ap?.date || null;
          const ms = getActivityMs(ap);
          const isFuturo = ms ? ms >= agoraMs : null;
          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => abrirChat(item)}>
              <View style={styles.thumbWrap}>
                {cover ? (
                  <RNExpoImage source={{ uri: cover }} style={styles.thumb} contentFit="cover" />
                ) : ap ? (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="calendar-outline" size={22} color={colors.textFaint} />
                  </View>
                ) : (
                  <UserAvatar userId={otherUid} fallbackEmail={otherEmail} size={48} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {ap ? ap.title : (item.activityTitle || null) || (
                      <UserName userId={otherUid} fallbackEmail={otherEmail} />
                    )}
                  </Text>
                  <Text style={styles.time}>{formatarHorarioChat(item.updatedAt)}</Text>
                </View>
                <View style={styles.subRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                    <View style={{ width: 18, height: 18, overflow: 'hidden', borderRadius: 9 }}>
                      <UserAvatar userId={otherUid} fallbackEmail={otherEmail} size={18} />
                    </View>
                    <Text style={styles.subName} numberOfLines={1}>
                      <UserName userId={otherUid} fallbackEmail={otherEmail} />
                    </Text>
                  </View>
                  {agendado ? (
                    <View style={[
                      styles.tagSmall,
                      isFuturo === true ? styles.tagUpcoming : isFuturo === false ? styles.tagPast : null,
                    ]}>
                      <Ionicons
                        name={isFuturo === false ? 'checkmark-circle-outline' : 'time-outline'}
                        size={11}
                        color={isFuturo === false ? colors.success : colors.primary}
                      />
                      <Text style={[
                        styles.tagSmallText,
                        isFuturo === false ? { color: colors.success } : { color: colors.primary },
                      ]}>{agendado}</Text>
                    </View>
                  ) : null}
                </View>
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
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.borderLight,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  filterLabelActive: { color: colors.white },
  filterCount: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: 7, paddingVertical: 1,
    borderRadius: 999,
    fontWeight: fontWeight.medium,
  },
  filterCountActive: {
    backgroundColor: colors.white + '25',
    color: colors.white,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  thumbWrap: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%', backgroundColor: colors.backgroundAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight, borderRadius: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, flex: 1, minWidth: 0 },
  time: { fontSize: fontSize.xs, color: colors.textFaint },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  subName: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium, flex: 1, minWidth: 0 },
  tagSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: spacing.sm - 1, paddingVertical: 3,
    borderRadius: 999,
  },
  tagUpcoming: { backgroundColor: colors.primaryTint },
  tagPast: { backgroundColor: colors.successBg },
  tagSmallText: { fontSize: 11, fontWeight: fontWeight.medium },
  last: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: 40 },
});
