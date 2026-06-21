import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import { MediaType } from "@/types/chat";

export interface UploadResult {
  url: string;
  mediaType: MediaType;
  fileName: string;
  fileSize: number;
}

export interface UploadProgress {
  percent: number;
  task: UploadTask;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function getMediaType(file: File): MediaType {
  return IMAGE_TYPES.includes(file.type) ? "image" : "file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size is 20 MB (this file is ${formatFileSize(file.size)})`;
  }
  return null;
}

export function uploadFile(
  conversationId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop() ?? "";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const storageRef = ref(storage, `conversations/${conversationId}/${uniqueName}`);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: { originalName: file.name },
    });

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(percent);
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({
          url,
          mediaType: getMediaType(file),
          fileName: file.name,
          fileSize: file.size,
        });
      }
    );
  });
}
