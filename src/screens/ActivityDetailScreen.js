import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export default function ActivityDetailScreen({ navigation, route }) {
  const { activity, mine } = route.params;
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(!mine);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (mine) return;
    checkInterest();
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
          <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: activity.ownerId })}>
            <Text style={[styles.owner, { color: '#0E5C46', fontWeight: '700' }]}>
              Organizado por {activity.ownerEmail?.split('@')[0]} ›
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.desc}>{activity.desc}</Text>

        <View style={{ marginTop: 'auto', gap: 10 }}>
          {mine ? (
            <TouchableOpacity style={styles.buttonPrimary} onPress={() => navigation.navigate('Interested', { activity })}>
              <Text style={styles.buttonText}>Ver interessados</Text>
            </TouchableOpacity>
          ) : (
            <>
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
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  back: { color: '#0E5C46', fontWeight: '700', marginBottom: 12, fontSize: 14 },
  chip: { fontSize: 11, fontWeight: '700', backgroundColor: '#E3F0EA', color: '#0A4334', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, alignSelf: 'flex-start' },
  title: { fontSize: 20, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  meta: { fontSize: 13, color: '#5C6962', marginBottom: 2 },
  owner: { fontSize: 13, color: '#8B958F', marginTop: 8 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 14, marginBottom: 22 },
  buttonPrimary: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10 },
  buttonAccent: { backgroundColor: '#DD6433', padding: 14, borderRadius: 10 },
  buttonDisabled: { backgroundColor: '#EFEDE7' },
  buttonOutline: { borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 10 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  buttonOutlineText: { color: '#1B231F', textAlign: 'center', fontWeight: '700' },
});