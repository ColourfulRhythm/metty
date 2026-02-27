// Replace these with your Supabase project values
// Find them at: supabase.com → your project → Settings → API
const SUPABASE_URL = 'https://yxtuhlfldondwqfvgydm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dHVobGZsZG9uZHdxZnZneWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjQ4ODAsImV4cCI6MjA4NzgwMDg4MH0.eAZ1lWwkJvuN_eaBL1wlN18qycW6AvmdqqSchchDcaA';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function generateId(len = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function compressImage(file, maxW = 900, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}
