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

const STORAGE_TOKEN_KEY = 'orcamento_google_access_token';
const STORAGE_TOKEN_TIME_KEY = 'orcamento_google_token_timestamp';

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

    localStorage.setItem(STORAGE_TOKEN_KEY, credential.accessToken);
    localStorage.setItem(STORAGE_TOKEN_TIME_KEY, String(Date.now()));

    return { user: result.user, accessToken: cachedAccessToken };
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
    // Tokens OAuth do Google duram 60 min. Mantemos válido enquanto estiver dentro do período.
    if (elapsedMinutes < 60) {
      cachedAccessToken = savedToken;
      return savedToken;
    }
  }

  return null;
};

/**
 * Retorna true se o usuário já fez login alguma vez mas o token expirou
 */
export const isTokenExpirado = (): boolean => {
  const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  const savedTime = localStorage.getItem(STORAGE_TOKEN_TIME_KEY);
  if (!savedToken || !savedTime) return false;
  const elapsedMinutes = (Date.now() - parseInt(savedTime, 10)) / (1000 * 60);
  return elapsedMinutes >= 55;
};

/**
 * Invalida o token em cache se a API do Google retornar 401 Unauthorized
 */
export const invalidarTokenGoogle = () => {
  cachedAccessToken = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_TOKEN_TIME_KEY);
  window.dispatchEvent(new CustomEvent('orcamento-google-sessao-expirada'));
};

/**
 * Renova a sessão do Google com um clique
 */
export const renovarTokenGoogle = async (): Promise<string | null> => {
  const res = await googleSignIn();
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
