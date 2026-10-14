import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If we have a Firebase user but no cached token, the user needs to click Sign In to get a fresh token with Workspace scopes
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google.');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro no login Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return cachedUser;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
};
