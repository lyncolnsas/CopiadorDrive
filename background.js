// Background Service Worker - Copiador de Drive (Manifest V3)

let activeProcesses = 0;
let apiQueue = Promise.resolve();
let isCancellationRequested = false;

let currentStatus = {
  status: "Inativo",
  copied: 0,
  total: 0,
  totalBytes: 0,
  logs: [],
  startTime: null,
  activeScans: []
};

// Intervalo de segurança entre requisições para evitar rate limit (cota) da API do Google Drive
const API_DELAY_MS = 300;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Keep-Alive com chrome.alarms para evitar que o Chrome encerre o Service Worker durante cópias longas
function updateKeepAlive() {
  if (activeProcesses > 0) {
    chrome.alarms.create("copier_keep_alive", { periodInMinutes: 0.5 });
  } else {
    chrome.alarms.clear("copier_keep_alive");
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "copier_keep_alive") {
    broadcastProgress();
  }
});

// Carrega o último estado salvo ao inicializar
chrome.storage.local.get(['activeTaskStatus'], (res) => {
  if (res.activeTaskStatus) {
    currentStatus = { ...currentStatus, ...res.activeTaskStatus };
    if (activeProcesses === 0 && currentStatus.status.includes("Processando")) {
      currentStatus.status = "Pausado / Concluído";
    }
  }
});

async function saveStatusToStorage() {
  try {
    await chrome.storage.local.set({ activeTaskStatus: currentStatus });
  } catch (e) {}
}

function broadcastProgress() {
  let etaStr = "";
  if (currentStatus.startTime && currentStatus.copied > 0 && currentStatus.total > 0) {
    const elapsed = Date.now() - currentStatus.startTime;
    const rate = currentStatus.copied / elapsed;
    const remaining = currentStatus.total - currentStatus.copied;
    if (remaining > 0) {
      const etaMs = remaining / rate;
      const totalSecs = Math.round(etaMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      etaStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }
  }
  
  const payload = { action: "COPY_PROGRESS", ...currentStatus, eta: etaStr };
  chrome.runtime.sendMessage(payload).catch(() => {});
  saveStatusToStorage();
}

function addLog(text, type = "normal") {
  if (currentStatus.logs.length > 500) {
    currentStatus.logs.shift(); // Mantém os últimos 500 logs
  }
  currentStatus.logs.push({ text, type, time: new Date().toLocaleTimeString() });
  currentStatus.status = text;
  broadcastProgress();
}

// -------------------------------------------------------------
// Autenticação Nativa (chrome.identity)
// -------------------------------------------------------------
async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        // Tenta fallback com token armazenado
        chrome.storage.local.get(['authToken'], (res) => {
          if (res.authToken) {
            resolve(res.authToken);
          } else {
            reject(new Error(chrome.runtime.lastError?.message || "LOGIN_REQUIRED"));
          }
        });
      } else {
        chrome.storage.local.set({ authToken: token });
        resolve(token);
      }
    });
  });
}

async function removeCachedToken(token) {
  if (token) {
    try {
      await new Promise(res => chrome.identity.removeCachedAuthToken({ token: token }, res));
    } catch (e) {}
  }
  await new Promise(res => chrome.storage.local.remove(['authToken'], res));
}

// -------------------------------------------------------------
// Cliente de API Google Drive v3
// -------------------------------------------------------------
async function apiRequest(endpoint, options = {}, isRetry = false) {
  return new Promise((resolve, reject) => {
    apiQueue = apiQueue.then(async () => {
      if (isCancellationRequested) {
        throw new Error("OPERATION_CANCELLED");
      }
      try {
        let token;
        try {
          token = await getAuthToken(false);
        } catch (authErr) {
          throw new Error("TOKEN_EXPIRED");
        }
        
        let separator = endpoint.includes('?') ? '&' : '?';
        let endpointWithDrives = endpoint + `${separator}supportsAllDrives=true`;
        const url = `https://www.googleapis.com/drive/v3${endpointWithDrives}`;
        
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        await wait(API_DELAY_MS);
        
        const response = await fetch(url, options);
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          
          if (response.status === 401 && !isRetry) {
            addLog("Renovando token de acesso do Google...", "info");
            await removeCachedToken(token);
            try {
              await getAuthToken(true);
              const retryResult = await apiRequest(endpoint, options, true);
              resolve(retryResult);
              return;
            } catch (refreshErr) {
              throw new Error("TOKEN_EXPIRED");
            }
          }
          if (response.status === 401) {
            throw new Error("TOKEN_EXPIRED");
          }
          throw new Error(`Erro API (${response.status}): ${err.error?.message || response.statusText}`);
        }
        
        const text = await response.text();
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// -------------------------------------------------------------
// Operações do Drive
// -------------------------------------------------------------
async function createFolder(name, parentId) {
  const body = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    body.parents = [parentId];
  }
  const data = await apiRequest('/files', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return data.id;
}

async function copyFile(fileId, name, parentId) {
  const body = {
    name: name,
    parents: [parentId]
  };
  const data = await apiRequest(`/files/${fileId}/copy`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return data.id;
}

async function listFiles(folderId) {
  let files = [];
  let pageToken = null;
  do {
    let query = `'${folderId}' in parents and trashed = false`;
    let endpoint = `/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,size,shortcutDetails)&pageSize=1000&includeItemsFromAllDrives=true&corpora=allDrives`;
    if (pageToken) {
      endpoint += `&pageToken=${pageToken}`;
    }
    const data = await apiRequest(endpoint);
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

// -------------------------------------------------------------
// Mapeamento Recursivo com Proteção contra Loops Circulares
// -------------------------------------------------------------
async function buildTreeRecursive(folderId, nodeName, rootFolderId, stats = { count: 0, size: 0 }, visitedFolderIds = new Set()) {
  if (visitedFolderIds.has(folderId)) {
    addLog(`Aviso: Atalho circular detectado e ignorado (${nodeName})`, "info");
    return { id: folderId, name: nodeName, isFolder: true, children: [] };
  }
  visitedFolderIds.add(folderId);

  const cacheKey = `treeCache_${rootFolderId}_${folderId}`;
  const cachedData = await new Promise(resolve => {
    chrome.storage.local.get([cacheKey], result => resolve(result[cacheKey]));
  });

  if (cachedData) {
    function updateStatsFromCache(n) {
      if (!n.isFolder) stats.size += (n.size || 0);
      stats.count++;
      if (stats.count % 50 === 0) {
        currentStatus.status = `Recuperando estrutura do cache... (${stats.count} itens)`;
        broadcastProgress();
      }
      if (n.children) {
        n.children.forEach(c => updateStatsFromCache(c));
      }
    }
    if (cachedData.children) {
      cachedData.children.forEach(c => updateStatsFromCache(c));
    }
    return cachedData;
  }

  const node = {
    id: folderId,
    name: nodeName,
    isFolder: true,
    children: []
  };

  let files = [];
  try {
    files = await listFiles(folderId);
  } catch (err) {
    if (err.message === "TOKEN_EXPIRED" || err.message === "OPERATION_CANCELLED") throw err;
    addLog(`Aviso: Pasta inacessível ignorada (${err.message})`, "error");
    return node;
  }

  for (const f of files) {
    if (isCancellationRequested) throw new Error("OPERATION_CANCELLED");
    stats.count++;
    if (stats.count % 25 === 0) {
      currentStatus.status = `Mapeando estrutura... (${stats.count} itens encontrados)`;
      broadcastProgress();
    }
    
    let isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    let targetId = f.id;
    let actualSize = f.size ? parseInt(f.size, 10) : 0;
    
    if (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails) {
      if (f.shortcutDetails.targetMimeType === 'application/vnd.google-apps.folder') {
        isFolder = true;
      }
      targetId = f.shortcutDetails.targetId;
    }

    chrome.runtime.sendMessage({ 
      action: "TREE_NODE_ADDED", 
      item: { id: targetId, name: f.name, isFolder: isFolder, parentId: folderId }
    }).catch(() => {});

    if (isFolder) {
      const subTree = await buildTreeRecursive(targetId, f.name, rootFolderId, stats, visitedFolderIds);
      node.children.push(subTree);
    } else {
      stats.size += actualSize;
      node.children.push({
        id: targetId,
        name: f.name,
        isFolder: false,
        size: actualSize
      });
    }
  }
  
  await new Promise(resolve => chrome.storage.local.set({ [cacheKey]: node }, resolve));
  return node;
}

// -------------------------------------------------------------
// Execução de Cópia Recursiva
// -------------------------------------------------------------
async function checkIfItemExists(name, parentId, isFolder) {
  try {
    const mimeQuery = isFolder ? "mimeType = 'application/vnd.google-apps.folder'" : "mimeType != 'application/vnd.google-apps.folder'";
    const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    let query = `'${parentId}' in parents and name = '${safeName}' and ${mimeQuery} and trashed = false`;
    let endpoint = `/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`;
    const data = await apiRequest(endpoint);
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  } catch (e) {
    if (e.message === "TOKEN_EXPIRED" || e.message === "OPERATION_CANCELLED") throw e;
    return null;
  }
}

async function getExistingChildren(parentId) {
  let items = [];
  let pageToken = null;
  do {
    let query = `'${parentId}' in parents and trashed = false`;
    let endpoint = `/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000`;
    if (pageToken) endpoint += `&pageToken=${pageToken}`;
    const data = await apiRequest(endpoint);
    items = items.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

async function updateLast4Items(rootFolderId, childId) {
  const cacheKey = `last4_${rootFolderId}`;
  const data = await new Promise(resolve => chrome.storage.local.get([cacheKey], resolve));
  let last4 = data[cacheKey] || [];
  last4.push(childId);
  if (last4.length > 4) last4.shift();
  await new Promise(resolve => chrome.storage.local.set({ [cacheKey]: last4 }, resolve));
}

async function executeTreeRecursive(node, destinationParentId, rootFolderId) {
  const cacheKey = `last4_${rootFolderId}`;
  const data = await new Promise(resolve => chrome.storage.local.get([cacheKey], resolve));
  const last4 = data[cacheKey] || [];

  for (const child of node.children) {
    if (isCancellationRequested) throw new Error("OPERATION_CANCELLED");
    try {
      if (child.isFolder) {
        let newFolderId = child.newId;
        
        if (newFolderId && last4.includes(child.id)) {
           const existsId = await checkIfItemExists(child.name, destinationParentId, true);
           if (!existsId) {
              newFolderId = null;
              child.newId = null;
              child.copied = false;
           } else {
              newFolderId = existsId;
              child.newId = newFolderId;
           }
        }
        
        if (newFolderId) {
          addLog(`Pasta em cache (pulando criação): ${child.name}`);
        } else {
          addLog(`Criando subpasta: ${child.name}`);
          newFolderId = await createFolder(child.name, destinationParentId);
          child.newId = newFolderId;
          child.copied = true;
          await new Promise(resolve => chrome.storage.local.set({ [`treeCache_${rootFolderId}_${node.id}`]: node }, resolve));
          await updateLast4Items(rootFolderId, child.id);
        }
        currentStatus.copied++;
        broadcastProgress();
        
        await executeTreeRecursive(child, newFolderId, rootFolderId);
      } else {
        let isCopied = child.copied;
        
        if (isCopied && last4.includes(child.id)) {
           const existsId = await checkIfItemExists(child.name, destinationParentId, false);
           if (!existsId) {
              isCopied = false;
              child.copied = false;
           }
        }

        if (isCopied) {
          addLog(`Arquivo em cache (já copiado): ${child.name}`);
        } else {
          addLog(`Copiando arquivo: ${child.name}`);
          await copyFile(child.id, child.name, destinationParentId);
          child.copied = true;
          await new Promise(resolve => chrome.storage.local.set({ [`treeCache_${rootFolderId}_${node.id}`]: node }, resolve));
          await updateLast4Items(rootFolderId, child.id);
        }
        currentStatus.copied++;
        broadcastProgress();
      }
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED" || error.message === "OPERATION_CANCELLED") throw error;
      addLog(`Falha ao copiar "${child.name}": ${error.message}`, "error");
    }
  }
}

// -------------------------------------------------------------
// Pipeline Principal de Preparação e Cópia
// -------------------------------------------------------------
async function scanAndPrepareCopy(initialFolderId, forceFresh = false, clearCopyOnly = false) {
  let scanName = "Identificando pasta...";
  currentStatus.activeScans.push(scanName);
  broadcastProgress();
  
  try {
    addLog("Buscando informações da pasta de origem...");
    const rootData = await apiRequest(`/files/${initialFolderId}?fields=name,mimeType,shortcutDetails`);
    
    let rootName = rootData.name || "Pasta Sem Nome";
    let targetFolderId = initialFolderId;
    
    const idx = currentStatus.activeScans.indexOf(scanName);
    if (idx !== -1) currentStatus.activeScans[idx] = rootName;
    scanName = rootName;
    broadcastProgress();
    
    if (rootData.mimeType === 'application/vnd.google-apps.shortcut' && rootData.shortcutDetails) {
       targetFolderId = rootData.shortcutDetails.targetId;
       addLog("Atalho identificado. Acessando pasta de destino...");
    }
    
    if (forceFresh) {
      addLog("Limpando cache de mapeamento anterior...");
      const allKeys = await new Promise(resolve => chrome.storage.local.get(null, resolve));
      const keysToRemove = Object.keys(allKeys).filter(k => k.startsWith(`treeCache_${targetFolderId}_`) || k === `last4_${targetFolderId}`);
      await new Promise(resolve => chrome.storage.local.remove(keysToRemove, resolve));
    } else if (clearCopyOnly) {
      addLog("Reiniciando flags de cópia...");
      const allKeys = await new Promise(resolve => chrome.storage.local.get(null, resolve));
      let updates = {};
      
      function clearCopyFlags(n) {
        if (n.copied !== undefined) n.copied = false;
        if (n.newId !== undefined) n.newId = null;
        if (n.children) n.children.forEach(c => clearCopyFlags(c));
      }

      Object.keys(allKeys).forEach(k => {
         if (k.startsWith(`treeCache_${targetFolderId}_`)) {
            let node = allKeys[k];
            clearCopyFlags(node);
            updates[k] = node;
         }
      });
      await new Promise(resolve => chrome.storage.local.set(updates, resolve));
      await new Promise(resolve => chrome.storage.local.remove([`last4_${targetFolderId}`], resolve));
    }
    
    addLog(`Mapeando estrutura de "${rootName}"...`);
    const stats = { count: 0, size: 0 };
    const tree = await buildTreeRecursive(targetFolderId, rootName, targetFolderId, stats, new Set());
    
    currentStatus.total += stats.count + 1;
    currentStatus.totalBytes += stats.size;
    broadcastProgress();

    return async function runBackgroundCopy() {
      try {
        if (isCancellationRequested) throw new Error("OPERATION_CANCELLED");
        addLog(`Verificando pasta principal "${rootName}" no Meu Drive...`);
        const existingRoots = await getExistingChildren("root");
        let newRootFolderId = null;
        
        for (const item of existingRoots) {
          if (item.name === rootName && item.mimeType === 'application/vnd.google-apps.folder') {
            newRootFolderId = item.id;
            break;
          }
        }

        if (newRootFolderId) {
          addLog(`Pasta principal já existente encontrada: "${rootName}"`);
        } else {
          addLog(`Criando pasta "${rootName}" no Meu Drive...`);
          newRootFolderId = await createFolder(rootName);
        }
        
        currentStatus.copied++;
        broadcastProgress();

        addLog(`Iniciando cópia dos arquivos de "${rootName}"...`);
        await executeTreeRecursive(tree, newRootFolderId, targetFolderId);
        
        addLog(`✅ Sucesso! Cópia de "${rootName}" concluída!`, "info");
        addLog(`🔗 Acessar no Drive: https://drive.google.com/drive/folders/${newRootFolderId}`, "info");
        
        // Limpa cache concluído
        const allKeys = await new Promise(resolve => chrome.storage.local.get(null, resolve));
        const keysToRemove = Object.keys(allKeys).filter(k => k.startsWith(`treeCache_${targetFolderId}_`) || k === `last4_${targetFolderId}`);
        await new Promise(resolve => chrome.storage.local.remove(keysToRemove, resolve));
      } catch (error) {
        if (error.message === "OPERATION_CANCELLED") {
          addLog("Operação cancelada pelo usuário.", "info");
        } else if (error.message === "TOKEN_EXPIRED") {
          addLog("Sessão expirada. Por favor, conecte-se novamente.", "error");
        } else {
          addLog(`Erro na cópia de "${rootName}": ${error.message}`, "error");
        }
      }
    };
    
  } catch (error) {
    if (error.message === "OPERATION_CANCELLED") {
      addLog("Operação cancelada pelo usuário.", "info");
    } else if (error.message === "TOKEN_EXPIRED") {
      addLog("Sessão expirada. Por favor, conecte-se novamente.", "error");
    } else {
      addLog(`Erro ao analisar pasta: ${error.message}`, "error");
    }
    throw error;
  } finally {
    const index = currentStatus.activeScans.indexOf(scanName);
    if (index > -1) {
      currentStatus.activeScans.splice(index, 1);
      broadcastProgress();
    }
  }
}

// -------------------------------------------------------------
// Message Listener
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_COPY") {
    isCancellationRequested = false;
    if (activeProcesses === 0) {
      currentStatus = { 
        status: "Iniciando processamento...", 
        copied: 0, 
        total: 0, 
        totalBytes: 0, 
        logs: [], 
        startTime: Date.now(), 
        activeScans: [] 
      };
    }
    
    addLog(`Fila iniciada com ${message.folderIds.length} pasta(s)...`, "info");
    updateKeepAlive();
    
    (async () => {
      for (const id of message.folderIds) {
        if (isCancellationRequested) break;
        activeProcesses++;
        updateKeepAlive();
        try {
          const runCopyTask = await scanAndPrepareCopy(id, message.forceFresh, message.clearCopyOnly);
          
          runCopyTask().finally(() => {
            activeProcesses--;
            updateKeepAlive();
            if (activeProcesses === 0) {
              addLog("🎉 TODAS AS PASTAS FORAM COPIADAS COM SUCESSO!", "info");
              currentStatus.startTime = null;
              broadcastProgress();
            }
          });
        } catch (err) {
          activeProcesses--;
          updateKeepAlive();
          if (activeProcesses === 0) {
            currentStatus.startTime = null;
            broadcastProgress();
          }
        }
      }
    })();
    sendResponse({ success: true });
  } 
  else if (message.action === "CANCEL_COPY") {
    isCancellationRequested = true;
    activeProcesses = 0;
    updateKeepAlive();
    currentStatus.status = "Cópia cancelada.";
    addLog("⏹️ Processo cancelado pelo usuário.", "error");
    broadcastProgress();
    sendResponse({ success: true });
  }
  else if (message.action === "GET_STATUS") {
    sendResponse(currentStatus);
  }
  else if (message.action === "GET_AUTH_STATE") {
    getAuthToken(false)
      .then(token => sendResponse({ authenticated: !!token }))
      .catch(() => sendResponse({ authenticated: false }));
    return true;
  }
  else if (message.action === "LOGOUT") {
    chrome.storage.local.get(['authToken'], (res) => {
      removeCachedToken(res.authToken).then(() => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  return true;
});
