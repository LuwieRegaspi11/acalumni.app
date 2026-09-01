// Client-side image compression.
//
// Profile photos and ID document photos get base64-encoded and passed
// through Supabase auth.signUp()'s user metadata (see AuthContext.tsx
// register() and id_document_upload.sql for why — no Storage bucket,
// since there's no authenticated session yet at signup time). That
// request body is capped at 1MB by Supabase's Auth API. An uncompressed
// phone photo (often several MB) blows past that on its own, and the
// signUp() call fails with a 413 — which used to surface to users as a
// misleading "email already registered" error. Downscaling + re-encoding
// as JPEG here keeps the combined payload comfortably under the limit.
export function compressImageFile(file: File, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Image compression is not supported in this browser.')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
