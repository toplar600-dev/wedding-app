// ============ STATE ============
let currentPage = 1;
const LIMIT = 50;

const WEDDING_LABELS = {
  gurcustan: 'Gürcüstan',
  turkiye: 'Türkiyə'
};

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/admin/check');
    const data = await res.json();
    if (data.isAdmin) {
      showAdminPanel();
    }
  } catch (e) {
    // Not logged in
  }

  document.getElementById('qrBaseUrl').value = window.location.origin;
});

// ============ AUTH ============
async function login() {
  const password = document.getElementById('passwordInput').value;
  const errorEl = document.getElementById('loginError');

  if (!password) {
    errorEl.textContent = 'Zəhmət olmasa şifrəni daxil edin.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (res.ok) {
      showAdminPanel();
    } else {
      errorEl.textContent = 'Yanlış şifrə!';
      errorEl.style.display = 'block';
    }
  } catch (e) {
    errorEl.textContent = 'Bağlantı xətası.';
    errorEl.style.display = 'block';
  }
}

async function logout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'block';
  document.getElementById('passwordInput').value = '';
}

function showAdminPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadStats();
  loadFiles();
}

// ============ SECTIONS ============
function showSection(section) {
  document.getElementById('filesSection').style.display = section === 'files' ? 'block' : 'none';
  document.getElementById('qrSection').style.display = section === 'qr' ? 'block' : 'none';

  if (section === 'qr') loadQRCodes();
}

// ============ WEDDING FILTER ============
function getWeddingFilter() {
  return document.getElementById('weddingFilter').value;
}

function onWeddingFilterChange() {
  currentPage = 1;
  loadStats();
  loadFiles();
}

// ============ STATS ============
async function loadStats() {
  try {
    const wedding = getWeddingFilter();
    const res = await fetch(`/api/admin/stats?wedding=${wedding}`);
    const data = await res.json();

    document.getElementById('statTotal').textContent = data.totalFiles;
    document.getElementById('statImages').textContent = data.totalImages;
    document.getElementById('statVideos').textContent = data.totalVideos;
    document.getElementById('statSize').textContent = formatSize(data.totalSize);
  } catch (e) {
    console.error('Stats yüklənmədi:', e);
  }
}

// ============ FILES ============
async function loadFiles() {
  const wedding = getWeddingFilter();
  const grid = document.getElementById('filesGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`/api/admin/files?wedding=${wedding}&page=${currentPage}&limit=${LIMIT}`);
    const data = await res.json();

    grid.innerHTML = '';

    if (data.files.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:3rem; color: var(--text-muted);">Hələ fayl yüklənməyib.</div>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    data.files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'file-card';

      const isImage = file.file_type === 'image';
      const previewHtml = isImage
        ? `<div class="file-card-preview" style="cursor:pointer" onclick="previewFile('${file.id}', 'image')">
             <img src="/api/admin/preview/${file.id}" alt="${file.original_name}" loading="lazy">
           </div>`
        : `<div class="file-card-preview" style="cursor:pointer" onclick="previewFile('${file.id}', 'video')">&#127909;</div>`;

      const weddingLabel = WEDDING_LABELS[file.wedding_type] || '';

      card.innerHTML = `
        ${previewHtml}
        <div class="file-card-info">
          <div class="file-card-name" title="${file.original_name}">${file.original_name}</div>
          <div class="file-card-meta">${weddingLabel} | ${file.guest_name} | ${formatSize(file.file_size)}</div>
          <div class="file-card-meta">${formatDate(file.uploaded_at)}</div>
        </div>
        <div class="file-card-actions">
          <button class="btn btn-outline btn-sm" style="flex:1; font-size:0.75rem;" onclick="downloadFile('${file.id}')">&#128229; Yüklə</button>
          <button class="btn btn-sm" style="flex:1; font-size:0.75rem; background:var(--error); color:white;" onclick="deleteFile('${file.id}')">&#128465; Sil</button>
        </div>
      `;
      grid.appendChild(card);
    });

    renderPagination(data.total, data.page, data.limit);

  } catch (e) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:2rem; color: var(--error);">Fayllar yüklənmədi.</div>';
  }
}

function renderPagination(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = '';

  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${i === page ? 'btn-primary' : 'btn-outline'}`;
    btn.style.width = 'auto';
    btn.textContent = i;
    btn.onclick = () => { currentPage = i; loadFiles(); };
    pagination.appendChild(btn);
  }
}

// ============ FILE ACTIONS ============
function downloadFile(id) {
  window.open(`/api/admin/download/${id}`, '_blank');
}

async function deleteFile(id) {
  if (!confirm('Bu faylı silmək istədiyinizdən əminsiniz?')) return;

  try {
    const res = await fetch(`/api/admin/files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadStats();
      loadFiles();
    } else {
      alert('Silmə xətası!');
    }
  } catch (e) {
    alert('Bağlantı xətası!');
  }
}

function downloadAll() {
  const wedding = getWeddingFilter();
  window.open(`/api/admin/download-all?wedding=${wedding}`, '_blank');
}

// ============ PREVIEW ============
function previewFile(id, type) {
  const modal = document.getElementById('previewModal');
  const content = document.getElementById('previewContent');

  if (type === 'image') {
    content.innerHTML = `<img src="/api/admin/preview/${id}" style="max-width:90vw; max-height:85vh; border-radius:8px;">`;
  } else {
    content.innerHTML = `<video src="/api/admin/preview/${id}" controls autoplay style="max-width:90vw; max-height:85vh; border-radius:8px;"></video>`;
  }

  modal.style.display = 'flex';
}

function closePreview() {
  const modal = document.getElementById('previewModal');
  const content = document.getElementById('previewContent');
  modal.style.display = 'none';
  content.innerHTML = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePreview();
});

// ============ QR CODES ============
async function generateQR() {
  const baseUrl = document.getElementById('qrBaseUrl').value;
  const weddingType = document.getElementById('qrWeddingType').value;
  const alertEl = document.getElementById('qrAlert');

  if (!baseUrl) {
    alert('Zəhmət olmasa sayt ünvanını daxil edin.');
    return;
  }

  alertEl.style.display = 'none';

  try {
    const res = await fetch('/api/admin/generate-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: baseUrl, wedding_type: weddingType })
    });

    const data = await res.json();

    if (data.success) {
      const label = WEDDING_LABELS[weddingType] || weddingType;
      alertEl.textContent = `${label} üçün QR kod uğurla yaradıldı!`;
      alertEl.style.display = 'block';
      loadQRCodes();
    }
  } catch (e) {
    alert('QR kod yaratma xətası!');
  }
}

async function loadQRCodes() {
  const grid = document.getElementById('qrGrid');

  try {
    const res = await fetch('/api/admin/qr-codes');
    const data = await res.json();

    grid.innerHTML = '';

    if (!data.qrCodes || data.qrCodes.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color: var(--text-muted);">Hələ QR kod yaradılmayıb. Yuxarıdan yarada bilərsiniz.</div>';
      return;
    }

    data.qrCodes.forEach(qr => {
      const card = document.createElement('div');
      card.className = 'qr-card';
      card.innerHTML = `
        <img src="${qr.url}" alt="${qr.label}">
        <div class="qr-card-label">${qr.label}</div>
      `;
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color: var(--error);">QR kodlar yüklənmədi.</div>';
  }
}

function downloadQRAll() {
  window.open('/api/admin/download-qr-all', '_blank');
}

function printQR() {
  window.print();
}

// ============ UTILS ============
function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('az-AZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
