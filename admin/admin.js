/**
 * PointLab 記事管理 - GitHub API 版
 * サーバーサイド不要・クライアントのみで動作
 */

const GITHUB_API = "https://api.github.com";
const CONFIG_KEY = "pointlab_admin_config";
const AUTH_TOKEN_KEY = "pointlab_admin_token";
const IMGUR_API = "https://api.imgur.com/3/image";

// DOM
const configSection = document.getElementById("configSection");
const mainSection = document.getElementById("mainSection");
const articleList = document.getElementById("articleList");
const articleListStatus = document.getElementById("articleListStatus");
const editorPlaceholder = document.getElementById("editorPlaceholder");
const editorPanel = document.getElementById("editorPanel");
const editorTitle = document.getElementById("editorTitle");
const editorPath = document.getElementById("editorPath");
const articleContent = document.getElementById("articleContent");
const saveStatus = document.getElementById("saveStatus");
const btnPreview = document.getElementById("btnPreview");
const toast = document.getElementById("toast");

// State
let config = null;
let currentFile = null;
let currentSha = null;

/**
 * Config
 */
function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      config = JSON.parse(raw);
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
}

function saveConfig() {
  const owner = document.getElementById("configOwner").value.trim();
  const repo = document.getElementById("configRepo").value.trim();
  const branch = document.getElementById("configBranch").value.trim() || "main";
  const basePath = document.getElementById("configBasePath").value.trim();
  const token = document.getElementById("configToken").value.trim();
  const imgurClientId = document.getElementById("configImgurClientId").value.trim();

  if (!owner || !repo || !token) {
    showToast("GitHubユーザー名・リポジトリ・トークンを入力してください", "error");
    return;
  }

  config = { owner, repo, branch, basePath, token, imgurClientId };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  showToast("設定を保存しました", "success");
  init();
}

function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
  config = null;
  document.getElementById("configOwner").value = "";
  document.getElementById("configRepo").value = "";
  document.getElementById("configBranch").value = "main";
  document.getElementById("configBasePath").value = "";
  document.getElementById("configToken").value = "";
  document.getElementById("configImgurClientId").value = "";
  mainSection.hidden = true;
  showToast("設定をクリアしました", "success");
}

function fillConfigForm() {
  if (!config) return;
  document.getElementById("configOwner").value = config.owner || "";
  document.getElementById("configRepo").value = config.repo || "";
  document.getElementById("configBranch").value = config.branch || "main";
  document.getElementById("configBasePath").value = config.basePath || "";
  document.getElementById("configToken").value = config.token ? "********" : "";
  document.getElementById("configImgurClientId").value = config.imgurClientId || "";
}

/**
 * GitHub API
 */
function getAuthHeader() {
  if (!config?.token) return {};
  const t = config.token;
  if (t === "********") return {}; // マスクされた値は使えない
  return {
    Authorization: t.startsWith("ghp_") ? `token ${t}` : `Bearer ${t}`,
  };
}

async function fetchApi(path, options = {}) {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github.v3+json",
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 記事一覧取得
 */
async function loadArticles() {
  articleList.innerHTML = "";
  articleListStatus.textContent = "";

  if (!config) {
    articleListStatus.textContent = "上の「設定を保存」を実行してください";
    articleListStatus.className = "status-text error";
    return;
  }

  articleListStatus.textContent = "読み込み中...";
  articleListStatus.className = "status-text";

  try {
    const path = config.basePath
      ? `${config.basePath}/articles`
      : "articles";
    const data = await fetchApi(
      `/repos/${config.owner}/${config.repo}/contents/${path}`,
      {}
    );

    if (!Array.isArray(data)) {
      throw new Error("articles フォルダを取得できませんでした");
    }

    const files = data
      .filter((f) => f.type === "file" && f.name.endsWith(".html"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (files.length === 0) {
      articleListStatus.textContent = "記事がありません";
      return;
    }

    articleListStatus.textContent = `${files.length} 件の記事`;
    articleListStatus.className = "status-text success";

    files.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "article-item";
      btn.dataset.path = f.path;
      btn.dataset.name = f.name;
      btn.innerHTML = `<span>${f.name}</span>`;
      btn.addEventListener("click", () => selectArticle(f.path, f.name));
      articleList.appendChild(btn);
    });
  } catch (e) {
    articleListStatus.textContent = `エラー: ${e.message}`;
    articleListStatus.className = "status-text error";
    showToast(e.message, "error");
  }
}

/**
 * 記事選択・読み込み
 */
async function selectArticle(path, name) {
  document.querySelectorAll(".article-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.path === path);
  });

  editorPlaceholder.hidden = true;
  editorPanel.hidden = false;
  editorTitle.textContent = name;
  editorPath.textContent = path;
  saveStatus.textContent = "";
  articleContent.value = "";

  currentFile = { path, name };
  currentSha = null;

  try {
    const data = await fetchApi(
      `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`
    );
    const content = atob(data.content.replace(/\n/g, ""));
    currentSha = data.sha;
    articleContent.value = content;

    const baseUrl = "https://pointlab.vercel.app";
    const filename = path.split("/").pop();
    btnPreview.href = `${baseUrl}/articles/${filename}`;
  } catch (e) {
    saveStatus.textContent = `読み込みエラー: ${e.message}`;
    saveStatus.className = "status-text error";
  }
}

/**
 * 保存
 */
async function saveArticle() {
  if (!currentFile || !currentSha) {
    showToast("記事を選択してください", "error");
    return;
  }

  saveStatus.textContent = "保存中...";
  saveStatus.className = "status-text";

  try {
    const content = articleContent.value;
    const encoded = btoa(
      unescape(encodeURIComponent(content))
    );

    await fetchApi(
      `/repos/${config.owner}/${config.repo}/contents/${currentFile.path}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Update: ${currentFile.name}`,
          content: encoded,
          sha: currentSha,
          branch: config.branch,
        }),
      }
    );

    currentSha = null;
    saveStatus.textContent = "保存しました。Vercelで自動デプロイされます。";
    saveStatus.className = "status-text success";
    showToast("保存しました", "success");

    await loadArticles();
  } catch (e) {
    saveStatus.textContent = `エラー: ${e.message}`;
    saveStatus.className = "status-text error";
    showToast(e.message, "error");
  }
}

/**
 * Toast
 */
function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast ${type} visible`;
  toast.setAttribute("aria-label", message);
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}

/**
 * Gate (パスワード認証)
 */
function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = atob(token);
    const [, expiry] = payload.split(":");
    return Date.now() < parseInt(expiry, 10);
  } catch (e) {
    return false;
  }
}

function needsAuth() {
  // 常にパスワード認証を必須にする（セキュリティのため）
  return true;
}

async function checkAuth() {
  const gateSection = document.getElementById("gateSection");
  const adminContent = document.getElementById("adminContent");
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);

  if (!needsAuth()) {
    gateSection.hidden = true;
    gateSection.style.display = "none";
    adminContent.hidden = false;
    adminContent.style.display = "";
    initAdmin();
    return;
  }

  if (isTokenValid(token)) {
    gateSection.hidden = true;
    gateSection.style.display = "none";
    adminContent.hidden = false;
    adminContent.style.display = "";
    initAdmin();
    return;
  }

  // 未ログイン: ログイン画面のみ表示
  gateSection.hidden = false;
  gateSection.style.display = "";
  adminContent.hidden = true;
  adminContent.style.display = "none";
}

async function doLogin(password) {
  const errEl = document.getElementById("gateError");
  try {
    const base = window.location.origin;
    const res = await fetch(`${base}/api/admin-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok && data.token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
      const gate = document.getElementById("gateSection");
      const admin = document.getElementById("adminContent");
      gate.hidden = true;
      gate.style.display = "none";
      admin.hidden = false;
      admin.style.display = "";
      errEl.hidden = true;
      initAdmin();
      return true;
    }
    errEl.textContent = data.error || `ログインに失敗しました (HTTP ${res.status})`;
  } catch (err) {
    errEl.textContent = "通信エラーです。ネットワークを確認し、しばらくしてからお試しください。";
  }
  errEl.hidden = false;
  return false;
}

document.getElementById("gateForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("gatePassword");
  await doLogin(input.value.trim());
});

/**
 * Imgur アップロード
 */
async function uploadToImgur(file) {
  const clientId = config?.imgurClientId;
  if (!clientId || clientId === "********") {
    showToast("Imgur Client ID を設定してください", "error");
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      if (!base64) {
        resolve(null);
        return;
      }

      const statusEl = document.getElementById("uploadStatus");
      statusEl.textContent = "アップロード中...";
      statusEl.className = "upload-status";

      try {
        const form = new URLSearchParams();
        form.append("image", base64);
        form.append("type", "base64");
        const res = await fetch(IMGUR_API, {
          method: "POST",
          headers: {
            Authorization: `Client-ID ${clientId}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        const data = await res.json();

        if (data.success && data.data?.link) {
          statusEl.textContent = "アップロード完了";
          statusEl.className = "upload-status success";
          resolve(data.data.link);
        } else {
          statusEl.textContent = data.data?.error || "アップロード失敗";
          statusEl.className = "upload-status error";
          resolve(null);
        }
      } catch (e) {
        statusEl.textContent = "エラー: " + e.message;
        statusEl.className = "upload-status error";
        resolve(null);
      }
    };
    reader.readAsDataURL(file);
  });
}

function insertImageUrl(url) {
  const textarea = articleContent;
  const imgTag = `<img src="${url}" alt="" />`;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + imgTag + after;
  textarea.selectionStart = textarea.selectionEnd = start + imgTag.length;
  textarea.focus();
}

/**
 * Init
 */
function initAdmin() {
  if (loadConfig()) {
    fillConfigForm();
    if (config.token && config.token !== "********") {
      mainSection.hidden = false;
      loadArticles();
    } else {
      mainSection.hidden = true;
      document.getElementById("configToken").placeholder = "トークンを再入力して保存";
    }
  } else {
    mainSection.hidden = true;
  }
}

function init() {
  checkAuth();
}

document.getElementById("btnSaveConfig").addEventListener("click", saveConfig);
document.getElementById("btnClearConfig").addEventListener("click", clearConfig);
document.getElementById("btnRefresh").addEventListener("click", () => loadArticles());
document.getElementById("btnSave").addEventListener("click", saveArticle);
document.getElementById("btnLogout")?.addEventListener("click", () => {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  location.reload();
});

document.getElementById("uploadInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = await uploadToImgur(file);
  if (url) {
    insertImageUrl(url);
    showToast("画像を挿入しました", "success");
  }
  e.target.value = "";
});

init();
