import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Firebase config가 누락되었습니다. .env.local의 NEXT_PUBLIC_FIREBASE_* 값을 확인하세요."
    );
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * 최초 관리자 — members 문서 없이도 관리자인 계정.
 * ⚠️ firestore.rules · storage.rules 의 isBootstrapAdmin() 과 반드시 같은 값.
 *
 * 예전에는 NEXT_PUBLIC_ADMIN_EMAILS 환경변수였으나 배포 환경(App Hosting 콘솔) 값과
 * 보안 규칙이 따로 놀 수 있어 코드로 고정(2026-10). 다른 관리자는 멤버 관리에서 지정.
 *  - UID 고정: 메일 인증 여부와 관계없이 이 계정 (tom@eandex.co.kr)
 *  - 이메일: 메일 인증을 마친 경우에만
 */
export const BOOTSTRAP_ADMIN_UIDS = ["EwckwTGAmBh9kLnBRQd2qCvVQ1e2"];
export const BOOTSTRAP_ADMIN_EMAILS = ["tom@eandex.co.kr"];

export function isBootstrapAdmin(
  u: { uid: string; email: string | null; emailVerified: boolean } | null | undefined
): boolean {
  if (!u) return false;
  if (BOOTSTRAP_ADMIN_UIDS.includes(u.uid)) return true;
  return (
    u.emailVerified &&
    !!u.email &&
    BOOTSTRAP_ADMIN_EMAILS.includes(u.email.toLowerCase())
  );
}
