// ============ STATE ============
let selectedFiles = [];
let selectedWedding = '';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp'];

const WEDDING_LABELS = {
  gurcustan: '&#127468;&#127466; Gürcüstan Toyu - 14 İyun 2026',
  turkiye: '&#127481;&#127479; Türkiyə Toyu - 21 İyun 2026'
};

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const toy = params.get('toy');

  // If wedding type in URL, skip selection
  if (toy && (toy === 'gurcustan' || toy === 'turkiye')) {
    selectWedding(toy);
  }

  // Upload area click
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  uploadArea.addEventListener('click', () => fileInput.click());

  // Drag & Drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  // Camera inputs
  document.getElementById('cameraInput').addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  document.getElementById('videoCameraInput').addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });
});

// ============ WEDDING SELECTION ============
function selectWedding(type) {
  selectedWedding = type;
  document.getElementById('weddingSelectCard').style.display = 'none';
  document.getElementById('uploadSection').style.display = 'block';
  document.getElementById('weddingBadge').innerHTML = WEDDING_LABELS[type] || type;
}

// ============ CAMERA ============
function openCamera(type) {
  if (type === 'image') {
    document.getElementById('cameraInput').click();
  } else {
    document.getElementById('videoCameraInput').click();
  }
}

// ============ FILE HANDLING ============
function handleFiles(fileList) {
  const errorAlert = document.getElementById('errorAlert');
  errorAlert.style.display = 'none';

  let errors = [];

  for (const file of fileList) {
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`"${file.name}" çox böyükdür (maks. 100MB)`);
      continue;
    }

    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      errors.push(`"${file.name}" dəstəklənməyən format`);
      continue;
    }

    const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate) continue;

    selectedFiles.push(file);
  }

  if (errors.length > 0) {
    errorAlert.textContent = errors.join('. ');
    errorAlert.style.display = 'block';
  }

  updateFileList();
  updateUploadButton();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFileList();
  updateUploadButton();
}

function updateFileList() {
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const isVideo = file.type.startsWith('video/');
    const icon = isVideo ? '&#127909;' : '&#128247;';

    li.innerHTML = `
      <span class="file-item-name">${icon} ${file.name}</span>
      <span class="file-item-size">${formatFileSize(file.size)}</span>
      <button class="file-item-remove" onclick="removeFile(${index})">&times;</button>
    `;
    fileList.appendChild(li);
  });
}

function updateUploadButton() {
  const btn = document.getElementById('uploadBtn');
  const count = selectedFiles.length;
  btn.disabled = count === 0;
  btn.innerHTML = count > 0
    ? `&#128228; ${count} Fayl Yüklə`
    : '&#128228; Yüklə';
}

// ============ UPLOAD ============
async function uploadFiles() {
  if (selectedFiles.length === 0) return;

  const guestName = document.getElementById('guestName').value.trim() || 'Anonim';

  const formData = new FormData();
  formData.append('guest_name', guestName);
  formData.append('wedding_type', selectedWedding);

  for (const file of selectedFiles) {
    formData.append('files', file);
  }

  const uploadBtn = document.getElementById('uploadBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const errorAlert = document.getElementById('errorAlert');

  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '&#8987; Yüklənir...';
  progressContainer.classList.add('active');
  errorAlert.style.display = 'none';

  try {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = percent + '%';
        progressText.textContent = `Yüklənir... %${percent}`;
      }
    });

    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || 'Yükləmə xətası'));
          } catch {
            reject(new Error('Yükləmə xətası'));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Bağlantı xətası. İnternet bağlantınızı yoxlayın.'));
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });

    showSuccess(result.message || `${selectedFiles.length} fayl yükləndi!`);

  } catch (err) {
    errorAlert.textContent = err.message;
    errorAlert.style.display = 'block';
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = `&#128228; ${selectedFiles.length} Fayl Yüklə`;
    progressContainer.classList.remove('active');
  }
}

function showSuccess(message) {
  document.getElementById('uploadCard').style.display = 'none';
  document.getElementById('successCard').style.display = 'block';
  document.getElementById('successMessage').textContent = message;
}

function resetForm() {
  selectedFiles = [];
  updateFileList();
  updateUploadButton();

  document.getElementById('uploadCard').style.display = 'block';
  document.getElementById('successCard').style.display = 'none';
  document.getElementById('progressContainer').classList.remove('active');
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('errorAlert').style.display = 'none';
}

// ============ UTILS ============
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
