// popup.js - Copiador & Catalogador de Drive

let currentMode = 'copy'; // 'copy' | 'catalog'

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const authBadge = document.getElementById('auth-status-badge');
  const authBadgeText = document.getElementById('auth-badge-text');

  // Mode Tabs
  const tabModeCopy = document.getElementById('tab-mode-copy');
  const tabModeCatalog = document.getElementById('tab-mode-catalog');
  const copyViewPanel = document.getElementById('copy-view-panel');
  const catalogViewPanel = document.getElementById('catalog-view-panel');

  // Copy Elements
  const folderInput = document.getElementById('folder-input');
  const detectedCount = document.getElementById('detected-count');
  const forceFresh = document.getElementById('force-fresh');
  const clearCopyOnly = document.getElementById('clear-copy-only');
  const startBtn = document.getElementById('start-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const openTabBtn = document.getElementById('open-tab-btn');

  // Copy Progress
  const progressContainer = document.getElementById('progress-container');
  const statusText = document.getElementById('status-text');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressDetails = document.getElementById('progress-details');
  const progressEta = document.getElementById('progress-eta');

  // Catalog Elements
  const catalogTitleInput = document.getElementById('catalog-title-input');
  const startCatalogBtn = document.getElementById('start-catalog-btn');
  const catalogProgressContainer = document.getElementById('catalog-progress-container');
  const catalogStatusText = document.getElementById('catalog-status-text');
  const catalogSpinner = document.getElementById('catalog-spinner');
  const catalogReadyActions = document.getElementById('catalog-ready-actions');
  const previewCatalogBtn = document.getElementById('preview-catalog-btn');
  const downloadCatalogBtn = document.getElementById('download-catalog-btn');

  // -------------------------------------------------------------
  // Mode Switching
  // -------------------------------------------------------------
  tabModeCopy.addEventListener('click', () => {
    currentMode = 'copy';
    tabModeCopy.classList.add('active');
    tabModeCatalog.classList.remove('active');
    copyViewPanel.classList.remove('hidden');
    catalogViewPanel.classList.add('hidden');
  });

  tabModeCatalog.addEventListener('click', () => {
    currentMode = 'catalog';
    tabModeCatalog.classList.add('active');
    tabModeCopy.classList.remove('active');
    catalogViewPanel.classList.remove('hidden');
    copyViewPanel.classList.add('hidden');
  });

  // -------------------------------------------------------------
  // Check Auth State
  // -------------------------------------------------------------
  function checkAuthState() {
    chrome.runtime.sendMessage({ action: "GET_AUTH_STATE" }, (response) => {
      if (response && response.authenticated) {
        setAuthUI(true);
      } else {
        setAuthUI(false);
      }
    });
  }

  function setAuthUI(isLoggedIn) {
    if (isLoggedIn) {
      authBadge.className = 'badge badge-online';
      authBadgeText.innerText = 'Conectado';
      authSection.classList.add('hidden');
      appSection.classList.remove('hidden');
      autoFillCurrentTab();
      pollStatus();
      pollCatalogStatus();
    } else {
      authBadge.className = 'badge badge-offline';
      authBadgeText.innerText = 'Desconectado';
      authSection.classList.remove('hidden');
      appSection.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------
  // Auto-detect Active Tab Folder
  // -------------------------------------------------------------
  function autoFillCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          folderInput.value = match[1];
          updateDetectedCount();
        }
      }
    });
  }

  function extractFolderIds(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const ids = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const urlMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (urlMatch) {
        ids.push(urlMatch[1]);
      } else if (/^[a-zA-Z0-9_-]{15,45}$/.test(trimmed)) {
        ids.push(trimmed);
      }
    });
    return Array.from(new Set(ids));
  }

  function updateDetectedCount() {
    const ids = extractFolderIds(folderInput.value);
    detectedCount.innerText = `${ids.length} detectado(s)`;
  }

  folderInput.addEventListener('input', updateDetectedCount);

  // -------------------------------------------------------------
  // Copy Actions
  // -------------------------------------------------------------
  startBtn.addEventListener('click', () => {
    const ids = extractFolderIds(folderInput.value);
    if (ids.length === 0) {
      alert('Por favor, cole pelo menos um link ou ID válido de pasta do Google Drive.');
      return;
    }

    startBtn.classList.add('hidden');
    cancelBtn.classList.remove('hidden');
    progressContainer.classList.remove('hidden');

    chrome.runtime.sendMessage({
      action: "START_COPY",
      folderIds: ids,
      forceFresh: forceFresh.checked,
      clearCopyOnly: clearCopyOnly.checked
    });
  });

  cancelBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "CANCEL_COPY" }, () => {
      startBtn.classList.remove('hidden');
      cancelBtn.classList.add('hidden');
    });
  });

  // -------------------------------------------------------------
  // Catalog Actions
  // -------------------------------------------------------------
  startCatalogBtn.addEventListener('click', () => {
    const ids = extractFolderIds(folderInput.value);
    if (ids.length === 0) {
      alert('Por favor, cole um link ou ID válido da pasta do Google Drive para gerar o catálogo.');
      return;
    }

    const folderId = ids[0];
    const customTitle = catalogTitleInput.value.trim();

    startCatalogBtn.disabled = true;
    startCatalogBtn.innerText = 'Mapeando Pasta...';
    catalogProgressContainer.classList.remove('hidden');
    catalogReadyActions.classList.add('hidden');
    catalogSpinner.classList.remove('hidden');
    catalogStatusText.innerText = 'Iniciando escaneamento...';

    chrome.runtime.sendMessage({
      action: "START_CATALOG_SCAN",
      folderId: folderId,
      customTitle: customTitle
    }, (res) => {
      startCatalogBtn.disabled = false;
      startCatalogBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> Gerar Catálogo HTML';
    });
  });

  previewCatalogBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "OPEN_CATALOG_PREVIEW" });
  });

  downloadCatalogBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "DOWNLOAD_CATALOG" });
  });

  // -------------------------------------------------------------
  // Progress Listeners
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "COPY_PROGRESS") {
      updateCopyUI(message);
    } else if (message.action === "CATALOG_PROGRESS") {
      updateCatalogUI(message);
    }
  });

  function pollStatus() {
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, (res) => {
      if (res) updateCopyUI(res);
    });
  }

  function pollCatalogStatus() {
    chrome.runtime.sendMessage({ action: "GET_CATALOG_STATUS" }, (res) => {
      if (res) updateCatalogUI(res);
    });
  }

  function updateCopyUI(status) {
    if (status.status && status.status !== "Inativo") {
      progressContainer.classList.remove('hidden');
      statusText.innerText = status.status;

      if (status.total > 0) {
        const pct = Math.min(100, Math.round((status.copied / status.total) * 100));
        progressBarFill.style.width = pct + '%';
        progressDetails.innerText = `${status.copied} / ${status.total} (${pct}%)`;
      } else {
        progressBarFill.style.width = '100%';
        progressDetails.innerText = `${status.copied} itens`;
      }

      if (status.eta) {
        progressEta.innerText = `ETA: ${status.eta}`;
      } else {
        progressEta.innerText = '';
      }

      if (status.activeScans && status.activeScans.length > 0) {
        startBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
      } else {
        startBtn.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
      }
    }
  }

  function updateCatalogUI(status) {
    if (status.isScanning) {
      catalogProgressContainer.classList.remove('hidden');
      catalogStatusText.innerText = status.status;
      catalogSpinner.classList.remove('hidden');
      catalogReadyActions.classList.add('hidden');
    } else if (status.htmlData) {
      catalogProgressContainer.classList.remove('hidden');
      catalogStatusText.innerText = `🎉 ${status.folderName || 'Catálogo'} pronto! (${status.totalFiles} arquivos)`;
      catalogSpinner.classList.add('hidden');
      catalogReadyActions.classList.remove('hidden');
    }
  }

  // -------------------------------------------------------------
  // Other Controls
  // -------------------------------------------------------------
  openTabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab.html') });
  });

  loginBtn.addEventListener('click', () => {
    loginBtn.disabled = true;
    loginBtn.innerText = 'Autenticando...';
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Conectar com Google';
      if (token) {
        chrome.storage.local.set({ authToken: token }, () => {
          checkAuthState();
        });
      } else {
        alert('Não foi possível autenticar. Verifique sua conexão e tente novamente.');
      }
    });
  });

  logoutBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "LOGOUT" }, () => {
      setAuthUI(false);
    });
  });

  // Init
  checkAuthState();
});
