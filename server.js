require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const archiver = require('archiver');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nicatliana2024';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 100) * 1024 * 1024;

// ============ JSON DATABASE ============
const DB_PATH = path.join(__dirname, 'database.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('DB oxuma xetasi:', e);
  }
  return { uploads: [] };
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

if (!fs.existsSync(DB_PATH)) {
  saveDB({ uploads: [] });
}

// ============ MIDDLEWARE ============
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'wedding-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Heddindən çox sorğu göndərdiniz. Bir az gözləyin.' }
});

// ============ MULTER SETUP ============
const allowedMimes = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const wedding = req.body.wedding_type || 'gurcustan';
    const dir = path.join(__dirname, 'uploads', wedding);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Bu fayl formatı dəstəklənmir. Zəhmət olmasa şəkil və ya video yükləyin.'));
    }
  }
});

// ============ AUTH MIDDLEWARE ============
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ error: 'İcazəsiz giriş' });
}

// ============ UPLOAD ROUTES ============
app.post('/api/upload', uploadLimiter, upload.array('files', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Fayl seçilməyib' });
    }

    const guestName = req.body.guest_name?.trim() || 'Anonim';
    const weddingType = req.body.wedding_type || 'gurcustan';

    const db = loadDB();
    const results = [];

    for (const file of req.files) {
      const id = uuidv4();
      const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';

      const record = {
        id,
        wedding_type: weddingType,
        guest_name: guestName,
        original_name: file.originalname,
        saved_name: file.filename,
        file_type: fileType,
        file_size: file.size,
        mime_type: file.mimetype,
        uploaded_at: new Date().toISOString()
      };

      db.uploads.push(record);
      results.push({ id, name: file.originalname, type: fileType });
    }

    saveDB(db);

    res.json({
      success: true,
      message: `${req.files.length} fayl uğurla yükləndi!`,
      files: results
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Yükləmə zamanı xəta baş verdi' });
  }
});

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Fayl həcmi çox böyükdür. Maksimum ${process.env.MAX_FILE_SIZE_MB || 100}MB.` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// ============ ADMIN AUTH ROUTES ============
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Yanlış şifrə' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ============ ADMIN DATA ROUTES ============
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const { wedding } = req.query;
  const db = loadDB();
  let uploads = db.uploads;

  if (wedding && wedding !== 'all') {
    uploads = uploads.filter(f => f.wedding_type === wedding);
  }

  const totalFiles = uploads.length;
  const totalSize = uploads.reduce((sum, f) => sum + f.file_size, 0);
  const totalImages = uploads.filter(f => f.file_type === 'image').length;
  const totalVideos = uploads.filter(f => f.file_type === 'video').length;

  // Wedding stats
  const weddingMap = {};
  db.uploads.forEach(f => {
    const w = f.wedding_type || 'gurcustan';
    if (!weddingMap[w]) weddingMap[w] = { count: 0, size: 0 };
    weddingMap[w].count++;
    weddingMap[w].size += f.file_size;
  });

  res.json({ totalFiles, totalSize, totalImages, totalVideos, weddingStats: weddingMap });
});

app.get('/api/admin/files', requireAdmin, (req, res) => {
  const { wedding, page = 1, limit = 50 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const db = loadDB();
  let filtered = db.uploads;

  if (wedding && wedding !== 'all') {
    filtered = filtered.filter(f => f.wedding_type === wedding);
  }

  filtered.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));

  const total = filtered.length;
  const files = filtered.slice(offset, offset + limitNum);

  res.json({ files, total, page: pageNum, limit: limitNum });
});

app.get('/api/admin/download/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const file = db.uploads.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'Fayl tapılmadı' });

  const wedding = file.wedding_type || 'gurcustan';
  const filePath = path.join(__dirname, 'uploads', wedding, file.saved_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fayl serverdə tapılmadı' });

  res.download(filePath, file.original_name);
});

app.get('/api/admin/preview/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const file = db.uploads.find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'Fayl tapılmadı' });

  const wedding = file.wedding_type || 'gurcustan';
  const filePath = path.join(__dirname, 'uploads', wedding, file.saved_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fayl serverdə tapılmadı' });

  res.sendFile(filePath);
});

app.get('/api/admin/download-all', requireAdmin, (req, res) => {
  const { wedding } = req.query;
  const db = loadDB();
  let files = db.uploads;

  if (wedding && wedding !== 'all') {
    files = files.filter(f => f.wedding_type === wedding);
  }

  if (files.length === 0) return res.status(404).json({ error: 'Heç fayl yoxdur' });

  const suffix = wedding && wedding !== 'all' ? `-${wedding}` : '';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=nicat-liana${suffix}-butun-fayllar.zip`);

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.pipe(res);

  for (const file of files) {
    const w = file.wedding_type || 'gurcustan';
    const filePath = path.join(__dirname, 'uploads', w, file.saved_name);
    if (fs.existsSync(filePath)) {
      const weddingLabel = w === 'gurcustan' ? 'Gurcustan' : 'Turkiye';
      archive.file(filePath, { name: `${weddingLabel}/${file.original_name}` });
    }
  }

  archive.finalize();
});

app.delete('/api/admin/files/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const fileIndex = db.uploads.findIndex(f => f.id === req.params.id);
  if (fileIndex === -1) return res.status(404).json({ error: 'Fayl tapılmadı' });

  const file = db.uploads[fileIndex];
  const wedding = file.wedding_type || 'gurcustan';
  const filePath = path.join(__dirname, 'uploads', wedding, file.saved_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.uploads.splice(fileIndex, 1);
  saveDB(db);

  res.json({ success: true, message: 'Fayl silindi' });
});

// ============ QR CODE ROUTES ============
app.post('/api/admin/generate-qr', requireAdmin, async (req, res) => {
  try {
    const baseUrl = req.body.base_url || BASE_URL;
    const weddingType = req.body.wedding_type || 'gurcustan';
    const qrDir = path.join(__dirname, 'qr-codes');
    fs.mkdirSync(qrDir, { recursive: true });

    const url = `${baseUrl}/upload.html?toy=${weddingType}`;
    const filename = `qr-${weddingType}.png`;
    const filepath = path.join(qrDir, filename);

    await QRCode.toFile(filepath, url, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });

    const result = { filename, url, wedding_type: weddingType };

    res.json({ success: true, qrCode: result });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'QR kod yaratma xətası' });
  }
});

app.get('/api/admin/qr-codes', requireAdmin, (req, res) => {
  const qrDir = path.join(__dirname, 'qr-codes');
  if (!fs.existsSync(qrDir)) return res.json({ qrCodes: [] });

  const files = fs.readdirSync(qrDir)
    .filter(f => f.endsWith('.png'))
    .map(f => {
      const weddingMatch = f.match(/qr-(\w+)\.png/);
      const weddingType = weddingMatch ? weddingMatch[1] : 'gurcustan';
      const label = weddingType === 'gurcustan' ? 'Gürcüstan' : 'Türkiyə';
      return {
        filename: f,
        wedding_type: weddingType,
        label,
        url: `/qr-codes/${f}`
      };
    });

  res.json({ qrCodes: files });
});

app.get('/api/admin/download-qr-all', requireAdmin, (req, res) => {
  const qrBaseDir = path.join(__dirname, 'qr-codes');
  if (!fs.existsSync(qrBaseDir)) return res.status(404).json({ error: 'QR kodlar hələ yaradılmayıb' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename=qr-kodlar.zip');

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.pipe(res);
  archive.directory(qrBaseDir, 'qr-kodlar');
  archive.finalize();
});

// Static QR code files
app.use('/qr-codes', requireAdmin, express.static(path.join(__dirname, 'qr-codes')));

// ============ HTML ROUTES ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============ START SERVER ============
app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }

  console.log(`\n  Nicat & Liana Toy Tətbiqi işləyir!`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  Yerli:    http://localhost:${PORT}`);
  console.log(`  Şəbəkə:  http://${localIP}:${PORT}`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  Yükləmə: http://${localIP}:${PORT}/upload.html`);
  console.log(`  Admin:   http://${localIP}:${PORT}/admin.html\n`);
});
