import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  type FirebaseStorage,
  type UploadTask,
} from "firebase/storage";
import { getFirebaseApp } from "./config";

let _storage: FirebaseStorage | null = null;

export function getBucket(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getFirebaseApp());
  return _storage;
}

export type UploadResult = { url: string; storagePath: string };

/** 단일 파일 업로드. progress callback 0-100. */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const ref = storageRef(getBucket(), path);
  const task: UploadTask = uploadBytesResumable(ref, file);
  return new Promise<UploadResult>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (snap.totalBytes > 0) {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          onProgress?.(pct);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, storagePath: task.snapshot.ref.fullPath });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

/** Storage 객체 삭제. 경로가 비어있으면 무시. 객체 없는 경우 swallow. */
export async function deleteFile(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(storageRef(getBucket(), storagePath));
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "storage/object-not-found") return; // 이미 없음 — 무시
    throw e;
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 12);
}

/** 안전한 파일명 + uuid 접두사로 storage path 생성. */
export function buildStoragePath(prefix: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]/g, "_");
  const trimmed = prefix.replace(/\/+$/, "");
  return `${trimmed}/${uuid()}_${safe}`;
}
