// Content Script injetado na página do Google Drive (drive.google.com)

(() => {
  // Evita injeção duplicada
  if (document.getElementById('drive-copier-fab')) return;

  const fab = document.createElement('div');
  fab.id = 'drive-copier-fab';
  fab.innerHTML = '📋';
  fab.title = 'Copiador de Drive - Clonar esta pasta';

  const panel = document.createElement('div');
  panel.id = 'drive-copier-panel';
  panel.innerHTML = `
    <div class="gdc-header">
      <span style="font-size: 18px;">📁</span>
      <h3>Copiador de Drive</h3>
    </div>
    <p class="gdc-desc">Deseja clonar e transferir a pasta atualmente aberta para o seu <strong>Meu Drive</strong>?</p>
    <div id="gdc-folder-display" class="gdc-folder-info">Detectando pasta...</div>
    <button id="gdc-start-btn" class="gdc-btn-primary">
      <span>Copiar Esta Pasta</span>
    </button>
    <button id="gdc-hide-btn" class="gdc-btn-secondary">Ocultar Botão</button>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  function getFolderIdFromUrl() {
    const url = window.location.href;
    const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    
    if (url.includes("id=")) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      if (urlParams.has("id")) return urlParams.get("id");
    }
    return null;
  }

  function updateFolderDisplay() {
    const folderId = getFolderIdFromUrl();
    const display = document.getElementById('gdc-folder-display');
    const startBtn = document.getElementById('gdc-start-btn');
    
    if (folderId) {
      display.innerText = `ID: ${folderId}`;
      display.style.background = '#e8f0fe';
      display.style.color = '#1a73e8';
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
    } else {
      display.innerText = 'Abra uma pasta compartilhada para copiar.';
      display.style.background = '#fce8e6';
      display.style.color = '#d93025';
      startBtn.disabled = true;
      startBtn.style.opacity = '0.6';
    }
  }

  function showToast(message) {
    const existing = document.getElementById('drive-copier-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'drive-copier-toast';
    toast.innerHTML = `<span>📋</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  fab.addEventListener('click', () => {
    updateFolderDisplay();
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });

  document.getElementById('gdc-hide-btn').addEventListener('click', () => {
    fab.style.display = 'none';
    panel.style.display = 'none';
    showToast('Botão ocultado. Recarregue a página para exibi-lo novamente.');
  });

  document.getElementById('gdc-start-btn').addEventListener('click', () => {
    const folderId = getFolderIdFromUrl();
    if (folderId) {
      chrome.runtime.sendMessage({ 
        action: "START_COPY", 
        folderIds: [folderId],
        forceFresh: false,
        clearCopyOnly: false
      }, () => {
        panel.style.display = 'none';
        showToast('Cópia iniciada em background! Acompanhe clicando no ícone da extensão.');
      });
    }
  });

  // Atualiza exibição quando a URL mudar (navegação SPA do Google Drive)
  window.addEventListener('popstate', updateFolderDisplay);
})();
