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
  const cancelBtn = document.getElementById('cancel-btn');

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

  // Listener de Mensagens
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

      const itemEl = document.createElement('div');
      itemEl.className = 'tree-item';
      const icon = item.isFolder ? '📁' : '📄';
      itemEl.innerHTML = `<span>${icon}</span> <span>${escapeHtml(item.name)}</span>`;

      if (item.isFolder && item.id) {
        treeNodes[item.id] = indentEl;
      }

      indentEl.appendChild(itemEl);
      parentEl.appendChild(indentEl);
      treeContainer.scrollTop = treeContainer.scrollHeight;
    }
  });

  // Limpar logs
  clearLogsBtn.addEventListener('click', () => {
    logContainer.innerHTML = '<div class="log-entry log-info"><span class="log-time">[Sistema]</span> Terminal limpo pelo usuário.</div>';
  });

  // Cancelar Cópia
  cancelBtn.addEventListener('click', () => {
    if (confirm("Deseja realmente interromper e cancelar a cópia em andamento?")) {
      chrome.runtime.sendMessage({ action: "CANCEL_COPY" });
    }
  });

  // Carrega estado inicial
  chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
    if (response) {
      updateDashboard(response);
      if (response.logs && response.logs.length > 0) {
        logContainer.innerHTML = '';
        response.logs.forEach(l => appendLog(l.text, l.type, l.time));
      }
    }
  });
});
