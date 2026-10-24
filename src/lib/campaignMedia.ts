// Campaign / project photos (cover + gallery) live in the public
// "campaign-photos" Storage bucket — see supabase/donations_transparency.sql.
// Admin-only writes are enforced by the bucket's policies; reads are public
// because these photos are also shown on the homepage.
import { supabase } from './supabaseClient';

export const CAMPAIGN_PHOTOS_BUCKET = 'campaign-photos';

export function campaignPhotoUrl(storagePath: string): string {
  return supabase.storage.from(CAMPAIGN_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

const MAX_DIMENSION = 1600;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// Phone photos run several MB; scale to a web-sized JPEG before uploading so
// the bucket's 5 MB limit is never the thing that fails.
export function downscaleImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Please choose an image file.')); return; }
    if (file.size > MAX_SOURCE_BYTES) { reject(new Error('That image is too large. Please choose one under 20MB.')); return; }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Could not read that image.')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read that image.')); };
    img.src = objectUrl;
  });
}

// Uploads one image for a campaign and returns its storage path.
export async function uploadCampaignImage(campaignId: string, file: File): Promise<string> {
  const blob = await downscaleImage(file);
  const path = `${campaignId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(CAMPAIGN_PHOTOS_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeCampaignImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(CAMPAIGN_PHOTOS_BUCKET).remove(paths);
  if (error) console.error('[campaign-media] could not delete storage objects', error);
}

// What the New/Edit Campaign form hands back besides the text fields.
export interface CampaignMediaChanges {
  /** A newly chosen cover image. */
  coverFile?: File | null;
  /** Remove the existing cover without replacing it. */
  removeCover?: boolean;
  /** New gallery images (with optional captions). */
  newPhotos: { file: File; caption: string }[];
  /** Existing gallery rows to delete. */
  removePhotoIds: string[];
}
