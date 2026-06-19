import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !senha) {
      Alert.alert('Ops', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await setDoc(doc(db, 'users', cred.user.uid), {
          email,
          bio: '',
          interests: [],
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, senha);
      }
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('Erro', traduzErro(error.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Companhia</Text>
      <Text style={styles.tagline}>Atividades em boa companhia</Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.switchText}>
          {isSignUp ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Cadastre-se'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function traduzErro(code) {
  const mapa = {
    'auth/email-already-in-use': 'Esse e-mail já está cadastrado.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
  };
  return mapa[code] || 'Algo deu errado, tente de novo.';
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', color: '#0E5C46' },
  tagline: { fontSize: 14, color: '#5C6962', textAlign: 'center', marginBottom: 28 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
  button: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  switchText: { textAlign: 'center', marginTop: 16, color: '#0E5C46', fontWeight: '600' },
});