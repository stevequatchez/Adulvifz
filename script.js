// AGE GATE LOGIC
const ageGate = document.getElementById('ageGate');
const mainApp = document.getElementById('mainApp');

function setAgeVerified() {
  localStorage.setItem('ageVerified', 'true');
  ageGate.style.display = 'none';
  mainApp.style.display = 'block';
}

function denyAge() {
  alert("You must be 18 or older to access this educational content.");
  window.location.href = "https://www.google.com";
}

if (localStorage.getItem('ageVerified') === 'true') {
  ageGate.style.display = 'none';
  mainApp.style.display = 'block';
} else {
  ageGate.style.display = 'flex';
  mainApp.style.display = 'none';
}

document.getElementById('confirmAgeBtn')?.addEventListener('click', setAgeVerified);
document.getElementById('denyAgeBtn')?.addEventListener('click', denyAge);

// ---------- DATABASE & VIDEO FUNCTIONALITY ----------
const SHARE_DOMAIN = window.location.origin;
const UPLOAD_PASSWORD = 'Kingkuma254.$$';

function buildShareLink(videoId) {
  return `${SHARE_DOMAIN}${window.location.pathname}?id=${encodeURIComponent(videoId)}`;
}

const DB_NAME = 'MyVideosDB';
const DB_VERSION = 2;
const META_STORE = 'videosMeta';
const BLOB_STORE = 'videoBlobs';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(META_STORE))
        database.createObjectStore(META_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(BLOB_STORE))
        database.createObjectStore(BLOB_STORE, { keyPath: 'id' });
    };
  });
}

function generateUniqueId() {
  return 'vid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

async function addVideoToDB(fileBlob, customTitle, mimeType) {
  if (!db) await openDB();
  const id = generateUniqueId();
  const metadata = { id, name: customTitle, type: mimeType, size: fileBlob.size, uploadedAt: new Date().toISOString() };
  const blobTx = db.transaction([BLOB_STORE], 'readwrite');
  blobTx.objectStore(BLOB_STORE).put({ id, blob: fileBlob });
  await new Promise((res, rej) => { blobTx.oncomplete = res; blobTx.onerror = () => rej(blobTx.error); });
  const metaTx = db.transaction([META_STORE], 'readwrite');
  metaTx.objectStore(META_STORE).put(metadata);
  await new Promise((res, rej) => { metaTx.oncomplete = res; metaTx.onerror = () => rej(metaTx.error); });
  return id;
}

async function getAllVideosMeta() {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE], 'readonly');
    const request = tx.objectStore(META_STORE).getAll();
    request.onsuccess = () => {
      const items = request.result || [];
      items.sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getVideoBlobById(videoId) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([BLOB_STORE], 'readonly');
    const request = tx.objectStore(BLOB_STORE).get(videoId);
    request.onsuccess = () => resolve(request.result ? request.result.blob : null);
    request.onerror = () => reject(request.error);
  });
}

async function getVideoMetaById(videoId) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE], 'readonly');
    const request = tx.objectStore(META_STORE).get(videoId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteVideoById(videoId) {
  if (!db) await openDB();
  const txMeta = db.transaction([META_STORE], 'readwrite');
  txMeta.objectStore(META_STORE).delete(videoId);
  await new Promise((res, rej) => { txMeta.oncomplete = res; txMeta.onerror = () => rej(txMeta.error); });
  const txBlob = db.transaction([BLOB_STORE], 'readwrite');
  txBlob.objectStore(BLOB_STORE).delete(videoId);
  await new Promise((res, rej) => { txBlob.oncomplete = res; txBlob.onerror = () => rej(txBlob.error); });
}

let currentWatchVideoId = null;
let currentWatchObjectUrl = null;
let currentRotationDeg = 0;

function releaseWatchUrl() {
  if (currentWatchObjectUrl) { URL.revokeObjectURL(currentWatchObjectUrl); currentWatchObjectUrl = null; }
}

function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toastMessage');
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => toast.style.opacity = '0', duration);
}

// DOWNLOAD WITH PROGRESS
async function downloadWithProgress(blob, filename) {
  if (!blob || blob.size === 0) {
    showToast("❌ Video data is corrupted or missing.", 3000);
    return;
  }
  
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'download-progress-overlay';
    overlay.innerHTML = `
      <div class="progress-card">
        <h3>📥 Preparing Download</h3>
        <div class="progress-bar-bg"><div class="progress-fill" id="downloadProgressFill"></div></div>
        <div class="progress-percent" id="downloadPercent">0%</div>
        <div class="progress-message" id="downloadMessage">Loading ad content...</div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    const fillEl = overlay.querySelector('#downloadProgressFill');
    const percentEl = overlay.querySelector('#downloadPercent');
    const msgEl = overlay.querySelector('#downloadMessage');
    
    const steps = [
      { percent: 0, msg: "🎬 Initializing ad server..." },
      { percent: 20, msg: "📺 Loading sponsored content (Ad)..." },
      { percent: 50, msg: "⏳ Almost ready..." },
      { percent: 80, msg: "🔗 Securing video stream..." },
      { percent: 100, msg: "✅ Starting download..." }
    ];
    
    let stepIndex = 0;
    
    function updateProgress(percent, message) {
      fillEl.style.width = percent + '%';
      percentEl.innerText = percent + '%';
      msgEl.innerText = message;
    }
    
    function nextStep() {
      if (stepIndex < steps.length) {
        const step = steps[stepIndex];
        updateProgress(step.percent, step.msg);
        stepIndex++;
        setTimeout(nextStep, 400);
      } else {
        try {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename || 'video.mp4';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
          setTimeout(() => {
            overlay.remove();
            showToast(`✅ "${filename}" saved successfully!`, 2000);
            resolve();
          }, 800);
        } catch (err) {
          overlay.remove();
          showToast("❌ Download failed – try again.", 3000);
          console.error("Download error:", err);
          resolve();
        }
      }
    }
    
    nextStep();
  });
}

// HIGH QUALITY THUMBNAIL GENERATION
async function generateHighQualityThumbnail(blob, seekTime = 0.5) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(blob);
    video.src = url;
    const cleanUp = () => { URL.revokeObjectURL(url); video.remove(); };
    video.addEventListener('loadeddata', () => { video.currentTime = seekTime; });
    video.addEventListener('seeked', () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width === 0 || height === 0) { cleanUp(); resolve(null); return; }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);
      const dataURL = canvas.toDataURL('image/jpeg', 0.95);
      cleanUp();
      resolve(dataURL);
    });
    video.addEventListener('error', () => { cleanUp(); resolve(null); });
  });
}

// RENDER GALLERY
async function renderVideoGallery() {
  const container = document.getElementById('videoListContainer');
  container.innerHTML = '<div style="padding: 2rem; text-align: center;">⏳ Loading library...</div>';
  try {
    const videos = await getAllVideosMeta();
    if (videos.length === 0) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem;">✨ No educational videos yet. Upload your first video! ✨</div>';
      return;
    }
    container.innerHTML = '';
    for (const video of videos) {
      const card = document.createElement('div');
      card.className = 'video-card';
      const fileSizeMB = (video.size / (1024 * 1024)).toFixed(2);
      const uploadDate = new Date(video.uploadedAt).toLocaleDateString();
      const shareUrl = buildShareLink(video.id);
      card.innerHTML = `
        <div class="video-preview" data-vid="${video.id}">
          <div class="play-overlay" data-play="${video.id}"><div class="play-icon"></div></div>
          <video class="inline-video" data-vid="${video.id}" preload="metadata" style="width:100%; height:100%; object-fit: contain;" poster=""></video>
          <div class="thumbnail-loading" style="display: none;">🎬 generating crisp thumbnail...</div>
        </div>
        <div class="video-info">
          <div class="video-name" title="${escapeHtml(video.name)}">🎥 ${escapeHtml(video.name)}</div>
          <div class="video-meta">${fileSizeMB} MB · ${uploadDate}</div>
          <div class="badge-id">${video.id.substring(0,14)}…</div>
        </div>
        <div class="inline-controls">
          <div class="ctrl-group">
            <button class="icon-btn rotate-inline" data-id="${video.id}">🔄 Rotate</button>
            <button class="icon-btn expand-inline" data-id="${video.id}">⛶ Expand</button>
            <button class="icon-btn save-inline" data-id="${video.id}" data-name="${escapeHtml(video.name)}">💾 Save</button>
          </div>
          <div class="ctrl-group">
            <button class="icon-btn copy-link-inline" data-link="${shareUrl}">🔗 Copy link</button>
            <button class="icon-btn delete-inline" data-id="${video.id}" style="color:#b91c1c;">🗑️ Del</button>
          </div>
        </div>
      `;
      container.appendChild(card);
      
      const videoElem = card.querySelector(`.inline-video[data-vid="${video.id}"]`);
      const loadingSpan = card.querySelector('.thumbnail-loading');
      (async () => {
        try {
          const blob = await getVideoBlobById(video.id);
          if (blob) {
            loadingSpan.style.display = 'block';
            const thumbDataUrl = await generateHighQualityThumbnail(blob, 0.5);
            if (thumbDataUrl) videoElem.poster = thumbDataUrl;
            loadingSpan.style.display = 'none';
          }
        } catch(e) { loadingSpan.style.display = 'none'; }
      })();
      
      const playOverlay = card.querySelector(`.play-overlay[data-play="${video.id}"]`);
      let currentInlineUrl = null, rotationInline = 0;
      const loadAndPlay = async () => {
        if (videoElem.src && videoElem.src.startsWith('blob:')) { videoElem.play().catch(e=>{}); return; }
        playOverlay.innerHTML = '<div class="spinner" style="width:36px;height:36px; border-width:3px;"></div>';
        try {
          const blob = await getVideoBlobById(video.id);
          if (!blob) throw new Error("missing");
          if (currentInlineUrl) URL.revokeObjectURL(currentInlineUrl);
          const url = URL.createObjectURL(blob);
          currentInlineUrl = url;
          videoElem.src = url;
          videoElem.load();
          await videoElem.play();
          playOverlay.style.display = 'none';
        } catch(err) {
          playOverlay.innerHTML = '<div class="play-icon"></div>';
          showToast("Error loading video", 1500);
        }
      };
      playOverlay.addEventListener('click', (e) => { e.stopPropagation(); loadAndPlay(); });
      videoElem.addEventListener('click', () => { if (videoElem.paused) videoElem.play(); });
      
      card.querySelector('.rotate-inline').addEventListener('click', (e) => {
        e.stopPropagation();
        rotationInline = (rotationInline + 90) % 360;
        videoElem.style.transform = `rotate(${rotationInline}deg)`;
        showToast(`Rotated ${rotationInline}°`, 800);
      });
      card.querySelector('.expand-inline').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (videoElem.requestFullscreen) await videoElem.requestFullscreen();
        else if (videoElem.webkitRequestFullscreen) videoElem.webkitRequestFullscreen();
        else showToast("Fullscreen not supported", 1000);
      });
      card.querySelector('.save-inline').addEventListener('click', async (e) => {
        e.stopPropagation();
        const blob = await getVideoBlobById(video.id);
        if (blob && blob.size > 0) {
          await downloadWithProgress(blob, video.name);
        } else {
          showToast("Video data not found or corrupted", 2000);
        }
      });
      card.querySelector('.copy-link-inline').addEventListener('click', async () => {
        await navigator.clipboard.writeText(shareUrl);
        showToast('✅ Share link copied!');
      });
      card.querySelector('.delete-inline').addEventListener('click', async (e) => {
        e.stopPropagation();
        const pwd = prompt("🔐 Authorization required. Enter delete password:");
        if (pwd !== UPLOAD_PASSWORD) { showToast("❌ Incorrect password.", 3000); return; }
        if (confirm(`Permanently delete "${video.name}"?`)) {
          if (currentInlineUrl) URL.revokeObjectURL(currentInlineUrl);
          await deleteVideoById(video.id);
          showToast('🗑️ Video deleted');
          if (currentWatchVideoId === video.id) navigateToHome();
          await renderVideoGallery();
        }
      });
    }
  } catch(err) { container.innerHTML = '<div style="color:red;">❌ Failed to load videos.</div>'; }
}

// WATCH VIEW
async function showWatchView(videoId) {
  releaseWatchUrl();
  document.getElementById('watchView').classList.add('active');
  document.getElementById('homeView').classList.remove('active');
  ['aboutView','termsView','privacyView','termsuseView'].forEach(id => document.getElementById(id).classList.remove('active'));
  currentWatchVideoId = videoId;
  const videoPlayer = document.getElementById('videoPlayerElement');
  const titleEl = document.getElementById('watchVideoTitle');
  const shareInput = document.getElementById('watchShareLinkInput');
  const errorDiv = document.getElementById('watchErrorMsg');
  errorDiv.style.display = 'none';
  videoPlayer.src = '';
  videoPlayer.style.transform = 'rotate(0deg)';
  currentRotationDeg = 0;
  titleEl.textContent = 'Loading video...';
  try {
    const meta = await getVideoMetaById(videoId);
    if (!meta) throw new Error('not found');
    titleEl.textContent = `🎬 ${meta.name}`;
    const blob = await getVideoBlobById(videoId);
    if (!blob) throw new Error('blob missing');
    const url = URL.createObjectURL(blob);
    currentWatchObjectUrl = url;
    videoPlayer.src = url;
    videoPlayer.load();
    shareInput.value = buildShareLink(videoId);
    const saveWatchBtn = document.getElementById('saveWatchVideoBtn');
    const newSaveBtn = saveWatchBtn.cloneNode(true);
    saveWatchBtn.parentNode.replaceChild(newSaveBtn, saveWatchBtn);
    newSaveBtn.addEventListener('click', async () => { 
      if (blob && blob.size > 0) await downloadWithProgress(blob, meta.name); 
      else showToast("Video data not available", 1500); 
    });
  } catch(err) { errorDiv.style.display = 'block'; titleEl.textContent = 'Video not available'; }
}

function initWatchControls() {
  const videoPlayer = document.getElementById('videoPlayerElement');
  document.getElementById('rotateVideoBtn').addEventListener('click', () => {
    if (!videoPlayer) return;
    currentRotationDeg = (currentRotationDeg + 90) % 360;
    videoPlayer.style.transform = `rotate(${currentRotationDeg}deg)`;
    showToast(`Rotated ${currentRotationDeg}°`);
  });
  document.getElementById('resetRotationBtn').addEventListener('click', () => {
    currentRotationDeg = 0;
    videoPlayer.style.transform = 'rotate(0deg)';
    showToast('Rotation reset');
  });
  document.getElementById('fullscreenVideoBtn').addEventListener('click', () => {
    if (videoPlayer.requestFullscreen) videoPlayer.requestFullscreen();
    else if (videoPlayer.webkitRequestFullscreen) videoPlayer.webkitRequestFullscreen();
    else showToast("Fullscreen not supported", 1000);
  });
}

async function navigateToWatch(videoId) {
  if (!videoId) return;
  const newUrl = buildShareLink(videoId);
  window.history.pushState({ view: 'watch', id: videoId }, '', newUrl);
  await showWatchView(videoId);
}

function navigateToHome() {
  releaseWatchUrl();
  document.getElementById('watchView').classList.remove('active');
  document.getElementById('homeView').classList.add('active');
  ['aboutView','termsView','privacyView','termsuseView'].forEach(id => document.getElementById(id).classList.remove('active'));
  const baseClean = `${window.location.origin}${window.location.pathname}`;
  window.history.pushState({ view: 'home' }, '', baseClean);
  currentWatchVideoId = null;
  renderVideoGallery();
}

async function uploadVideoWithAuth(file) {
  let customTitle = prompt("🎬 Enter a title for this educational video:", file.name.split('.')[0] || "Untitled");
  if (!customTitle) customTitle = file.name.split('.')[0] || "Untitled";
  const pwd = prompt("🔐 Authorized access only. Enter upload password:");
  if (pwd !== UPLOAD_PASSWORD) { showToast("❌ Incorrect password. Upload denied.", 3000); return null; }
  if (!file || !file.type.startsWith('video/')) { showToast('Select a valid video file'); return null; }
  if (file.size > 500 * 1024 * 1024) { showToast('Max 500MB'); return null; }
  const statusDiv = document.getElementById('uploadStatusMsg');
  statusDiv.innerHTML = '<span class="spinner"></span> Uploading & saving...';
  try {
    const videoId = await addVideoToDB(file, customTitle, file.type);
    statusDiv.innerHTML = '✅ Upload complete!';
    setTimeout(() => statusDiv.innerHTML = '', 2000);
    const freshContainer = document.getElementById('freshShareContainer');
    const freshInput = document.getElementById('freshShareInput');
    const shareUrl = buildShareLink(videoId);
    freshInput.value = shareUrl;
    freshContainer.style.display = 'block';
    document.getElementById('copyFreshLinkBtn').onclick = () => { navigator.clipboard.writeText(shareUrl); showToast('Link copied'); };
    await renderVideoGallery();
    showToast(`✨ "${customTitle}" uploaded! Share link ready.`);
    return videoId;
  } catch(err) { statusDiv.innerHTML = '❌ Upload failed'; showToast('Upload error'); return null; }
}

async function handleRouting() {
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get('id');
  if (videoId) {
    const meta = await getVideoMetaById(videoId);
    if (meta) await showWatchView(videoId);
    else { navigateToHome(); showToast('Invalid video link', 2000); }
  } else navigateToHome();
}

function escapeHtml(str) { return str.replace(/[&<>]/g, function(m) { if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }

function showLegalView(viewId) {
  releaseWatchUrl();
  document.getElementById('watchView').classList.remove('active');
  document.getElementById('homeView').classList.remove('active');
  ['aboutView','termsView','privacyView','termsuseView'].forEach(id => {
    const el = document.getElementById(id);
    if (id === viewId) el.classList.add('active');
    else el.classList.remove('active');
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  await openDB();
  initWatchControls();
  await renderVideoGallery();
  await handleRouting();
  document.getElementById('uploadBtn').addEventListener('click', async () => {
    const file = document.getElementById('videoFileInput').files[0];
    if (!file) { showToast('Choose a video file first'); return; }
    await uploadVideoWithAuth(file);
    document.getElementById('videoFileInput').value = '';
  });
  document.getElementById('globalHomeBtn')?.addEventListener('click', () => navigateToHome());
  document.getElementById('watchBackBtn').addEventListener('click', () => navigateToHome());
  document.getElementById('copyWatchLinkButton').addEventListener('click', () => {
    const input = document.getElementById('watchShareLinkInput');
    if (input.value) { navigator.clipboard.writeText(input.value); showToast('Share link copied!'); }
  });
  document.getElementById('navHomeBtn').addEventListener('click', () => navigateToHome());
  document.getElementById('navAboutBtn').addEventListener('click', () => showLegalView('aboutView'));
  document.getElementById('navTermsBtn').addEventListener('click', () => showLegalView('termsView'));
  document.getElementById('navPrivacyBtn').addEventListener('click', () => showLegalView('privacyView'));
  document.getElementById('navTermsUseBtn').addEventListener('click', () => showLegalView('termsuseView'));
  document.querySelectorAll('.close-legal').forEach(btn => btn.addEventListener('click', () => navigateToHome()));
  window.addEventListener('popstate', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && await getVideoMetaById(id)) await showWatchView(id);
    else navigateToHome();
  });
});