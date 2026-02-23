import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'contratos-arquivos';

// Ensure bucket exists (idempotent)
let bucketChecked = false;
async function ensureBucket() {
  if (bucketChecked) return;
  const { data } = await supabase.storage.getBucket(BUCKET_NAME);
  if (!data) {
    await supabase.storage.createBucket(BUCKET_NAME, { public: true });
  }
  bucketChecked = true;
}

/**
 * Upload a file to Supabase Storage and return the public URL.
 */
export async function uploadContratoFile(
  file: File,
  contratoId: string
): Promise<{ url: string; path: string } | null> {
  try {
    await ensureBucket();

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const fileName = `${contratoId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return { url: urlData.publicUrl, path: fileName };
  } catch (err) {
    console.error('Upload failed:', err);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteContratoFile(path: string): Promise<boolean> {
  try {
    await ensureBucket();
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
    if (error) { console.error('Delete error:', error); return false; }
    return true;
  } catch { return false; }
}

/**
 * Check if a string is a storage URL (vs base64 data URI).
 */
export function isStorageUrl(value?: string): boolean {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://');
}
