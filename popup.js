document.addEventListener('DOMContentLoaded', () => {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  const authBadge = document.getElementById('auth-status-badge');
  const authBadgeText = document.getElementById('auth-badge-text');
  
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const startBtn = document.getElementById('start-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const openTabBtn = document.getElementById('open-tab-btn');
  
  const folderInput = document.getElementById('folder-input');
  const detectedCount = document.getElementById('detected-count');
  
  const progressContainer = document.getElementById('progress-container');
  const statusText = document.getElementById('status-text');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressDetails = document.getElementById('progress-details');
  const progressEta = document.getElementById('progress-eta');

  function setAuthState(isAuthenticated) {
    if (isAuthenticated) {
      authSection.classList.add('hidden');
      appSection.classList.remove('hidden');
      authBadge.className = 'badge badge-online';
      authBadgeText.innerText = 'Conectado';
    } else {
      authSection.classList.remove('hidden');
      appSection.classList.add('hidden');
      authBadge.className = 'badge badge-offline';
      authBadgeText.innerText = 'Desconectado';
    }
  }

  function checkAuth() {
    chrome.runtime.sendMessage({ action: "GET_AUTH_STATE" }, (response) => {
      if (response && response.authenticated) {
        setAuthState(true);
      } else {
        setAuthState(false);
      }
    });
  }

  checkAuth();

  // Login 1-clique oficial (chrome.identity)
  loginBtn.addEventListener('click', () => {
    loginBtn.disabled = true;
    loginBtn.innerText = 'Conectando ao Google...';
    
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `
        <svg class="google-icon" width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        Conectar com Google
      `;
      if (chrome.runtime.lastError || !token) {
        alert("Não foi possível conectar: " + (chrome.runtime.lastError?.message || "Autorização cancelada."));
        return;
      }
      setAuthState(true);
    });
  });

  logoutBtn.addEventListener('click', () => {
    if (confirm("Deseja realmente desconectar sua conta?")) {
      chrome.runtime.sendMessage({ action: "LOGOUT" }, () => {
        setAuthState(false);
      });
    }
  });

  // Detector de links em tempo real
  function parseFolderIds() {
    const text = folderInput.value.trim();
    if (!text) return [];
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const folderIds = [];
    
    for (const line of lines) {
      let folderId = line;
      const match = line.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (match) {
        folderId = match[1];
      } else if (line.includes("id=")) {
        const urlParams = new URLSearchParams(line.split('?')[1]);
        if (urlParams.has("id")) folderId = urlParams.get("id");
      }
      if (folderId && folderId.length > 5) {
        folderIds.push(folderId);
      }
    }
    return folderIds;
  }

  folderInput.addEventListener('input', () => {
    const ids = parseFolderIds();
    detectedCount.innerText = `${ids.length} detectado(s)`;
  });

  // Iniciar Cópia
  startBtn.addEventListener('click', () => {
    const folderIds = parseFolderIds();
    if (folderIds.length === 0) {
      alert("Por favor, insira ao menos um link ou ID válido de pasta do Google Drive.");
      folderInput.focus();
      return;
    }

    progressContainer.classList.remove('hidden');
    startBtn.classList.add('hidden');
    cancelBtn.classList.remove('hidden');
    statusText.innerText = `Iniciando fila com ${folderIds.length} pasta(s)...`;
    
    const forceFresh = document.getElementById('force-fresh').checked;
    const clearCopyOnly = document.getElementById('clear-copy-only').checked;
    
    chrome.runtime.sendMessage({ 
      action: "START_COPY", 
      folderIds: folderIds, 
      forceFresh: forceFresh, 
      clearCopyOnly: clearCopyOnly 
    });
  });

  // Cancelar Cópia
  cancelBtn.addEventListener('click', () => {
    if (confirm("Tem certeza que deseja cancelar a cópia em andamento?")) {
      chrome.runtime.sendMessage({ action: "CANCEL_COPY" });
      cancelBtn.classList.add('hidden');
      startBtn.classList.remove('hidden');
    }
  });

  // Abrir aba de acompanhamento
  openTabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tab.html") });
  });

  function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // Listener de Progresso
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "COPY_PROGRESS") {
      if (message.status && message.status !== "Inativo") {
        progressContainer.classList.remove('hidden');
        statusText.innerText = message.status;
        
        const percent = message.total > 0 ? Math.round((message.copied / message.total) * 100) : 0;
        progressBarFill.style.width = percent + "%";
        
        let detailsText = `${message.copied} / ${message.total} itens`;
        if (message.totalBytes) {
          detailsText += ` (${formatBytes(message.totalBytes)})`;
        }
        progressDetails.innerText = detailsText;
        progressEta.innerText = message.eta ? `ETA: ${message.eta}` : '';

        const isRunning = message.activeScans && (message.activeScans.length > 0 || message.copied < message.total);
        if (isRunning && message.total > 0) {
          startBtn.classList.add('hidden');
          cancelBtn.classList.remove('hidden');
        } else {
          startBtn.classList.remove('hidden');
          cancelBtn.classList.add('hidden');
        }
      }
    }
  });

  // Sincroniza status inicial
  chrome.runtime.sendMessage({ action: "GET_STATUS" }, (status) => {
    if (status && status.status && status.status !== "Inativo") {
      progressContainer.classList.remove('hidden');
      statusText.innerText = status.status;
      const percent = status.total > 0 ? Math.round((status.copied / status.total) * 100) : 0;
      progressBarFill.style.width = percent + "%";
      progressDetails.innerText = `${status.copied} / ${status.total} itens`;
    }
  });
});
