   
      if (fileInput) fileInput.value = '';
      await loadAllVideos();
      showToast(`✨ "${title}" uploaded! Share link works for everyone.`);
      
    } catch (err) {
      console.error(err);
      if (statusDiv) statusDiv.innerHTML = '❌ Upload failed';
      showToast('Upload error: ' + err.message, 3000);
    }
  }
  
  // LOAD ALL VIDEOS
  async function loadAllVideos() {
    const container = document.getElementById('videoListContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding: 2rem; text-align: center;">⏳ Loading videos...</div>';
    
    try {
      const { data: videos, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      if (!videos || videos.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:3rem;">✨ No videos yet. Upload your first video! ✨</div>';
        return;
      }
      
      container.innerHTML = '';
      for (const video of videos) {
        const card = document.createElement('div');
        card.className = 'video-card';
        const durationStr = formatDuration(video.duration);
        const sizeMB = (video.size / (1024 * 1024)).toFixed(2);
        const uploadDate = new Date(video.created_at).toLocaleDateString();
        
        card.innerHTML = `
          <div class="video-preview" data-id="${video.id}">
            <div class="play-overlay" data-id="${video.id}"><div class="play-icon"></div></div>
            <video class="inline-video" data-id="${video.id}" preload="metadata" style="width:100%; height:100%; object-fit: contain;" poster=""></video>
          </div>
          <div class="video-info">
            <div class="video-name" title="${escapeHtml(video.title)}">🎥 ${escapeHtml(video.title)}</div>
            <div class="video-meta">${durationStr} · ${sizeMB} MB · ${uploadDate}</div>
          </div>
          <div class="inline-controls">
            <div class="ctrl-group">
              <button class="icon-btn watch-btn" data-id="${video.id}">▶️ Watch</button>
              <button class="icon-btn copy-link-btn" data-link="${window.location.origin}${window.location.pathname}?id=${video.id}">🔗 Copy link</button>
              <button class="icon-btn delete-btn" data-id="${video.id}" style="color:#b91c1c;">🗑️ Del</button>
            </div>
          </div>
        `;
        container.appendChild(card);
      }
      
      document.querySelectorAll('.play-overlay, .watch-btn').forEach(el => {
        el.addEventListener('click', (e) => {
          const id = el.getAttribute('data-id');
          if (id) navigateToWatch(id);
        });
      });
      
      document.querySelectorAll('.copy-link-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await navigator.clipboard.writeText(btn.getAttribute('data-link'));
          showToast('✅ Share link copied! Works for anyone!');
        });
      });
      
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pwd = prompt("🔐 Enter delete password:");
          if (pwd !== UPLOAD_PASSWORD) { showToast("❌ Incorrect password", 3000); return; }
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this video permanently?')) {
            await supabase.storage.from(BUCKET_NAME).remove([id]);
            await supabase.from('videos').delete().eq('id', id);
            showToast('Video deleted');
            await loadAllVideos();
            if (currentWatchVideoId === id) navigateToHome();
          }
        });
      });
      
    } catch (err) {
      console.error(err);
      container.innerHTML = '<div style="color:red;">❌ Failed to load videos: ' + err.message + '</div>';
    }
  }
  
  // SHOW WATCH VIEW
  async function showWatchView(videoId) {
    const watchView = document.getElementById('watchView');
    const homeView = document.getElementById('homeView');
    if (watchView) watchView.classList.add('active');
    if (homeView) homeView.classList.remove('active');
    ['aboutView', 'termsView', 'privacyView', 'termsuseView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    
    currentWatchVideoId = videoId;
    const videoPlayer = document.getElementById('videoPlayerElement');
    const titleEl = document.getElementById('watchVideoTitle');
    const shareInput = document.getElementById('watchShareLinkInput');
    const errorDiv = document.getElementById('watchErrorMsg');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (videoPlayer) {
      videoPlayer.src = '';
      videoPlayer.style.transform = 'rotate(0deg)';
    }
    currentRotationDeg = 0;
    if (titleEl) titleEl.textContent = 'Loading video...';
    
    try {
      const { data: video, error } = await supabase.from('videos').select('*').eq('id', videoId).single();
      if (error || !video) throw new Error('Video not found');
      
      if (titleEl) titleEl.textContent = `🎬 ${video.title}`;
      if (videoPlayer) {
        videoPlayer.src = video.url;
        videoPlayer.load();
      }
      if (shareInput) shareInput.value = `${window.location.origin}${window.location.pathname}?id=${videoId}`;
      
      const saveBtn = document.getElementById('saveWatchVideoBtn');
      if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', () => downloadVideo(video.url, video.title));
      }
      
    } catch (err) {
      if (errorDiv) errorDiv.style.display = 'block';
      if (titleEl) titleEl.textContent = 'Video not available';
    }
  }
  
  // NAVIGATION
  function initWatchControls() {
    const videoPlayer = document.getElementById('videoPlayerElement');
    const rotateBtn = document.getElementById('rotateVideoBtn');
    const resetBtn = document.getElementById('resetRotationBtn');
    const fullBtn = document.getElementById('fullscreenVideoBtn');
    
    if (rotateBtn) rotateBtn.onclick = () => {
      if (!videoPlayer) return;
      currentRotationDeg = (currentRotationDeg + 90) % 360;
      videoPlayer.style.transform = `rotate(${currentRotationDeg}deg)`;
      showToast(`Rotated ${currentRotationDeg}°`);
    };
    
    if (resetBtn) resetBtn.onclick = () => {
      currentRotationDeg = 0;
      if (videoPlayer) videoPlayer.style.transform = 'rotate(0deg)';
      showToast('Rotation reset');
    };
    
    if (fullBtn) fullBtn.onclick = () => {
      if (!videoPlayer) return;
      if (videoPlayer.requestFullscreen) videoPlayer.requestFullscreen();
      else if (videoPlayer.webkitRequestFullscreen) videoPlayer.webkitRequestFullscreen();
      else showToast("Fullscreen not supported", 1000);
    };
  }
  
  async function navigateToWatch(videoId) {
    const newUrl = `${window.location.origin}${window.location.pathname}?id=${videoId}`;
    window.history.pushState({ view: 'watch', id: videoId }, '', newUrl);
    await showWatchView(videoId);
  }
  
  function navigateToHome() {
    const watchView = document.getElementById('watchView');
    const homeView = document.getElementById('homeView');
    if (watchView) watchView.classList.remove('active');
    if (homeView) homeView.classList.add('active');
    ['aboutView', 'termsView', 'privacyView', 'termsuseView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    window.history.pushState({ view: 'home' }, '', window.location.pathname);
    currentWatchVideoId = null;
    loadAllVideos();
  }
  
  function showLegalView(viewId) {
    const watchView = document.getElementById('watchView');
    const homeView = document.getElementById('homeView');
    if (watchView) watchView.classList.remove('active');
    if (homeView) homeView.classList.remove('active');
    ['aboutView', 'termsView', 'privacyView', 'termsuseView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === viewId);
    });
  }
  
  async function handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('id');
    if (videoId) {
      await showWatchView(videoId);
    } else {
      navigateToHome();
    }
  }
  
  // INITIALIZE EVERYTHING
  initWatchControls();
  handleRouting();
  
  // BUTTON EVENT LISTENERS
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) uploadBtn.onclick = uploadVideo;
  
  const watchBackBtn = document.getElementById('watchBackBtn');
  if (watchBackBtn) watchBackBtn.onclick = navigateToHome;
  
  const copyWatchLinkBtn = document.getElementById('copyWatchLinkButton');
  if (copyWatchLinkBtn) {
    copyWatchLinkBtn.onclick = () => {
      const input = document.getElementById('watchShareLinkInput');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast('Share link copied!');
      }
    };
  }
  
  const navHomeBtn = document.getElementById('navHomeBtn');
  if (navHomeBtn) navHomeBtn.onclick = navigateToHome;
  
  const navAboutBtn = document.getElementById('navAboutBtn');
  if (navAboutBtn) navAboutBtn.onclick = () => showLegalView('aboutView');
  
  const navTermsBtn = document.getElementById('navTermsBtn');
  if (navTermsBtn) navTermsBtn.onclick = () => showLegalView('termsView');
  
  const navPrivacyBtn = document.getElementById('navPrivacyBtn');
  if (navPrivacyBtn) navPrivacyBtn.onclick = () => showLegalView('privacyView');
  
  const navTermsUseBtn = document.getElementById('navTermsUseBtn');
  if (navTermsUseBtn) navTermsUseBtn.onclick = () => showLegalView('termsuseView');
  
  document.querySelectorAll('.close-legal').forEach(btn => {
    btn.onclick = navigateToHome;
  });
  
  window.addEventListener('popstate', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) await showWatchView(id);
    else navigateToHome();
  });
  
  console.log("App initialized. Age verified:", localStorage.getItem('ageVerified') === 'true');
});
// WAIT FOR DOM TO LOAD FIRST
document.addEventListener('DOMContentLoaded', function() {
  
  // SUPABASE CONFIG
  const SUPABASE_URL = 'https://rkqdpmiqdnycafjxxtwu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcWRwbXFpZG55Y2Fmanh4dHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTIyMjgsImV4cCI6MjA5MjA4ODIyOH0.G1exf2VXB5bQcbKkIgqvVCwPgUxgeJ7Gp-uqc8Gh6CM';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const BUCKET_NAME = 'Videos';
  const UPLOAD_PASSWORD = 'Kingkuma254.$$';
  
  // AGE GATE ELEMENTS
  const ageGate = document.getElementById('ageGate');
  const mainApp = document.getElementById('mainApp');
  const confirmBtn = document.getElementById('confirmAgeBtn');
  const denyBtn = document.getElementById('denyAgeBtn');
  
  // AGE GATE FUNCTIONS
  function setAgeVerified() {
    localStorage.setItem('ageVerified', 'true');
    ageGate.style.display = 'none';
    mainApp.style.display = 'block';
    loadAllVideos(); // Load videos after verification
  }
  
  function denyAge() {
    alert("You must be 18 or older to access this educational content.");
    window.location.href = "https://www.google.com";
  }
  
  // CHECK IF ALREADY VERIFIED - FIXED: Call loadAllVideos here too!
  if (localStorage.getItem('ageVerified') === 'true') {
    ageGate.style.display = 'none';
    mainApp.style.display = 'block';
    loadAllVideos(); // ← THIS WAS MISSING - NOW FIXED
  } else {
    ageGate.style.display = 'flex';
    mainApp.style.display = 'none';
  }
  
  // ADD BUTTON LISTENERS
  if (confirmBtn) confirmBtn.onclick = setAgeVerified;
  if (denyBtn) denyBtn.onclick = denyAge;
  
  // GLOBAL VARIABLES
  let currentWatchVideoId = null;
  let currentRotationDeg = 0;
  
  // HELPER FUNCTIONS
  function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toastMessage');
    if (toast) {
      toast.textContent = msg;
      toast.style.opacity = '1';
      setTimeout(() => toast.style.opacity = '0', duration);
    } else {
      console.log("Toast:", msg);
    }
  }
  
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, (m) => {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
  
  async function getVideoDuration(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration);
        video.remove();
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  }
  
  async function downloadVideo(url, filename) {
    try {
      showToast('Starting download...');
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      showToast('Download complete');
    } catch (err) {
      showToast('Download failed', 2000);
    }
  }
  
  // UPLOAD VIDEO
  async function uploadVideo() {
    const fileInput = document.getElementById('videoFileInput');
    const file = fileInput?.files[0];
    if (!file) { showToast("Select a video file first"); return; }
    if (!file.type.startsWith('video/')) { showToast("Select a valid video file"); return; }
    
    const pwd = prompt("🔐 Enter upload password:");
    if (pwd !== UPLOAD_PASSWORD) { showToast("❌ Incorrect password", 3000); return; }
    
    let title = prompt("Enter video title:", file.name.split('.')[0]);
    if (!title) title = file.name.split('.')[0];
    
    const statusDiv = document.getElementById('uploadStatusMsg');
    if (statusDiv) statusDiv.innerHTML = '<span class="spinner"></span> Uploading to cloud...';
    
    try {
      const duration = await getVideoDuration(file);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      
      console.log("Uploading to bucket:", BUCKET_NAME);
      
      const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
      if (uploadError) throw new Error(uploadError.message);
      
      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      const videoUrl = publicUrlData.publicUrl;
      
      const { error: insertError } = await supabase.from('videos').insert([{
        id: fileName,
        title: title,
        url: videoUrl,
        duration: duration,
        size: file.size,
        created_at: new Date().toISOString()
      }]);
      
      if (insertError) throw new Error(insertError.message);
      
      if (statusDiv) statusDiv.innerHTML = '✅ Upload complete!';
      setTimeout(() => { if (statusDiv) statusDiv.innerHTML = ''; }, 2000);
      
      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${fileName}`;
      const freshInput = document.getElementById('freshShareInput');
      const freshContainer = document.getElementById('freshShareContainer');
      if (freshInput) freshInput.value = shareUrl;
      if (freshContainer) freshContainer.style.display = 'block';
      
      const copyBtn = document.getElementById('copyFreshLinkBtn');
      if (copyBtn) copyBtn.onclick = () => {
        navigator.clipboard.writeText(shareUrl);
        showToast('Link copied! Works for anyone!');
      };
      
      if (fileInput) fileInput.value = '';
      await loadAllVideos();
      showToast(`✨ "${title}" uploaded! Share link works for everyone.`);
      
    } catch (err) {
      console.error("Upload error:", err);
      if (statusDiv) statusDiv.innerHTML = '❌ Upload failed';
      showToast('Upload error: ' + err.message, 3000);
    }
  }
  
  // LOAD ALL VIDEOS
  async function loadAllVideos() {
    const container = document.getElementById('videoListContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding: 2rem; text-align: center;">⏳ Loading videos...</div>';
    
    try {
      console.log("Fetching videos from Supabase...");
      
      const { data: videos, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      
      console.log("Videos found:", videos?.length || 0);
      
      if (!videos || videos.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:3rem;">✨ No videos yet. Upload your first video! ✨</div>';
        return;
      }
      
      container.innerHTML = '';
      for (const video of videos) {
        const card = document.createElement('div');
        card.className = 'video-card';
        const durationStr = formatDuration(video.duration);
        const sizeMB = (video.size / (1024 * 1024)).toFixed(2);
        const uploadDate = new Date(video.created_at).toLocaleDateString();
        
        card.innerHTML = `
          <div class="video-preview" data-id="${video.id}">
            <div class="play-overlay" data-id="${video.id}"><div class="play-icon"></div></div>
            <video class="inline-video" data-id="${video.id}" preload="metadata" style="width:100%; height:100%; object-fit: contain;" poster=""></video>
          </div>
          <div class="video-info">
            <div class="video-name" title="${escapeHtml(video.title)}">🎥 ${escapeHtml(video.title)}</div>
            <div class="video-meta">${durationStr} · ${sizeMB} MB · ${uploadDate}</div>
          </div>
          <div class="inline-controls">
            <div class="ctrl-group">
              <button class="icon-btn watch-btn" data-id="${video.id}">▶️ Watch</button>
              <button class="icon-btn copy-link-btn" data-link="${window.location.origin}${window.location.pathname}?id=${video.id}">🔗 Copy link</button>
              <button class="icon-btn delete-btn" data-id="${video.id}" style="color:#b91c1c;">🗑️ Del</button>
            </div>
          </div>
        `;
        container.appendChild(card);
      }
      
      document.querySelectorAll('.play-overlay, .watch-btn').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          if (id) navigateToWatch(id);
        });
      });
      
      document.querySelectorAll('.copy-link-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await navigator.clipboard.writeText(btn.getAttribute('data-link'));
          showToast('✅ Share link copied! Works for anyone!');
        });
      });
      
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pwd = prompt("🔐 Enter delete password:");
          if (pwd !== UPLOAD_PASSWORD) { showToast("❌ Incorrect password", 3000); return; }
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this video permanently?')) {
            await supabase.storage.from(BUCKET_NAME).remove([id]);
            await supabase.from('videos').delete().eq('id', id);
            showToast('Video deleted');
            await loadAllVideos();
            if (currentWatchVideoId === id) navigateToHome();
          }
        });
      });
      
    } catch (err) {
      console.error("Load error:", err);
      container.innerHTML = `<div style="color:red; padding:2rem; text-align:center;">
        ❌ Failed to load videos: ${err.message}<br><br>
        Check:<br>
        1. Bucket "${BUCKET_NAME}" exists in Supabase Storage<br>
        2. Table "videos" exists in Supabase Database<br>
        3. You are online
      </div>`;
    }
  }
  
  // SHOW WATCH VIEW
  async function showWatchView(videoId) {
    const watchView = document.getElementById('watchView');
    const homeView = document.getElementById('homeView');
    if (watchView) watchView.classList.add('active');
    if (homeView) homeView.classList.remove('active');
    ['aboutView', 'termsView', 'privacyView', 'termsuseView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    
    currentWatchVideoId = videoId;
    const videoPlayer = document.getElementById('videoPlayerElement');
    const titleEl = document.getElementById('watchVideoTitle');
    const shareInput = document.getElementById('watchShareLinkInput');
    const errorDiv = document.getElementById('watchErrorMsg');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (videoPlayer) {
      videoPlayer.src = '';
      videoPlayer.style.transform = 'rotate(0deg)';
    }
    currentRotationDeg = 0;
    if (titleEl) titleEl.textContent = 'Loading video...';
    
    try {
      const { data: video, error } = await supabase.from('videos').select('*').eq('id', videoId).single();
      if (error || !video) throw new Error('Video not found');
      
      if (titleEl) titleEl.textContent = `🎬 ${video.title}`;
      if (videoPlayer) {
        videoPlayer.src = video.url;
        videoPlayer.load();
      }
      if (shareInput) shareInput.value = `${window.location.origin}${window.location.pathname}?id=${videoId}`;
      
      const saveBtn = document.getElementById('saveWatchVideoBtn');
      if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', () => downloadVideo(video.url, video.title));
      }
      
    } catch (err) {
      if (errorDiv) errorDiv.style.display = 'block';
      if (titleEl) titleEl.textContent = 'Video not available';
    }
  }
  
  // NAVIGATION
  function initWatchControls() {
    const videoPlayer = document.getElementById('videoPlayerElement');
    const rotateBtn = document.getElementById('rotateVideoBtn');
    const resetBtn = document.getElementById('resetRotationBtn');
    const fullBtn = document.getElementById('fullscreenVideoBtn');
    
    if (rotateBtn) rotateBtn.onclick = () => {
      if (!videoPlayer) return;
      currentRotationDeg = (currentRotationDeg + 90) % 360;
      videoPlayer.style.transform = `rotate(${currentRotationDeg}deg)`;
      showToast(`Rotated ${currentRotationDeg}°`);
    };
    
    if (resetBtn) resetBtn.onclick = () => {
      currentRotationDeg = 0;
      if (videoPlayer) videoPlayer.style.transform = 'rotate(0deg)';
      showToast('Rotation reset');
    };
    
    if (fullBtn) fullBtn.onclick = () => {
      if (!videoPlayer) return;
      if (videoPlayer.requestFullscreen) videoPlayer.requestFullscreen();
      else if (videoPlayer.webkitRequestFullscreen) videoPlayer.webkitRequestFullscreen();
      else showToast("Fullscreen not supported", 1000);
    };
  }
  
  async function navigateToWatch(videoId) {
    const newUrl = `${window.location.origin}${window.location.pathname}?id=${videoId}`;
    window.history.pushState({ view: 'watch', id: videoId }, '', newUrl);
    await showWatchView(videoId);
  }
  
  function navigateToHome() {
    const watchView = document.getElementById('watchView');
    const homeView = document.getElementById('homeView');
    if (watchView) watchView.classList.remove('active');
    if (homeView) homeView.classList.add('active');
    ['aboutView', 'termsView', 'privacyView', 'termsuseView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    window.history.pushState({ view: 'home' }, '', window.location.pathname);
    currentWatchVideoId = null;
    loadAllVideos();
  }
  
  function showLegalView(viewId) {
    const watchView = document.getElementById('watchView');
    const homeView = document.getElementById('homeView');
    if (watchView) watchView.classList.remove('active');
    if (homeView) homeView.classList.remove('active');
    ['aboutView', 'termsView', 'privacyView', 'termsuseView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === viewId);
    });
  }
  
  async function handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('id');
    if (videoId) {
      await showWatchView(videoId);
    } else {
      navigateToHome();
    }
  }
  
  // INITIALIZE EVERYTHING
  initWatchControls();
  handleRouting();
  
  // BUTTON EVENT LISTENERS
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) uploadBtn.onclick = uploadVideo;
  
  const watchBackBtn = document.getElementById('watchBackBtn');
  if (watchBackBtn) watchBackBtn.onclick = navigateToHome;
  
  const copyWatchLinkBtn = document.getElementById('copyWatchLinkButton');
  if (copyWatchLinkBtn) {
    copyWatchLinkBtn.onclick = () => {
      const input = document.getElementById('watchShareLinkInput');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        showToast('Share link copied!');
      }
    };
  }
  
  const navHomeBtn = document.getElementById('navHomeBtn');
  if (navHomeBtn) navHomeBtn.onclick = navigateToHome;
  
  const navAboutBtn = document.getElementById('navAboutBtn');
  if (navAboutBtn) navAboutBtn.onclick = () => showLegalView('aboutView');
  
  const navTermsBtn = document.getElementById('navTermsBtn');
  if (navTermsBtn) navTermsBtn.onclick = () => showLegalView('termsView');
  
  const navPrivacyBtn = document.getElementById('navPrivacyBtn');
  if (navPrivacyBtn) navPrivacyBtn.onclick = () => showLegalView('privacyView');
  
  const navTermsUseBtn = document.getElementById('navTermsUseBtn');
  if (navTermsUseBtn) navTermsUseBtn.onclick = () => showLegalView('termsuseView');
  
  document.querySelectorAll('.close-legal').forEach(btn => {
    btn.onclick = navigateToHome;
  });
  
  window.addEventListener('popstate', async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) await showWatchView(id);
    else navigateToHome();
  });
  
  console.log("App initialized. Bucket name:", BUCKET_NAME);
});
