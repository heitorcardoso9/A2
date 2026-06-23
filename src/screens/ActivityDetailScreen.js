import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import UserAvatar from '../components/UserAvatar';
import UserName from '../components/UserName';

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
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 18, flexGrow: 1 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
            <Text style={[styles.owner, { color: '#0E5C46', fontWeight: '700', marginTop: 0, marginLeft: 8 }]}>
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
                    <View style={{ flex: 1, marginLeft: 10 }}>
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
          <View style={{ marginTop: 'auto', gap: 10 }}>
            <TouchableOpacity
              style={[styles.buttonAccent, sent && styles.buttonDisabled]}
              onPress={handleParticipar}
              disabled={sent || sending || checking}
            >
              <Text style={styles.buttonText}>
                {checking ? 'Verificando...' : sent ? '✓ Interesse enviado' : sending ? 'Enviando...' : 'Quero participar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buttonOutline}
              onPress={() => navigation.navigate('Chat', {
                withUserId: activity.ownerId,
                withUserEmail: activity.ownerEmail,
                activityTitle: activity.title,
              })}
            >
              <Text style={styles.buttonOutlineText}>Conversar com quem organizou</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  back: { color: '#0E5C46', fontWeight: '700', marginBottom: 30, fontSize: 16 },
  chip: { fontSize: 11, fontWeight: '700', backgroundColor: '#E3F0EA', color: '#0A4334', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, alignSelf: 'flex-start' },
  title: { fontSize: 20, fontWeight: '800', marginTop: 10, marginBottom: 10 },
  meta: { fontSize: 13, color: '#5C6962', marginBottom: 8 },
  owner: { fontSize: 13, color: '#8B958F', marginTop: 8 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 14, marginBottom: 22 },
  buttonPrimary: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10 },
  buttonAccent: { backgroundColor: '#DD6433', padding: 14, borderRadius: 10 },
  buttonDisabled: { backgroundColor: '#EFEDE7' },
  buttonOutline: { borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 10 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  buttonOutlineText: { color: '#1B231F', textAlign: 'center', fontWeight: '700' },
  ownerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#5C6962', marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
  empty: { textAlign: 'center', color: '#8B958F', fontSize: 13, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  rowTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  name: { fontWeight: '700', fontSize: 14 },
  statusLabel: { fontSize: 12, color: '#5C6962' },
  iconBtnOk: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#E1F0E6', alignItems: 'center', justifyContent: 'center' },
  iconBtnX: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EFEDE7', alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontWeight: '700', color: '#1F6B43' },
  chatBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});