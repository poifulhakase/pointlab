// ============================================
// ぽいロボ - メインスクリプト
// ============================================

const THEME_STORAGE_KEY = "poirobo_theme";

// ============================================
// 初期化
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  initTheme();
  initSettingsModal();
  initThemeToggle();
});

// ============================================
// テーマ初期化
// ============================================
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    document.documentElement.classList.add("dark-mode");
    document.documentElement.classList.remove("light-mode");
  } else {
    document.body.classList.remove("dark-mode");
    document.documentElement.classList.remove("dark-mode");
    document.documentElement.classList.add("light-mode");
  }
  
  updateThemeButton();
}

// ============================================
// テーマボタン更新
// ============================================
function updateThemeButton() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;
  
  const themeIcon = themeToggle.querySelector(".theme-icon");
  const themeText = themeToggle.querySelector(".theme-text");
  
  const isDark = document.body.classList.contains("dark-mode");
  
  if (themeIcon) themeIcon.textContent = isDark ? "🌙" : "☀️";
  if (themeText) themeText.textContent = isDark ? "ダークモード" : "ライトモード";
}

// ============================================
// テーマ切り替え
// ============================================
function toggleTheme() {
  const isDark = document.body.classList.contains("dark-mode");
  
  if (isDark) {
    document.body.classList.remove("dark-mode");
    document.documentElement.classList.remove("dark-mode");
    document.documentElement.classList.add("light-mode");
    localStorage.setItem(THEME_STORAGE_KEY, "light");
  } else {
    document.body.classList.add("dark-mode");
    document.documentElement.classList.add("dark-mode");
    document.documentElement.classList.remove("light-mode");
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
  }
  
  updateThemeButton();
}

// ============================================
// テーマトグル初期化
// ============================================
function initThemeToggle() {
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;
  
  themeToggle.addEventListener("click", toggleTheme);
}

// ============================================
// 設定モーダル
// ============================================
function initSettingsModal() {
  const settingsButton = document.getElementById("settingsButton");
  const settingsModal = document.getElementById("settingsModal");
  const settingsClose = document.getElementById("settingsClose");
  const modalOverlay = settingsModal ? settingsModal.querySelector(".modal__overlay") : null;
  
  if (!settingsButton || !settingsModal) return;
  
  // 設定ボタンクリック
  settingsButton.addEventListener("click", function () {
    settingsModal.classList.remove("hidden");
    history.pushState({ modal: "settings" }, "");
  });
  
  // 閉じるボタンクリック
  if (settingsClose) {
    settingsClose.addEventListener("click", closeSettingsModal);
  }
  
  // オーバーレイクリック
  if (modalOverlay) {
    modalOverlay.addEventListener("click", closeSettingsModal);
  }
  
  // ブラウザの戻るボタン対応
  window.addEventListener("popstate", function (e) {
    if (!settingsModal.classList.contains("hidden")) {
      settingsModal.classList.add("hidden");
    }
  });
}

function closeSettingsModal() {
  const settingsModal = document.getElementById("settingsModal");
  if (settingsModal && !settingsModal.classList.contains("hidden")) {
    settingsModal.classList.add("hidden");
    if (history.state && history.state.modal === "settings") {
      history.back();
    }
  }
}
