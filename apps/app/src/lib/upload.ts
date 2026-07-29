import { api } from "@/lib/api";

/** POST a file to S3 via a presigned form, reporting progress 0–100. */
function uploadToS3(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

/**
 * Full upload flow shared by Fuentes (F1) and onboarding import (O2):
 * presign → S3 → register. Reports progress; resolves with the new file id.
 * `areaId` is the area the file's memories land in (required by the API).
 */
export async function uploadFile(
  file: File,
  areaId: string,
  onProgress?: (p: number) => void,
): Promise<string> {
  const { uploadUrl, fields, s3Key } = await api.files.presign(areaId, file.name, file.type, file.size);
  await uploadToS3(uploadUrl, fields, file, (p) => onProgress?.(p));
  const { id } = await api.files.create(areaId, file.name, file.type, file.size, s3Key);
  return id;
}
