import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Storage bucket names
export const STORAGE_BUCKETS = {
  MAPS: 'maps',
  TOKENS: 'tokens',
  HANDOUTS: 'handouts',
} as const;

// Helper to get public URL for storage items
export const getStorageUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

// Upload file to storage
export const uploadFile = async (
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string } | { error: string }> => {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    return { error: error.message };
  }

  const url = getStorageUrl(bucket, path);
  return { url };
};

// Delete file from storage
export const deleteFile = async (
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
};
