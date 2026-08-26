// catalog-engine.js - Motor Gerador de Catálogos e Landing Pages HTML Interativas do Google Drive

function generateHtmlCatalog(tree, token, rootName) {
  const safeRootName = (rootName || tree.name || "Catálogo de Arquivos").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const treeJson = JSON.stringify(tree).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeRootName} - Catálogo Interativo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0b0f19;
      --surface: #111827;
      --card: #1f2937;
      --card-hover: #374151;
      --border: #374151;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --accent: #8b5cf6;
      --success: #10b981;
      --warning: #f59e0b;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --radius: 12px;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      line-height: 1.5;
    }
    header {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .brand h1 {
      font-size: 17px;
      font-weight: 700;
      color: var(--text);
    }
    .search-box {
      position: relative;
      flex: 1;
      max-width: 420px;
    }
    .search-box input {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px 8px 36px;
      border-radius: 20px;
      font-size: 13.5px;
      outline: none;
      transition: all 0.2s;
    }
    .search-box input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
    }
    .search-box svg {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      fill: var(--text-muted);
    }
    .container {
      max-width: 1300px;
      margin: 0 auto;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .hero-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .stat-icon {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: rgba(59, 130, 246, 0.15);
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .stat-info h3 { font-size: 20px; font-weight: 800; color: var(--text); }
    .stat-info p { font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13.5px;
      background: var(--surface);
      padding: 10px 16px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .crumb-btn {
      background: transparent;
      border: none;
      color: var(--primary);
      font-weight: 600;
      cursor: pointer;
      font-size: 13.5px;
    }
    .crumb-btn:hover { text-decoration: underline; }
    .crumb-sep { color: var(--text-muted); }

    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }
    .item-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all 0.2s;
      cursor: pointer;
      position: relative;
    }
    .item-card:hover {
      background: var(--card);
      border-color: var(--primary);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
    .item-preview {
      width: 100%;
      height: 120px;
      background: #030712;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-size: 36px;
      position: relative;
    }
    .item-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .play-badge {
      position: absolute;
      background: rgba(0, 0, 0, 0.7);
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
      border: 2px solid #fff;
    }
    .item-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .item-name {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .btn-action {
      margin-top: 4px;
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-action:hover {
      background: var(--primary);
      border-color: var(--primary);
    }

    /* Modal Player */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }
    .modal-content {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      width: 100%;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .modal-header {
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .modal-title { font-size: 15px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%; }
    .modal-close { background: transparent; border: none; color: var(--text-muted); font-size: 24px; cursor: pointer; }
    .modal-close:hover { color: var(--text); }
    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: #000;
      align-items: center;
      justify-content: center;
      min-height: 360px;
    }
    .modal-body video, .modal-body audio { width: 100%; max-height: 500px; border-radius: 8px; outline: none; }
    .modal-footer {
      padding: 14px 20px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-top: 1px solid var(--border);
    }

    .empty-msg {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
      font-size: 15px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-icon">📁</div>
      <h1>${safeRootName}</h1>
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      <input type="text" id="searchInput" placeholder="Pesquisar arquivos e pastas...">
    </div>
  </header>

  <div class="container">
    <!-- Stats Row -->
    <div class="hero-stats">
      <div class="stat-card">
        <div class="stat-icon">📄</div>
        <div class="stat-info">
          <h3 id="statTotalFiles">0</h3>
          <p>Arquivos</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-info">
          <h3 id="statTotalFolders">0</h3>
          <p>Pastas</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💾</div>
        <div class="stat-info">
          <h3 id="statTotalSize">0 B</h3>
          <p>Tamanho Total</p>
        </div>
      </div>
    </div>

    <!-- Breadcrumbs Navigation -->
    <nav class="breadcrumbs" id="breadcrumbNav">
      <!-- Generated dynamically -->
    </nav>

    <!-- Grid View -->
    <main class="items-grid" id="itemsGrid">
      <!-- Generated dynamically -->
    </main>
  </div>

  <!-- Media Player Modal -->
  <div class="modal-overlay" id="mediaModal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title" id="modalFileName">Visualizador</span>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modalMediaBody">
        <!-- Player will be injected here -->
      </div>
      <div class="modal-footer">
        <a id="modalDirectLink" href="#" target="_blank" class="btn-action" style="background: var(--primary);">
          🔗 Abrir no Google Drive ↗
        </a>
      </div>
    </div>
  </div>

  <script>
    const treeData = ${treeJson};
    let currentFolderId = treeData.id;
    let pathHistory = [{ id: treeData.id, name: treeData.name || "Início" }];

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    // Stats Calculation
    let totalFiles = 0;
    let totalFolders = 0;
    let totalSize = 0;

    function calculateStats(node) {
      if (node.isFolder) {
        if (node.id !== treeData.id) totalFolders++;
        if (node.children) {
          node.children.forEach(calculateStats);
        }
      } else {
        totalFiles++;
        totalSize += (node.size || 0);
      }
    }
    calculateStats(treeData);

    document.getElementById('statTotalFiles').innerText = totalFiles.toLocaleString();
    document.getElementById('statTotalFolders').innerText = totalFolders.toLocaleString();
    document.getElementById('statTotalSize').innerText = formatBytes(totalSize);

    function findNodeById(node, id) {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNodeById(child, id);
          if (found) return found;
        }
      }
      return null;
    }

    function renderBreadcrumbs() {
      const nav = document.getElementById('breadcrumbNav');
      nav.innerHTML = '';
      pathHistory.forEach((item, index) => {
        if (index > 0) {
          const sep = document.createElement('span');
          sep.className = 'crumb-sep';
          sep.innerText = '›';
          nav.appendChild(sep);
        }
        const btn = document.createElement('button');
        btn.className = 'crumb-btn';
        btn.innerText = item.name;
        btn.onclick = () => {
          pathHistory = pathHistory.slice(0, index + 1);
          currentFolderId = item.id;
          renderCurrentFolder();
        };
        nav.appendChild(btn);
      });
    }

    function renderCurrentFolder(searchQuery = '') {
      renderBreadcrumbs();
      const grid = document.getElementById('itemsGrid');
      grid.innerHTML = '';

      const currentNode = findNodeById(treeData, currentFolderId);
      if (!currentNode || !currentNode.children || currentNode.children.length === 0) {
        grid.innerHTML = '<div class="empty-msg">📂 Esta pasta está vazia.</div>';
        return;
      }

      let items = currentNode.children;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = [];
        function searchRec(node) {
          if (node.name && node.name.toLowerCase().includes(q)) {
            items.push(node);
          }
          if (node.children) node.children.forEach(searchRec);
        }
        searchRec(treeData);
      }

      if (items.length === 0) {
        grid.innerHTML = '<div class="empty-msg">🔍 Nenhum arquivo encontrado para "' + searchQuery + '".</div>';
        return;
      }

      // Sort folders first, then files
      items.sort((a, b) => (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0) || a.name.localeCompare(b.name));

      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';

        const isVideo = item.mimeType && item.mimeType.startsWith('video/');
        const isAudio = item.mimeType && item.mimeType.startsWith('audio/');
        const isImage = item.mimeType && item.mimeType.startsWith('image/');
        const isPdf = item.mimeType === 'application/pdf';

        let icon = item.isFolder ? '📁' : isVideo ? '🎬' : isAudio ? '🎵' : isImage ? '🖼️' : isPdf ? '📕' : '📄';

        let previewHtml = '<div class="item-preview">' + icon + (isVideo ? '<div class="play-badge">▶</div>' : '') + '</div>';

        card.innerHTML = previewHtml + 
          '<div class="item-details">' +
            '<div class="item-name" title="' + (item.name || '') + '">' + (item.name || '') + '</div>' +
            '<div class="item-meta">' +
              '<span>' + (item.isFolder ? (item.children ? item.children.length + ' itens' : 'Pasta') : formatBytes(item.size)) + '</span>' +
              '<span>' + (item.isFolder ? 'PASTA' : (item.name.split('.').pop() || 'ARQUIVO').toUpperCase()) + '</span>' +
            '</div>' +
          '</div>';

        card.onclick = () => {
          if (item.isFolder) {
            pathHistory.push({ id: item.id, name: item.name });
            currentFolderId = item.id;
            document.getElementById('searchInput').value = '';
            renderCurrentFolder();
          } else {
            openFileModal(item);
          }
        };

        grid.appendChild(card);
      });
    }

    function openFileModal(item) {
      const modal = document.getElementById('mediaModal');
      const title = document.getElementById('modalFileName');
      const body = document.getElementById('modalMediaBody');
      const directLink = document.getElementById('modalDirectLink');

      title.innerText = item.name;
      directLink.href = 'https://drive.google.com/file/d/' + item.id + '/view';
      body.innerHTML = '';

      const isVideo = item.mimeType && item.mimeType.startsWith('video/');
      const isAudio = item.mimeType && item.mimeType.startsWith('audio/');
      const isImage = item.mimeType && item.mimeType.startsWith('image/');

      if (isVideo) {
        body.innerHTML = '<iframe src="https://drive.google.com/file/d/' + item.id + '/preview" width="100%" height="450" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 8px;"></iframe>';
      } else if (isAudio) {
        body.innerHTML = '<iframe src="https://drive.google.com/file/d/' + item.id + '/preview" width="100%" height="150" frameborder="0" style="border-radius: 8px;"></iframe>';
      } else if (isImage) {
        body.innerHTML = '<img src="https://drive.google.com/thumbnail?id=' + item.id + '&sz=w1200" style="max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px;" alt="' + item.name + '">';
      } else {
        body.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">' +
          '<div style="font-size: 48px; margin-bottom: 12px;">📄</div>' +
          '<p style="font-size: 14px; margin-bottom: 16px;">Visualização embutida disponível diretamente no Google Drive.</p>' +
          '<a href="https://drive.google.com/file/d/' + item.id + '/view" target="_blank" class="btn-action" style="display: inline-flex; background: var(--primary); color: #fff;">Abrir Arquivo no Google Drive ↗</a>' +
        '</div>';
      }

      modal.classList.add('open');
    }

    function closeModal() {
      const modal = document.getElementById('mediaModal');
      const body = document.getElementById('modalMediaBody');
      body.innerHTML = '';
      modal.classList.remove('open');
    }

    document.getElementById('searchInput').addEventListener('input', (e) => {
      renderCurrentFolder(e.target.value);
    });

    window.onclick = (e) => {
      const modal = document.getElementById('mediaModal');
      if (e.target === modal) closeModal();
    };

    // Initial Render
    renderCurrentFolder();
  </script>
</body>
</html>`;
}
