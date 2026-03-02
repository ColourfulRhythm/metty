// Replace these with your Supabase project values
// Find them at: supabase.com → your project → Settings → API
const SUPABASE_URL = 'https://yxtuhlfldondwqfvgydm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dHVobGZsZG9uZHdxZnZneWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjQ4ODAsImV4cCI6MjA4NzgwMDg4MH0.eAZ1lWwkJvuN_eaBL1wlN18qycW6AvmdqqSchchDcaA';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_LIMIT_BYTES = 30 * 1024 * 1024; // 30MB

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

// --- Auth (name + PIN) ---
async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCurrentUser() {
  const raw = localStorage.getItem('delicious-user');
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  if (user) localStorage.setItem('delicious-user', JSON.stringify(user));
  else localStorage.removeItem('delicious-user');
}

async function signup(name, pin) {
  const id = generateId(12);
  const salt = crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const pinHash = await hashPin(pin, salt);
  const { data, error } = await db.from('users').insert({ id, name: name.trim(), pin_salt: salt, pin_hash: pinHash }).select().single();
  if (error) throw error;
  setCurrentUser({ id: data.id, name: data.name });
  return data;
}

async function login(name, pin) {
  const { data: user, error } = await db.from('users').select('*').eq('name', name.trim()).single();
  if (error || !user) throw new Error('User not found');
  const pinHash = await hashPin(pin, user.pin_salt);
  if (pinHash !== user.pin_hash) throw new Error('Wrong PIN');
  setCurrentUser({ id: user.id, name: user.name });
  return user;
}

function logout() {
  setCurrentUser(null);
}

async function getUserStorage(userId) {
  const { data, error } = await db.rpc('user_storage_used', { uid: userId });
  if (error) return 0;
  return Number(data) || 0;
}
