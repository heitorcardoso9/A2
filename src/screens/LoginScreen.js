import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !senha) {
      Alert.alert('Ops', 'Preencha e-mail e senha.');
      return;
    }
    if (isSignUp) {
      if (!confirmarSenha) {
        Alert.alert('Ops', 'Confirme sua senha.');
        return;
      }
      if (senha !== confirmarSenha) {
        Alert.alert('Ops', 'As senhas não coincidem.');
        return;
      }
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
    } catch (error) {
      Alert.alert('Erro', traduzErro(error.code));
    } finally {
      setLoading(false);
    }
  }

  function toggleModo() {
    setIsSignUp(!isSignUp);
    setConfirmarSenha('');
  }

  function handleEsqueciSenha() {
    if (!email.trim()) {
      Alert.alert('Informe seu e-mail', 'Digite seu e-mail no campo acima antes de tocar em "Esqueci minha senha".');
      return;
    }
    Alert.alert(
      'Recuperar senha',
      `Enviar um link de redefinição de senha para ${email}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: enviarResetSenha },
      ]
    );
  }

  async function enviarResetSenha() {
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('E-mail enviado', 'Verifique sua caixa de entrada (e a pasta de SPAM) para redefinir sua senha.');
    } catch (error) {
      Alert.alert('Erro', traduzErro(error.code));
    } finally {
      setResetLoading(false);
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

      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Senha"
          autoCapitalize="none"
          secureTextEntry={!showSenha}
          value={senha}
          onChangeText={setSenha}
        />
        <TouchableOpacity onPress={() => setShowSenha(!showSenha)}>
          <Ionicons name={showSenha ? 'eye-off' : 'eye'} size={20} color="#5C6962" />
        </TouchableOpacity>
      </View>

      {!isSignUp && (
        <TouchableOpacity onPress={handleEsqueciSenha} disabled={resetLoading} style={styles.forgotWrap}>
          <Text style={styles.forgotText}>{resetLoading ? 'Enviando...' : 'Esqueci minha senha'}</Text>
        </TouchableOpacity>
      )}

      {isSignUp && (
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Confirme a senha"
            autoCapitalize="none"
            secureTextEntry={!showConfirmar}
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
          />
          <TouchableOpacity onPress={() => setShowConfirmar(!showConfirmar)}>
            <Ionicons name={showConfirmar ? 'eye-off' : 'eye'} size={20} color="#5C6962" />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={toggleModo}>
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
    'auth/missing-email': 'Informe seu e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  };
  return mapa[code] || 'Algo deu errado, tente de novo.';
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', color: '#0E5C46' },
  tagline: { fontSize: 14, color: '#5C6962', textAlign: 'center', marginBottom: 28 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12 },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 12 },
  forgotText: { color: '#0E5C46', fontWeight: '600', fontSize: 13 },
  button: { backgroundColor: '#0E5C46', padding: 14, borderRadius: 10, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  switchText: { textAlign: 'center', marginTop: 16, color: '#0E5C46', fontWeight: '600' },
});