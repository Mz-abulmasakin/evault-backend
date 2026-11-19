import { randomUUID } from "node:crypto";
import env from "../config/env.js";
import { getSupabase } from "../config/supabase.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRY = 10 * 60;

const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

function validateFile({ buffer, mimeType }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("A valid document buffer is required.");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File size must not exceed 10 MB.");
  }

  if (!ALLOWED_TYPES[mimeType]) {
    throw new Error(
      "Unsupported document type. Only JPEG, PNG and PDF are allowed."
    );
  }
}

function cleanFolder(folder) {
  const segments = String(folder || "")
    .split("/")
    .filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        !/^[a-zA-Z0-9_-]+$/.test(segment)
    )
  ) {
    throw new Error("Invalid document storage folder.");
  }

  return segments.join("/");
}

function validateStoragePath(objectPath) {
  if (
    typeof objectPath !== "string" ||
    !objectPath.trim() ||
    objectPath.includes("..") ||
    objectPath.startsWith("/")
  ) {
    throw new Error("Invalid document storage path.");
  }
}

// =========================================================
// UPLOAD PRIVATE DOCUMENT
// =========================================================

export async function uploadPrivateDocument({
  buffer,
  mimeType,
  folder,
}) {
  validateFile({ buffer, mimeType });

  const supabase = getSupabase();
  const bucket = env.storage.supabaseBucket;

  if (!bucket) {
    throw new Error("Supabase storage bucket is not configured.");
  }

  const safeFolder = cleanFolder(folder);
  const extension = ALLOWED_TYPES[mimeType];
  const objectPath = `${safeFolder}/${randomUUID()}${extension}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Document upload failed: ${error.message}`);
  }

  return {
    bucket,
    path: data.path,
    mimeType,
    size: buffer.length,
  };
}

// =========================================================
// CREATE PRIVATE DOCUMENT URL
// =========================================================

export async function createPrivateDocumentUrl(objectPath) {
  validateStoragePath(objectPath);

  const supabase = getSupabase();

  const { data, error } = await supabase.storage
    .from(env.storage.supabaseBucket)
    .createSignedUrl(objectPath, SIGNED_URL_EXPIRY);

  if (error) {
    throw new Error(`Could not generate document link: ${error.message}`);
  }

  return {
    url: data.signedUrl,
    expiresIn: SIGNED_URL_EXPIRY,
  };
}

// =========================================================
// DOWNLOAD PRIVATE DOCUMENT AS BUFFER
// =========================================================

export async function downloadPrivateDocument(
  objectPath,
  bucketName = null
) {
  validateStoragePath(objectPath);

  const supabase = getSupabase();
  const bucket = bucketName || env.storage.supabaseBucket;

  if (!bucket) {
    throw new Error("Supabase storage bucket is not configured.");
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(objectPath);

  if (error) {
    throw new Error(`Document download failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("The requested document was not found.");
  }

  return Buffer.from(await data.arrayBuffer());
}

// =========================================================
// DELETE PRIVATE DOCUMENT
// =========================================================

export async function deletePrivateDocument(objectPath) {
  validateStoragePath(objectPath);

  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from(env.storage.supabaseBucket)
    .remove([objectPath]);

  if (error) {
    throw new Error(`Document deletion failed: ${error.message}`);
  }

  return true;
}