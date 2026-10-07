import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseApp, isBootstrapAdmin } from "./config";

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

/**
 * 가입 — 계정 생성 + 이름 저장 + 인증 메일 발송.
 * members 문서(승인 대기)는 메일 인증 뒤 AccountGate 가 만든다 (보안 규칙이 인증된 본인만 허용).
 */
export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function resendVerification(): Promise<void> {
  const u = getFirebaseAuth().currentUser;
  if (u) await sendEmailVerification(u);
}

/** 메일 인증 링크를 누른 뒤 최신 상태(emailVerified)를 다시 읽는다. */
export async function reloadCurrentUser(): Promise<User | null> {
  const u = getFirebaseAuth().currentUser;
  if (!u) return null;
  await u.reload();
  // 토큰의 email_verified 클레임도 갱신해야 보안 규칙이 인증된 것으로 본다.
  await u.getIdToken(true);
  return getFirebaseAuth().currentUser;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export { isBootstrapAdmin };
export type { User };
