import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export function friendlyNameFromEmail(email) {
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

export async function migrateUserProfile(u) {
  if (!u) return;
  try {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const patch = {};
    if (!data.name) {
      const existingUsername = data.username && typeof data.username === 'string' && data.username.trim();
      const newName = existingUsername
        || (u.displayName && u.displayName.trim())
        || friendlyNameFromEmail(u.email)
        || null;
      if (newName) patch.name = newName;
    }
    if (!data.email && u.email) patch.email = u.email;
    if (!data.avatarUrl) {
      const existingPhoto = data.profilePhotoUrl || u.photoURL || null;
      if (existingPhoto) patch.avatarUrl = existingPhoto;
    }
    if (Object.keys(patch).length > 0) {
      console.log('[App] migrando perfil, patch:', patch);
      await setDoc(ref, patch, { merge: true });
    }
  } catch (e) {
    console.warn('[App] migrateUserProfile erro:', e);
  }
}
