import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { maskEmailAddress } from './free-ai-pool';

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
    userId?: string;
    emailMasked?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
  };
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig &&
      typeof firebaseConfig.apiKey === 'string' &&
      firebaseConfig.apiKey.length > 10 &&
      !firebaseConfig.apiKey.includes('PLACEHOLDER') &&
      typeof firebaseConfig.projectId === 'string' &&
      firebaseConfig.projectId.length > 2,
  );
}

export function getFirebaseClient(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
} | null {
  if (!isFirebaseConfigured()) return null;
  try {
    if (!appInstance) {
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    }
    if (!authInstance) {
      authInstance = getAuth(appInstance);
    }
    if (!dbInstance) {
      dbInstance = getFirestore(
        appInstance,
        (firebaseConfig as any).firestoreDatabaseId || undefined,
      );
    }
    return { app: appInstance, auth: authInstance, db: dbInstance };
  } catch (err) {
    console.warn('[Firebase] Initialization warning:', err);
    return null;
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): FirestoreErrorInfo {
  const client = getFirebaseClient();
  const currentUser = client?.auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      emailMasked: currentUser?.email ? maskEmailAddress(currentUser.email) : undefined,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export async function testFirestoreConnection(): Promise<boolean> {
  const client = getFirebaseClient();
  if (!client) return false;
  try {
    await getDocFromServer(doc(client.db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export async function signInWithFirebaseGooglePopup(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
}> {
  const client = getFirebaseClient();
  if (!client) {
    throw new Error('Firebase Auth is not configured.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(client.auth, provider);
  const user = cred.user;
  const idToken = await user.getIdToken();
  const email = user.email || `${user.uid}@google-auth.user`;
  const displayName = user.displayName || email.split('@')[0];

  // Sync masked user governance record to Firestore
  try {
    const now = Date.now();
    await setDoc(
      doc(client.db, 'users', user.uid),
      {
        id: user.uid,
        maskedEmail: maskEmailAddress(email),
        displayName,
        authProvider: 'google',
        role: 'user',
        status: 'active',
        tokenQuota: 0,
        tokensConsumed: 0,
        createdAt: now,
        lastActiveAt: now,
      },
      { merge: true },
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
  }

  return {
    uid: user.uid,
    email,
    displayName,
    idToken,
  };
}

export async function signOutFirebaseUser(): Promise<void> {
  const client = getFirebaseClient();
  if (!client) return;
  await signOut(client.auth);
}

export function subscribeToFirebaseAuth(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  const client = getFirebaseClient();
  if (!client) return () => {};
  return onAuthStateChanged(client.auth, callback);
}
