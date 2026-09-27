import React from 'react';
import { Text } from 'react-native';
import useUserProfile from '../hooks/useUserProfile';

function friendlyNameFromEmail(email) {
  try {
    if (!email || typeof email !== 'string') return null;
    const at = email.indexOf('@');
    const local = at > -1 ? email.slice(0, at) : email;
    const cleaned = local.replace(/[._+\-0-9]+/g, ' ').trim();
    if (!cleaned) {
      const simple = local.replace(/[._+\-]+/g, ' ').trim();
      if (simple) return simple.charAt(0).toUpperCase() + simple.slice(1).toLowerCase();
      return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
    }
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  } catch (_) { return null; }
}

export default function UserName({ userId, fallbackEmail, style, capitalize = true }) {
  const profile = useUserProfile(userId);
  // Usa username (campo antigo / usado no Feed) PRIMEIRO por compatibilidade;
  // se não tiver, tenta name (campo novo migrado do App.js); se não tiver nenhum, extrai do email.
  const rawName = profile?.username || profile?.name || null;
  const email = profile?.email || fallbackEmail || '';
  let nome = rawName || friendlyNameFromEmail(email) || email.split('@')[0] || 'Usuário';
  if (capitalize && nome && typeof nome === 'string' && !rawName) {
    if (nome.length && nome[0] === nome[0].toLowerCase()) {
      nome = nome.charAt(0).toUpperCase() + nome.slice(1);
    }
  }
  return <Text style={style}>{nome}</Text>;
}