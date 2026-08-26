// tab.js - Dashboard Avançado do Copiador & Catalogador de Drive

function switchDashTab(tabName) {
  document.querySelectorAll('.dash-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.dash-tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById('dash-tab-' + tabName).classList.add('active');
  document.getElementById('tab-btn-' + tabName).classList.add('active');

  if (tabName === 'catalog') {
    loadCatalogHistory();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const kpiCopied = document.getElementById('kpi-copied');
  const kpiPercent = document.getElementById('kpi-percent');
  const kpiBytes = document.getElementById('kpi-bytes');
  const kpiEta = document.getElementById('kpi-eta');
  const kpiStatus = document.getElementById('kpi-status');
  const kpiScans = document.getElementById('kpi-scans');

  const statusTitle = document.getElementById('status-title');
  const progressPercentLabel = document.getElementById('progress-percent-label');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const activeScansBox = document.getElementById('active-scans-box');

  const logContainer = document.getElementById('log-container');
  const treeContainer = document.getElementById('tree-container');
  const treeCounter = document.getElementById('tree-counter');
  const clearLogsBtn = document.getElementById('clear-logs-btn');

  let totalMappedItems = 0;
  const treeNodes = {};

  function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  function appendLog(text, type = "normal", time = null) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    if (type === 'error') div.classList.add('log-error');
    if (type === 'info') div.classList.add('log-info');
    if (text.includes("✅") || text.includes("🎉") || text.includes("concluída")) div.classList.add('log-success');

    const logTime = time || new Date().toLocaleTimeString();
    div.innerHTML = `<span class="log-time">[${logTime}]</span> ${escapeHtml(text)}`;

    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function escapeHtml(string) {
    return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateDashboard(message) {
    if (!message) return;

    statusTitle.innerText = message.status || 'Em espera';
    kpiStatus.innerText = message.status || 'Inativo';

    const percent = message.total > 0 ? Math.round((message.copied / message.total) * 100) : 0;
    progressBarFill.style.width = percent + "%";
    progressPercentLabel.innerText = percent + "%";
    
    kpiCopied.innerText = `${message.copied} / ${message.total}`;
    kpiPercent.innerText = `${percent}% concluído`;
    kpiBytes.innerText = formatBytes(message.totalBytes);
    kpiEta.innerText = message.eta || '--';

    if (message.activeScans && message.activeScans.length > 0) {
      activeScansBox.style.display = 'block';
      activeScansBox.innerHTML = `<strong>Pastas em processamento:</strong> ${message.activeScans.map(s => escapeHtml(s)).join(', ')}`;
      kpiScans.innerText = `${message.activeScans.length} pasta(s) ativas`;
    } else {
      activeScansBox.style.display = 'none';
      kpiScans.innerText = `Nenhuma pasta ativa`;
    }
  }

  // -------------------------------------------------------------
  // Catalog History Loader
  // -------------------------------------------------------------
  function loadCatalogHistory() {
    chrome.storage.local.get(['catalogHistory'], (res) => {
      const history = res.catalogHistory || [];
      const tbody = document.getElementById('catalog-history-body');
      const emptyMsg = document.getElementById('catalog-empty-msg');
      tbody.innerHTML = '';

      if (history.length === 0) {
        emptyMsg.style.display = 'block';
      } else {
        emptyMsg.style.display = 'none';
        history.forEach((item, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <strong>${escapeHtml(item.name || 'Catálogo Sem Título')}</strong>
            </td>
            <td>${escapeHtml(item.date || '--')}</td>
            <td>${item.filesCount || 0} arquivos</td>
            <td>${formatBytes(item.totalSize)}</td>
            <td style="text-align: right;">
              <button class="btn-table-action" onclick="previewCatalog()">
                👁️ Visualizar
              </button>
              <button class="btn-table-action" onclick="downloadCatalog()">
                💾 Baixar HTML
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
  }

  window.previewCatalog = function() {
    chrome.runtime.sendMessage({ action: "OPEN_CATALOG_PREVIEW" });
  };

  window.downloadCatalog = function() {
    chrome.runtime.sendMessage({ action: "DOWNLOAD_CATALOG" });
  };

  // -------------------------------------------------------------
  // Message Listener
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "COPY_PROGRESS") {
      updateDashboard(message);

      if (message.logs && message.logs.length > 0) {
        logContainer.innerHTML = '';
        message.logs.forEach(l => appendLog(l.text, l.type, l.time));
      }
    } 
    else if (message.action === "TREE_NODE_ADDED") {
      const item = message.item;
      totalMappedItems++;
      treeCounter.innerText = `${totalMappedItems} itens`;

      if (totalMappedItems === 1) {
        treeContainer.innerHTML = '';
      }

      let parentEl = treeNodes[item.parentId] || treeContainer;

      const indentEl = document.createElement('div');
      indentEl.style.marginLeft = '16px';
      indentEl.style.borderLeft = '1px solid #e0e0e0';
      indentEl.style.paddingLeft = '8px';
      indentEl.style.marginTop = '2px';

      const icon = item.isFolder ? '📁' : '📄';
      indentEl.innerHTML = `<span style="font-size: 13px;">${icon} ${escapeHtml(item.name)}</span>`;

      parentEl.appendChild(indentEl);
      if (item.isFolder) {
        treeNodes[item.id] = indentEl;
      }
    }
  });

  clearLogsBtn.addEventListener('click', () => {
    logContainer.innerHTML = '<div class="log-entry log-info">[Terminal limpo pelo usuário]</div>';
  });

  // Initial Status Request
  chrome.runtime.sendMessage({ action: "GET_STATUS" }, (res) => {
    if (res) {
      updateDashboard(res);
      if (res.logs && res.logs.length > 0) {
        logContainer.innerHTML = '';
        res.logs.forEach(l => appendLog(l.text, l.type, l.time));
      }
    }
  });

  // Load catalog history if opened
  loadCatalogHistory();
});
