const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'data', 'sessions.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

function loadSessions() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch { return {}; }
}

function saveSessions(sessions) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Create session with photo uploads
app.post('/api/sessions', upload.array('photos', 30), async (req, res) => {
  try {
    const id = nanoid(8);
    const creatorToken = nanoid(16);
    const sessionName = req.body.name || 'My Shoot';
    const creatorName = req.body.creator || '';

    const sessionDir = path.join(__dirname, 'uploads', id);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const photos = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const filename = `${String(i + 1).padStart(2, '0')}.jpg`;
      await sharp(file.buffer)
        .resize(900, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(path.join(sessionDir, filename));
      photos.push({ index: i, filename, url: `/uploads/${id}/${filename}` });
    }

    const sessions = loadSessions();
    sessions[id] = {
      id,
      name: sessionName,
      creatorName,
      creatorToken,
      photos,
      viewers: [],
      createdAt: Date.now()
    };
    saveSessions(sessions);

    res.json({ id, creatorToken, shareUrl: `/s/${id}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get session data (public — for swipe view)
app.get('/api/sessions/:id', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({
    id: session.id,
    name: session.name,
    creatorName: session.creatorName,
    photos: session.photos,
    photoCount: session.photos.length
  });
});

// Get full session data (creator only)
app.get('/api/sessions/:id/dashboard', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const token = req.headers['x-creator-token'];
  if (token !== session.creatorToken) return res.status(403).json({ error: 'Unauthorized' });
  res.json(session);
});

// Join session as viewer
app.post('/api/sessions/:id/join', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const viewerName = req.body.name || 'Anonymous';
  const viewerId = nanoid(8);

  const viewer = { id: viewerId, name: viewerName, picks: [], swiped: 0, chatMessages: [], joinedAt: Date.now() };
  session.viewers.push(viewer);
  saveSessions(sessions);

  io.to(`dashboard-${session.id}`).emit('viewer-joined', { viewer });

  res.json({ viewerId, viewerName });
});

// Record a swipe
app.post('/api/sessions/:id/swipe', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { viewerId, photoIndex, liked } = req.body;
  const viewer = session.viewers.find(v => v.id === viewerId);
  if (!viewer) return res.status(404).json({ error: 'Viewer not found' });

  viewer.swiped++;
  if (liked) viewer.picks.push(photoIndex);
  saveSessions(sessions);

  io.to(`dashboard-${session.id}`).emit('swipe', {
    viewerId,
    viewerName: viewer.name,
    photoIndex,
    liked,
    swiped: viewer.swiped,
    picks: viewer.picks
  });

  res.json({ ok: true });
});

// Chat message
app.post('/api/sessions/:id/chat', (req, res) => {
  const sessions = loadSessions();
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { viewerId, sender, text } = req.body;
  const viewer = session.viewers.find(v => v.id === viewerId);
  if (!viewer) return res.status(404).json({ error: 'Viewer not found' });

  const msg = { sender, text, timestamp: Date.now() };
  viewer.chatMessages.push(msg);
  saveSessions(sessions);

  io.to(`dashboard-${session.id}`).emit('chat-message', { viewerId, ...msg });
  io.to(`viewer-${viewerId}`).emit('chat-message', { viewerId, ...msg });

  res.json({ ok: true });
});

// SPA-style routes
app.get('/s/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'swipe.html')));
app.get('/dashboard/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// Socket.io
io.on('connection', (socket) => {
  socket.on('join-dashboard', (sessionId) => {
    socket.join(`dashboard-${sessionId}`);
  });
  socket.on('join-viewer', (viewerId) => {
    socket.join(`viewer-${viewerId}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Delicious running on http://localhost:${PORT}`));
