import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { migrateUserProfile } from '../services/userService';
import { cleanupDuplicateParticipations } from '../services/participationsService';

/**
 * Observa o usuário autenticado e dispara as rotinas de manutenção pós-login.
 * `checking` é true até o Firebase responder pela primeira vez.
 */
export default function useAuthUser() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
      if (currentUser) {
        migrateUserProfile(currentUser);
        cleanupDuplicateParticipations(currentUser.uid);
      }
    });
  }, []);

  return { user, checking };
}
