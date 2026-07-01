import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import UserAvatar from '../components/UserAvatar';
import UserName from '../components/UserName';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

export default function ActivityDetailScreen({ navigation, route }) {
  const { activity, mine } = route.params;
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(!mine);
  const [sending, setSending] = useState(false);
  const [interessados, setInteressados] = useState([]);

  useEffect(() => {
    if (mine) return;
    checkInterest();
  }, []);

  useEffect(() => {
    if (!mine) return;
    const q = query(collection(db, 'participations'), where('activityId', '==', activity.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInteressados(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  async function checkInterest() {
    try {
      const q = query(
        collection(db, 'participations'),
        where('activityId', '==', activity.id),
        where('userId', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      setSent(!snap.empty);
    } catch (e) {
      // se der erro na checagem, deixa o botão habilitado normalmente
    } finally {
      setChecking(false);
    }
  }

  async function handleParticipar() {
    setSending(true);
    try {
      await addDoc(collection(db, 'participations'), {
        activityId: activity.id,
        activityTitle: activity.title,
        activityOwnerId: activity.ownerId,
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        status: 'pendente',
        createdAt: serverTimestamp(),
      });
      setSent(true);
    } catch (e) {
      // poderia mostrar um alerta de erro aqui
    } finally {
      setSending(false);
    }
  }

  async function atualizarStatus(participationId, novoStatus) {
    try {
      await updateDoc(doc(db, 'participations', participationId), { status: novoStatus });
    } catch (e) {
      // poderia mostrar um alerta de erro aqui
    }
  }

  function labelStatus(status) {
    const mapa = { pendente: 'Aguardando resposta', confirmado: 'Confirmado', recusado: 'Recusado' };
    return mapa[status] || status;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.xxl + 2 }}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.chip}>{activity.type}</Text>
        <Text style={styles.title}>{activity.title}</Text>
        <Text style={styles.meta}>📅 {activity.date}</Text>
        <Text style={styles.meta}>📍 {activity.local}</Text>
        {mine ? (
          <Text style={styles.owner}>Organizado por você</Text>
        ) : (
          <TouchableOpacity style={styles.ownerRow} onPress={() => navigation.navigate('UserProfile', { userId: activity.ownerId })}>
            <UserAvatar userId={activity.ownerId} fallbackEmail={activity.ownerEmail} size={28} />
            <Text style={[styles.owner, styles.ownerLink]}>
              Organizado por <UserName userId={activity.ownerId} fallbackEmail={activity.ownerEmail} /> ›
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.desc}>{activity.desc}</Text>

        {mine ? (
          <View>
            <Text style={styles.sectionLabel}>Interessados</Text>
            {interessados.length === 0 ? (
              <Text style={styles.empty}>Ninguém demonstrou interesse ainda.</Text>
            ) : (
              interessados.map((item) => (
                <View key={item.id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowTouchable}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
                  >
                    <UserAvatar userId={item.userId} fallbackEmail={item.userEmail} size={38} />
                    <View style={{ flex: 1, marginLeft: spacing.sm + 2 }}>
                      <Text style={styles.name}>
                        <UserName userId={item.userId} fallbackEmail={item.userEmail} />
                      </Text>
                      <Text style={styles.statusLabel}>{labelStatus(item.status)}</Text>
                    </View>
                  </TouchableOpacity>
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
                    onPress={() => navigation.navigate('Chat', { withUserId: item.userId, withUserEmail: item.userEmail, activityTitle: activity.title })}
                  >
                    <Text style={{ fontSize: 16 }}>💬</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={{ marginTop: 'auto', gap: spacing.sm + 2 }}>
            <Button
              label={checking ? 'Verificando...' : sent ? '✓ Interesse enviado' : sending ? 'Enviando...' : 'Quero participar'}
              variant="accent"
              onPress={handleParticipar}
              disabled={sent || sending || checking}
            />
            <Button
              label="Conversar com quem organizou"
              variant="outline"
              onPress={() => navigation.navigate('Chat', {
                withUserId: activity.ownerId,
                withUserEmail: activity.ownerEmail,
                activityTitle: activity.title,
              })}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.xl },
  chip: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, backgroundColor: colors.primaryTint, color: colors.primaryDark, paddingVertical: 3, paddingHorizontal: spacing.sm + 1, borderRadius: radius.pill, alignSelf: 'flex-start' },
  title: { fontSize: fontSize.heading, fontWeight: fontWeight.extrabold, marginTop: spacing.md - 2, marginBottom: spacing.md - 2 },
  meta: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.sm },
  owner: { fontSize: fontSize.md, color: colors.textFaint, marginTop: spacing.sm },
  ownerLink: { color: colors.primary, fontWeight: fontWeight.bold, marginTop: 0, marginLeft: spacing.sm },
  desc: { fontSize: fontSize.base, lineHeight: 20, marginTop: spacing.md + 2, marginBottom: spacing.xl + 2 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  sectionLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.md, textTransform: 'uppercase' },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: fontSize.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md + 2 },
  rowTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  name: { fontWeight: fontWeight.bold, fontSize: fontSize.base },
  statusLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  iconBtnOk: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  iconBtnX: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.disabled, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontWeight: fontWeight.bold, color: colors.success },
  chatBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});