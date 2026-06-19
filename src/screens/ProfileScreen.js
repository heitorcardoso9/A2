import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function ProfileScreen() {
  function handleSair() {
    Alert.alert('Sair', 'Tem certeza que quer sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {auth.currentUser?.email?.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.email}>{auth.currentUser?.email}</Text>

      <TouchableOpacity style={styles.button} onPress={handleSair}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E3F0EA', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { fontWeight: '700', fontSize: 18, color: '#0A4334' },
  title: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 13, color: '#5C6962', marginBottom: 24 },
  button: { backgroundColor: '#EFEDE7', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10 },
  buttonText: { color: '#1B231F', fontWeight: '700' },
});