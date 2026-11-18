import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const databaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    },
    databaseId
  );
} catch {
  firestoreInstance = getFirestore(app, databaseId);
}

export const db = firestoreInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(p => ({
          providerId: p.providerId,
          email: p.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const providerComSheets = new GoogleAuthProvider();
SCOPES.forEach(scope => providerComSheets.addScope(scope));
providerComSheets.setCustomParameters({ prompt: 'select_account' });

const providerBasico = new GoogleAuthProvider();
providerBasico.setCustomParameters({ prompt: 'select_account' });

const STORAGE_TOKEN_KEY = 'orcamento_google_access_token';
const STORAGE_TOKEN_TIME_KEY = 'orcamento_google_token_timestamp';

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

/**
 * Observador de autenticação do Firebase para o app e Firestore
 * (independente da expiração de 60min do token opcional do Google Sheets)
 */
export const observeFirebaseAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    cachedUser = user;
    if (!user) {
      cachedAccessToken = null;
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_TOKEN_TIME_KEY);
    }
    callback(user);
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user) {
      const validToken = await getAccessToken();
      if (validToken) {
        if (onAuthSuccess) onAuthSuccess(user, validToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_TOKEN_TIME_KEY);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (
  incluirEscoposSheets = true
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const providerEscolhido = incluirEscoposSheets ? providerComSheets : providerBasico;
    const result = await signInWithPopup(auth, providerEscolhido);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';

    cachedUser = result.user;
    if (token && incluirEscoposSheets) {
      cachedAccessToken = token;
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      localStorage.setItem(STORAGE_TOKEN_TIME_KEY, String(Date.now()));
    }

    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Erro no login Google:', error);
    let mensagemTratada = error.message || 'Falha ao autenticar com o Google.';
    if (error.code === 'auth/popup-closed-by-user') {
      mensagemTratada = 'A janela de login do Google foi fechada antes de concluir.';
    } else if (error.code === 'auth/popup-blocked') {
      mensagemTratada = 'O navegador bloqueou a janela pop-up do Google. Toque em "Permitir pop-ups" nas configurações do Safari/Chrome.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      mensagemTratada = 'Solicitação de login cancelada.';
    } else if (error.message?.includes('access_denied') || error.code === 'auth/unauthorized-domain') {
      mensagemTratada = 'Acesso restrito pelo Google (Erro 403 access_denied). Siga as orientações na tela para autorizar.';
    }
    const err = new Error(mensagemTratada);
    (err as any).code = error.code;
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;

  const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const savedTime = localStorage.getItem(STORAGE_TOKEN_TIME_KEY);

  if (savedToken && savedTime) {
    const elapsedMinutes = (Date.now() - parseInt(savedTime, 10)) / (1000 * 60);
    if (elapsedMinutes < 60) {
      cachedAccessToken = savedToken;
      return savedToken;
    }
  }

  return null;
};

export const isTokenExpirado = (): boolean => {
  const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const savedTime = localStorage.getItem(STORAGE_TOKEN_TIME_KEY);
  if (!savedToken || !savedTime) return false;
  const elapsedMinutes = (Date.now() - parseInt(savedTime, 10)) / (1000 * 60);
  return elapsedMinutes >= 55;
};

export const invalidarTokenGoogle = () => {
  cachedAccessToken = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_TOKEN_TIME_KEY);
  window.dispatchEvent(new CustomEvent('orcamento-google-sessao-expirada'));
};

export const renovarTokenGoogle = async (): Promise<string | null> => {
  const res = await googleSignIn(true);
  return res?.accessToken || null;
};

export const getCurrentUser = (): User | null => {
  return cachedUser || auth.currentUser;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_TOKEN_TIME_KEY);
  window.dispatchEvent(new CustomEvent('orcamento-google-logout'));
};

export const googleSignOut = logout;
