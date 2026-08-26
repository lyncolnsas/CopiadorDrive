// Content Script injetado na página do Google Drive (drive.google.com)

(() => {
  if (document.getElementById('drive-copier-fab')) return;

  const fab = document.createElement('div');
  fab.id = 'drive-copier-fab';
  fab.innerHTML = '⚡';
  fab.title = 'Copiador & Catalogador de Drive';

  const panel = document.createElement('div');
  panel.id = 'drive-copier-panel';
  panel.innerHTML = `
    <div class="gdc-header">
      <span style="font-size: 18px;">📁</span>
      <h3>Copiador & Catalogador</h3>
    </div>
    <p class="gdc-desc">Selecione uma ação para a pasta atualmente aberta:</p>
    <div id="gdc-folder-display" class="gdc-folder-info">Detectando pasta...</div>
    
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
      <button id="gdc-copy-btn" class="gdc-btn-primary">
        <span>🚀 Clonar para Meu Drive</span>
      </button>
      <button id="gdc-catalog-btn" class="gdc-btn-secondary" style="background: #7c3aed; color: #ffffff; border: none;">
        <span>📄 Gerar Catálogo HTML</span>
      </button>
      <button id="gdc-hide-btn" class="gdc-btn-secondary" style="margin-top: 4px; font-size: 11px;">
        Ocultar Botão
      </button>
    </div>
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
    const copyBtn = document.getElementById('gdc-copy-btn');
    const catalogBtn = document.getElementById('gdc-catalog-btn');
    
    if (folderId) {
      display.innerText = `ID: ${folderId}`;
      display.style.background = '#e8f0fe';
      display.style.color = '#1a73e8';
      copyBtn.disabled = false;
      copyBtn.style.opacity = '1';
      catalogBtn.disabled = false;
      catalogBtn.style.opacity = '1';
    } else {
      display.innerText = 'Abra uma pasta compartilhada para acionar.';
      display.style.background = '#fce8e6';
      display.style.color = '#d93025';
      copyBtn.disabled = true;
      copyBtn.style.opacity = '0.6';
      catalogBtn.disabled = true;
      catalogBtn.style.opacity = '0.6';
    }
  }

  function showToast(message) {
    const existing = document.getElementById('drive-copier-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'drive-copier-toast';
    toast.innerHTML = `<span>⚡</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
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

  document.getElementById('gdc-copy-btn').addEventListener('click', () => {
    const folderId = getFolderIdFromUrl();
    if (folderId) {
      chrome.runtime.sendMessage({ 
        action: "START_COPY", 
        folderIds: [folderId],
        forceFresh: false,
        clearCopyOnly: false
      }, () => {
        panel.style.display = 'none';
        showToast('🚀 Cópia iniciada em segundo plano! Acompanhe no popup da extensão.');
      });
    }
  });

  document.getElementById('gdc-catalog-btn').addEventListener('click', () => {
    const folderId = getFolderIdFromUrl();
    if (folderId) {
      chrome.runtime.sendMessage({ 
        action: "START_CATALOG_SCAN", 
        folderId: folderId
      }, () => {
        panel.style.display = 'none';
        showToast('📄 Geração de Catálogo HTML iniciada! Abra o popup para baixar ou visualizar quando terminar.');
      });
    }
  });
})();
