/**
 * PointLab 記事管理
 * パスワードのみでログイン。GitHub Token は Vercel 環境変数 ADMIN_GITHUB_TOKEN で設定。
 */

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

function getAdminToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function getAdminHeaders() {
  const token = getAdminToken();
  return token ? { "X-Admin-Token": token } : {};
}

async function fetchAdminApi(path, options = {}) {
  const base = window.location.origin;
  const { headers: optHeaders, ...rest } = options;
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
      ...optHeaders,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

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
  config = { imgurClientId: "" };
  return false;
}

function saveConfig() {
  const imgurClientId = document.getElementById("configImgurClientId")?.value?.trim() || "";
  config = { ...config, imgurClientId };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config || {}));
  showToast("設定を保存しました", "success");
}

function fillConfigForm() {
  if (!config) return;
  const imgurEl = document.getElementById("configImgurClientId");
  if (imgurEl) imgurEl.value = config.imgurClientId || "";
}

async function loadArticles() {
  articleList.innerHTML = "";
  articleListStatus.textContent = "";
  articleListStatus.textContent = "読み込み中...";
  articleListStatus.className = "status-text";

  try {
    const data = await fetchAdminApi("/api/admin/articles");
    if (!Array.isArray(data)) {
      throw new Error("記事一覧を取得できませんでした");
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
    const data = await fetchAdminApi(`/api/admin/article?path=${encodeURIComponent(path)}`);
    const content = atob(data.content.replace(/\n/g, ""));
    currentSha = data.sha;
    articleContent.value = content;

    const baseUrl = window.location.origin;
    const filename = path.split("/").pop();
    btnPreview.href = `${baseUrl}/articles/${filename}`;
  } catch (e) {
    saveStatus.textContent = `読み込みエラー: ${e.message}`;
    saveStatus.className = "status-text error";
  }
}

async function saveArticle() {
  if (!currentFile || !currentSha) {
    showToast("記事を選択してください", "error");
    return;
  }

  saveStatus.textContent = "保存中...";
  saveStatus.className = "status-text";

  try {
    const content = articleContent.value;
    await fetchAdminApi("/api/admin/article", {
      method: "PUT",
      body: JSON.stringify({
        path: currentFile.path,
        content,
        sha: currentSha,
        message: `Update: ${currentFile.name}`,
      }),
    });

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

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast ${type} visible`;
  toast.setAttribute("aria-label", message);
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}

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

async function uploadToImgur(file) {
  const clientId = config?.imgurClientId;
  if (!clientId || clientId === "********") {
    showToast("Imgur Client ID を設定してください（設定→Imgur）", "error");
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

function initAdmin() {
  loadConfig();
  fillConfigForm();
  mainSection.hidden = false;
  loadArticles();
}

function init() {
  checkAuth();
}

document.getElementById("btnSaveConfig")?.addEventListener("click", saveConfig);
document.getElementById("btnRefresh")?.addEventListener("click", () => loadArticles());
document.getElementById("btnSave")?.addEventListener("click", saveArticle);
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
