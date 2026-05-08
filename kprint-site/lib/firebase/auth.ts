import {
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseApp, isAdminEmail } from "./config";

let _auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return cred.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getFirebaseAuth());
}

/** auth 상태 변화 구독. unsubscribe 함수를 반환. */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  return fbOnAuthStateChanged(getFirebaseAuth(), cb);
}

export { isAdminEmail };
export type { User };
