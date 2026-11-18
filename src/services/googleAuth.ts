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

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let cachedUser: User | null = null;

/**
 * Observador de autenticação do Firebase para o app e Firestore
 */
export const observeFirebaseAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    cachedUser = user;
    callback(user);
  });
};

export const googleSignIn = async (): Promise<{ user: User } | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    cachedUser = result.user;
    return { user: result.user };
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
  }
};

export const getCurrentUser = (): User | null => {
  return cachedUser || auth.currentUser;
};

export const logout = async () => {
  await signOut(auth);
  cachedUser = null;
  window.dispatchEvent(new CustomEvent('orcamento-google-logout'));
};

export const googleSignOut = logout;
