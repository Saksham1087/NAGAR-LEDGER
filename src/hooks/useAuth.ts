import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  BLUEPRINT_LIMITS,
  OperationType,
  auth,
  db,
  formatFirestoreQuotaNotice,
  googleProvider,
  handleFirestoreError,
  sanitizeFirestoreId,
} from '../firebase';
import type { LanguageCode } from '../types/civic';

function readStoredLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem('nagrikseva-lang-v1');
    if (saved === 'en' || saved === 'mr' || saved === 'hi') return saved;
  } catch {
    // ignore
  }
  return 'en';
}

async function syncUserProfileDocument(
  user: User,
  preferredLanguage: LanguageCode
): Promise<void> {
  if (!user.email || !user.emailVerified) return;

  const uid = sanitizeFirestoreId(user.uid);
  const docPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const displayName = (user.displayName || user.email.split('@')[0] || 'Citizen')
    .trim()
    .slice(0, BLUEPRINT_LIMITS.displayNameMaxLength);
  const email = user.email.trim().slice(0, BLUEPRINT_LIMITS.emailMaxLength);
  const photoURL = user.photoURL
    ? user.photoURL.trim().slice(0, BLUEPRINT_LIMITS.photoUrlMaxLength)
    : undefined;

  try {
    const snap = await getDoc(userRef);
    const payload: Record<string, unknown> = {
      uid,
      displayName,
      email,
      preferredLanguage,
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      payload.photoURL = photoURL;
    }

    if (!snap.exists()) {
      await setDoc(userRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser && nextUser.emailVerified) {
        void syncUserProfileDocument(nextUser, readStoredLanguage()).catch((err) => {
          const raw = err instanceof Error ? err.message : 'Unable to sync citizen profile.';
          setAuthError(formatFirestoreQuotaNotice(raw));
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const syncPreferredLanguage = useCallback(
    async (lang: LanguageCode) => {
      if (!user || !user.emailVerified) return;
      try {
        await syncUserProfileDocument(user, lang);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Unable to update language preference.';
        setAuthError(formatFirestoreQuotaNotice(raw));
      }
    },
    [user]
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user && cred.user.emailVerified) {
        await syncUserProfileDocument(cred.user, readStoredLanguage());
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setAuthError(null);
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Pop-up blocked by browser. Allow pop-ups for this site to sign in.');
      } else {
        setAuthError(
          error instanceof Error ? error.message : 'Google Sign-In failed. Please retry.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-out failed.');
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return {
    user,
    authReady,
    signingIn,
    authError,
    signInWithGoogle,
    signOutUser,
    syncPreferredLanguage,
    clearAuthError,
  };
}
