import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import Button from '../components/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../constants/theme';

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
      const emailLimpo = email.trim();
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: emailLimpo,
          bio: '',
          interests: [],
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, emailLimpo, senha);
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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
            <Ionicons name={showSenha ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
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
              <Ionicons name={showConfirmar ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <Button
          label={loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
          onPress={handleSubmit}
          disabled={loading}
          style={{ marginTop: spacing.sm }}
        />

        <TouchableOpacity onPress={toggleModo}>
          <Text style={styles.switchText}>
            {isSignUp ? 'Já tem conta? Entrar' : 'Ainda não tem conta? Cadastre-se'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  title: { fontSize: fontSize.display, fontWeight: fontWeight.extrabold, textAlign: 'center', color: colors.primary },
  tagline: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl + 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, fontSize: fontSize.base },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  passwordInput: { flex: 1, paddingVertical: spacing.md, fontSize: fontSize.base },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -6, marginBottom: spacing.md },
  forgotText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.md },
  switchText: { textAlign: 'center', marginTop: spacing.lg, color: colors.primary, fontWeight: fontWeight.semibold },
});