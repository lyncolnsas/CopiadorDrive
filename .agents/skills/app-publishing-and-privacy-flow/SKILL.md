---
name: app-publishing-and-privacy-flow
description: >-
  Guia e fluxo completo e automatizado para deploy, publicação na Chrome Web Store / App Stores,
  criação de landing page (index.html), política de privacidade pública (privacy.html), hospedagem
  no GitHub Pages, configuração de OAuth2/Google Cloud Console, geração de assets gráficos da loja
  e criação da Central Unificada de Publicação com botões copia-e-cola.
---

# Fluxo de Publicação de Extensões, Web Apps e Deploy com GitHub Pages

Esta Skill define o procedimento padrão de ponta a ponta para preparar, empacotar e publicar qualquer extensão do Chrome ou aplicativo web, incluindo hospedagem de políticas de privacidade, landing page, configuração OAuth no Google Cloud e criação da central de deploy com botões copia-e-cola.

---

## 📑 Etapas do Fluxo de Publicação

```
[1. GitHub & Pages] ──> [2. OAuth & Google Cloud] ──> [3. Manifest & Zip] ──> [4. Assets Gráficos] ──> [5. Central Unificada]
  • privacy.html          • Branding (URLs/Domínios)    • oauth2 client_id       • 128x128 Ícone         • CENTRAL_PUBLICACAO.html
  • index.html            • Público Externo             • Limpeza de "key"       • 1280x800 Print        • Botões 1-Clique Copiar
  • .nojekyll             • Escopos da API              • Empacotamento limpo    • 440x280 e 1400x560    • Checklist Interativo
  • Deploy Pages          • Item ID de 32 letras
```

---

## 1️⃣ Fase 1: Política de Privacidade e Landing Page no GitHub Pages

Toda publicação na Chrome Web Store e serviços Google OAuth **exige** uma Política de Privacidade pública hospedada e uma página inicial válida.

### 1.1 Criar a Política de Privacidade (`privacy.html`)
- Crie o arquivo `privacy.html` na raiz do projeto.
- O documento deve declarar expressamente:
  1. Que a extensão/app não vende dados a terceiros nem os utiliza para publicidade direcionada.
  2. As permissões e escopos utilizados (ex: `storage`, `identity`, `Google Drive API`).
  3. Que toda autenticação é direta e server-side / local, sem envio para servidores intermediários.
  4. Dados de contato do desenvolvedor.

### 1.2 Criar a Landing Page (`index.html`)
- Crie um arquivo `index.html` moderno na raiz do repositório para evitar erro **404** na URL raiz do GitHub Pages (`https://<usuario>.github.io/<repositorio>/`).
- Inclua:
  - Título atraente, badges e botões de chamada ("Instalar na Chrome Web Store", "Ver no GitHub").
  - Grade de recursos principais do aplicativo.
  - Link de rodapé para a `privacy.html`.

### 1.3 Ativar e Publicar no GitHub Pages
1. Adicione o arquivo `.nojekyll` na raiz para garantir que arquivos e assets sejam servidos estaticamente sem processamento Jekyll.
2. Faça commit e push para o branch principal (`master` ou `main`).
3. Ative o GitHub Pages usando a CLI do GitHub:
   ```bash
   gh api -X POST repos/<usuario>/<repositorio>/pages -f source='{"branch":"master","path":"/"}'
   ```
4. Verifique programaticamente se as URLs respondem com **HTTP 200 OK**:
   - `https://<usuario>.github.io/<repositorio>/privacy.html`
   - `https://<usuario>.github.io/<repositorio>/`

---

## 2️⃣ Fase 2: Configuração do OAuth no Google Cloud ("Google Auth Platform")

Ao configurar projetos com login do Google ou APIs do Google Workspace/Drive, siga a navegação na nova interface:

### 2.1 Navegação no Menu Google Auth Platform
1. **`Branding` (Marca / Consentimento):**
   - **Nome do app:** Nome comercial do produto (ex: `Copiador de Drive`).
   - **E-mail de suporte:** E-mail do desenvolvedor.
   - **Página inicial do app:** `https://<usuario>.github.io/<repositorio>/`
   - **Link da Política de Privacidade:** `https://<usuario>.github.io/<repositorio>/privacy.html`
   - **Domínios autorizados:**
     - `chromiumapp.org`
     - `<usuario>.github.io` *(⚠️ IMPORTANTE: Sempre use o subdomínio completo do usuário. O Google rejeita `github.io` puro por ser um domínio público compartilhado)*.
2. **`Público-alvo`:**
   - Configure o tipo de usuário como **Externo**.
3. **`Acesso a dados` (Escopos):**
   - Clique em **"Adicionar ou remover escopos"**.
   - Role até o final da janela lateral direita em *"Adicionar escopos manualmente"* ou filtre pelos escopos mínimos necessários (ex: `https://www.googleapis.com/auth/drive.readonly`, `https://www.googleapis.com/auth/drive.file`).
   - Clique em **Atualizar**.
4. **`Clientes` (Client ID OAuth):**
   - Clique em **"+ CRIAR CLIENTE"**.
   - **Tipo de aplicativo:** Selecione **Extensão do Chrome**.
   - **ID do item:** Cole o ID oficial de 32 letras obtido no rascunho da Chrome Web Store.
   - Copie o **Client ID** gerado (`<id>.apps.googleusercontent.com`).

---

## 3️⃣ Fase 3: Modernização do Manifest V3 e Empacotamento

### 3.1 Ajustes Obrigatórios no `manifest.json`
- **NUNCA** inclua a chave `"key"` no `manifest.json` ao enviar para a Chrome Web Store (a loja rejeita manifests contendo `"key"`).
- Insira o Client ID gerado na seção `oauth2`:
  ```json
  "oauth2": {
    "client_id": "SEU_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file"
    ]
  }
  ```

### 3.2 Empacotamento Limpo do `.zip`
Crie um script para gerar o `.zip` contendo **apenas** os arquivos de execução da extensão, excluindo arquivos de desenvolvimento, pastas de assets brutos e documentos de suporte:
```python
import os, zipfile

files = [
    'manifest.json',
    'background.js',
    'popup.html',
    'popup.css',
    'popup.js',
    'tab.html',
    'tab.js',
    'content.js',
    'content.css',
]
with zipfile.ZipFile('AppPackage.zip', 'w', zipfile.ZIP_DEFLATED) as z:
  for f in files:
    if os.path.exists(f):
      z.write(f, f)
  for root, dirs, f_list in os.walk('icons'):
    for file in f_list:
      p = os.path.join(root, file)
      z.write(p, p)
```

---

## 4️⃣ Fase 4: Recursos Gráficos Promocionais (Store Assets)

Gere todos os assets nas dimensões exigidas pela Chrome Web Store na pasta `preenchimento loja/store_assets/`:

1. **Ícone da Loja (128x128 px):** PNG 24-bit (pode ter fundo transparente).
2. **Screenshots (1280x800 px):** PNG sem transparência (JPEG/24-bit PNG). Demonstra o aplicativo em uso real.
3. **Mosaico Promocional Pequeno (440x280 px):** PNG sem canal alpha. Usado em vitrines da loja.
4. **Banner Promocional Principal (1400x560 px):** PNG sem canal alpha. Banner de destaque no topo.

---

## 5️⃣ Fase 5: Central Unificada de Publicação (`CENTRAL_PUBLICACAO.html`)

Para proporcionar uma experiência premium e sem atrito para o usuário, crie **um único arquivo HTML mestre** (`CENTRAL_PUBLICACAO.html`) na pasta `preenchimento loja/`.

### Estrutura do Dashboard Unificado:
O arquivo deve conter **4 abas com alternância instantânea**:
1. **Aba 1 (Guia Passo a Passo):** Checklist com barra de progresso dinâmica, instruções passo a passo com badges de cópia rápida para URLs, e-mails, escopos e comandos.
2. **Aba 2 (Detalhes da Loja):** Botões copia-e-cola com 1 clique para:
   - Título do pacote (máx 75 caracteres).
   - Resumo do pacote (máx 132 caracteres).
   - Descrição formatada com emojis e seções (máx 16.000 caracteres).
   - Categoria e Idioma.
   - Galeria com preview dos assets gráficos prontos.
3. **Aba 3 (Respostas de Privacidade):**
   - Campo "Único Propósito" (Single Purpose).
   - Justificativa técnica individual para cada permissão declarada no `manifest.json`.
   - Tabela visual de checkboxes de uso de dados (todas marcadas ou desmarcadas conforme o caso).
   - Declaração de conformidade.
4. **Aba 4 (Links & Arquivos):**
   - Links diretos para Chrome Web Store Developer Console, Google Cloud Console, Landing Page e Política de Privacidade.
   - Caminho local do arquivo `.zip` pronto para upload.

---

## 💡 Checklist de Verificação Final

- [ ] `privacy.html` e `index.html` respondem com HTTP 200 OK no GitHub Pages.
- [ ] O domínio `<usuario>.github.io` e `chromiumapp.org` estão autorizados no Google Cloud.
- [ ] O ID de 32 letras da Chrome Web Store foi vinculado ao Client ID OAuth.
- [ ] O `manifest.json` possui o `client_id` correto e não possui a propriedade `"key"`.
- [ ] O arquivo `.zip` contém apenas arquivos de runtime.
- [ ] O arquivo `CENTRAL_PUBLICACAO.html` possui botões de 1 clique funcionais com feedback visual (`Copiado! ✓`).
