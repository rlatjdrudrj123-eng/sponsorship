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

/**
 * 단일 파일 업로드. progress callback 0-100.
 *
 * 이미지(image/*) 는 업로드 전에 자동으로 클라이언트 리사이즈(max 1920px) +
 * WebP 변환. 원본보다 큰 경우는 원본 그대로 (SVG·HEIC·작은 파일도 패스스루).
 * PDF 등 비-이미지는 그대로.
 */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const { file: finalFile, path: finalPath } = await preprocessForUpload(
    file,
    path
  );
  const ref = storageRef(getBucket(), finalPath);
  const task: UploadTask = uploadBytesResumable(ref, finalFile);
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

/**
 * 이미지 업로드 전처리 — 클라이언트 Canvas 로 max 1920px 리사이즈 + WebP 변환.
 * 원본보다 결과가 더 크거나 처리에 실패하면 원본을 그대로 사용.
 *
 * 변환 결과가 webp 이면 path 확장자도 .webp 로 교체.
 */
async function preprocessForUpload(
  file: File,
  path: string
): Promise<{ file: File; path: string }> {
  const optimized = await optimizeImage(file);
  if (optimized === file) return { file, path };
  // path 확장자를 결과 mime 에 맞춰 교체 (없으면 그대로)
  const newPath = path.includes(".")
    ? path.replace(/\.[^./]+$/, ".webp")
    : path + ".webp";
  return { file: optimized, path: newPath };
}

const MAX_DIM = 1920;
const WEBP_QUALITY = 0.85;
const SKIP_BELOW_BYTES = 200 * 1024;

/**
 * 이미지를 Canvas 로 리사이즈 + WebP 변환. 다음 경우는 원본 반환:
 * - 비-이미지 / SVG / HEIC (브라우저 Canvas 가 디코드 못함)
 * - 200KB 이하 (이미 충분히 작음)
 * - 변환 결과가 원본보다 크거나 실패
 */
async function optimizeImage(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml") return file;
  if (file.type === "image/heic" || file.type === "image/heif") return file;
  if (file.size < SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height) return file;
    const scale = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    // ImageBitmap 은 close 로 메모리 해제
    if ("close" in bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
    const blob = await new Promise<Blob | null>((res) => {
      canvas.toBlob(res, "image/webp", WEBP_QUALITY);
    });
    if (!blob) return file;
    if (blob.size >= file.size) return file;
    const newName = file.name.replace(/\.[^./]+$/, "") + ".webp";
    return new File([blob], newName, { type: "image/webp" });
  } catch {
    return file;
  }
}

async function loadBitmap(
  file: File
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to HTMLImageElement path
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
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
