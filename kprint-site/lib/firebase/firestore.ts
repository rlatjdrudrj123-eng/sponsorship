import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "./config";

let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  try {
    // 첫 호출 — undefined 필드 허용 옵션으로 초기화 (importer가 optional 필드를 자주 빈 값으로 넘김)
    _db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    // 이미 다른 곳에서 초기화된 경우 (HMR 등) — 기존 인스턴스 사용
    _db = getFirestore(app);
  }
  return _db;
}
