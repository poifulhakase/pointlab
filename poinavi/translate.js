// ============================================
// ぽいナビ 翻訳ページ - メインスクリプト（ダミー版）
// ============================================

// ============================================
// テーマ管理
// ============================================
function initTheme() {
  // 保存されたテーマを読み込み
  const savedTheme = localStorage.getItem("poinavi_theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
  } else {
    document.body.classList.add("light-mode");
    document.body.classList.remove("dark-mode");
  }
}

// ============================================
// ダミー翻訳結果
// ============================================
const DUMMY_VOICE_TRANSLATIONS = [
  {
    original: "Excuse me, where is the nearest station?",
    translated: "すみません、一番近い駅はどこですか？",
    lang: "英語 → 日本語"
  },
  {
    original: "How much is this?",
    translated: "これはいくらですか？",
    lang: "英語 → 日本語"
  },
  {
    original: "Could you take a picture of us?",
    translated: "写真を撮っていただけますか？",
    lang: "英語 → 日本語"
  },
  {
    original: "I'd like to order this, please.",
    translated: "これを注文したいのですが。",
    lang: "英語 → 日本語"
  },
  {
    original: "Where is the restroom?",
    translated: "お手洗いはどこですか？",
    lang: "英語 → 日本語"
  }
];

const DUMMY_OCR_TRANSLATIONS = [
  {
    original: "本日のおすすめ\n・海鮮丼 ¥1,200\n・天ぷら定食 ¥980\n・刺身盛り合わせ ¥1,500",
    translated: "Today's Recommendations\n- Seafood Rice Bowl ¥1,200\n- Tempura Set Meal ¥980\n- Assorted Sashimi ¥1,500",
    lang: "日本語 → 英語"
  },
  {
    original: "営業時間\n11:00 - 22:00\n定休日：水曜日",
    translated: "Business Hours\n11:00 AM - 10:00 PM\nClosed: Wednesdays",
    lang: "日本語 → 英語"
  },
  {
    original: "ラーメン\n・醤油ラーメン ¥850\n・味噌ラーメン ¥900\n・塩ラーメン ¥850\n・チャーシューメン ¥1,100",
    translated: "Ramen\n- Soy Sauce Ramen ¥850\n- Miso Ramen ¥900\n- Salt Ramen ¥850\n- Char Siu Ramen ¥1,100",
    lang: "日本語 → 英語"
  }
];

// 翻訳結果カウンター
let voiceTranslationCount = 0;
let ocrTranslationCount = 0;

// 現在の言語設定
let sourceLang = localStorage.getItem("poinavi_source_lang") || "en";
let targetLang = localStorage.getItem("poinavi_target_lang") || "ja";

// ============================================
// 初期化
// ============================================
document.addEventListener("DOMContentLoaded", function() {
  initTheme();
  initVoiceTranslation();
  initCameraTranslation();
  initSettingsModal();
  initDisclaimerModal();
  initThemeToggle();
  initLanguageSelect();
});

// ============================================
// 設定モーダル
// ============================================
function initSettingsModal() {
  const modal = document.getElementById("translateSettingsModal");
  const openBtn = document.getElementById("translateSettingsButton");
  const closeBtn = document.getElementById("translateSettingsClose");
  const overlay = modal?.querySelector(".translate-modal__overlay");

  if (!modal || !openBtn || !closeBtn) return;

  openBtn.addEventListener("click", function() {
    modal.classList.remove("hidden");
  });

  closeBtn.addEventListener("click", function() {
    modal.classList.add("hidden");
  });

  if (overlay) {
    overlay.addEventListener("click", function() {
      modal.classList.add("hidden");
    });
  }
}

// ============================================
// 免責事項モーダル
// ============================================
function initDisclaimerModal() {
  const modal = document.getElementById("translateDisclaimerModal");
  const openBtn = document.getElementById("disclaimerButton");
  const closeBtn = document.getElementById("translateDisclaimerClose");
  const overlay = modal?.querySelector(".translate-modal__overlay");

  if (!modal || !openBtn || !closeBtn) return;

  openBtn.addEventListener("click", function() {
    modal.classList.remove("hidden");
  });

  closeBtn.addEventListener("click", function() {
    modal.classList.add("hidden");
  });

  if (overlay) {
    overlay.addEventListener("click", function() {
      modal.classList.add("hidden");
    });
  }
}

// ============================================
// テーマ切り替え
// ============================================
function initThemeToggle() {
  const themeToggle = document.getElementById("translateThemeToggle");
  if (!themeToggle) return;

  updateThemeButton();

  themeToggle.addEventListener("click", function() {
    const isDark = document.body.classList.contains("dark-mode");
    if (isDark) {
      document.body.classList.remove("dark-mode");
      document.body.classList.add("light-mode");
      localStorage.setItem("poinavi_theme", "light");
    } else {
      document.body.classList.remove("light-mode");
      document.body.classList.add("dark-mode");
      localStorage.setItem("poinavi_theme", "dark");
    }
    updateThemeButton();
  });
}

function updateThemeButton() {
  const themeToggle = document.getElementById("translateThemeToggle");
  if (!themeToggle) return;

  const isDark = document.body.classList.contains("dark-mode");
  const icon = themeToggle.querySelector(".theme-icon");
  const text = themeToggle.querySelector(".theme-text");

  if (icon) icon.textContent = isDark ? "☀️" : "🌙";
  if (text) text.textContent = isDark ? "ライトモード" : "ダークモード";
}

// ============================================
// 言語選択
// ============================================
function initLanguageSelect() {
  const sourceSelect = document.getElementById("translateSourceLang");
  const targetSelect = document.getElementById("translateTargetLang");
  
  if (!sourceSelect || !targetSelect) return;

  // 保存された言語を復元
  sourceSelect.value = sourceLang;
  targetSelect.value = targetLang;
  
  // 初期状態で同一言語を無効化
  updateDisabledOptions();

  // 翻訳前言語の変更
  sourceSelect.addEventListener("change", function() {
    sourceLang = this.value;
    localStorage.setItem("poinavi_source_lang", sourceLang);
    
    // 同一言語が選ばれていたら翻訳後を変更
    if (sourceLang === targetLang) {
      // 別の言語を自動選択
      const availableLangs = ["en", "ja", "zh", "ko"].filter(l => l !== sourceLang);
      targetLang = availableLangs[0];
      targetSelect.value = targetLang;
      localStorage.setItem("poinavi_target_lang", targetLang);
    }
    updateDisabledOptions();
  });

  // 翻訳後言語の変更
  targetSelect.addEventListener("change", function() {
    targetLang = this.value;
    localStorage.setItem("poinavi_target_lang", targetLang);
    
    // 同一言語が選ばれていたら翻訳前を変更
    if (sourceLang === targetLang) {
      // 別の言語を自動選択
      const availableLangs = ["en", "ja", "zh", "ko"].filter(l => l !== targetLang);
      sourceLang = availableLangs[0];
      sourceSelect.value = sourceLang;
      localStorage.setItem("poinavi_source_lang", sourceLang);
    }
    updateDisabledOptions();
  });
}

// 同一言語のオプションを無効化
function updateDisabledOptions() {
  const sourceSelect = document.getElementById("translateSourceLang");
  const targetSelect = document.getElementById("translateTargetLang");
  
  if (!sourceSelect || !targetSelect) return;
  
  // 翻訳後の選択肢で翻訳前と同じ言語を無効化
  Array.from(targetSelect.options).forEach(option => {
    option.disabled = option.value === sourceLang;
  });
  
  // 翻訳前の選択肢で翻訳後と同じ言語を無効化
  Array.from(sourceSelect.options).forEach(option => {
    option.disabled = option.value === targetLang;
  });
}

// 言語コードから表示名を取得
function getLangName(code) {
  const names = {
    "en": "英語",
    "ja": "日本語",
    "zh": "中国語",
    "ko": "韓国語"
  };
  return names[code] || code;
}

// 言語設定から表示テキストを取得
function getLanguageLabel() {
  return `${getLangName(sourceLang)} → ${getLangName(targetLang)}`;
}

// ============================================
// 音声翻訳の初期化
// ============================================
function initVoiceTranslation() {
  const voiceBtn = document.getElementById("voiceTranslateBtn");
  
  if (!voiceBtn) return;
  
  voiceBtn.addEventListener("click", function() {
    // ボタンをアクティブ状態に
    voiceBtn.classList.add("active");
    
    // 1.5秒後にダミー結果を表示
    setTimeout(function() {
      voiceBtn.classList.remove("active");
      showVoiceTranslationResult();
    }, 1500);
  });
}

// ============================================
// カメラ翻訳の初期化
// ============================================
function initCameraTranslation() {
  const cameraBtn = document.getElementById("cameraTranslateBtn");
  
  if (!cameraBtn) return;
  
  cameraBtn.addEventListener("click", function() {
    // ボタンをアクティブ状態に
    cameraBtn.classList.add("active");
    
    // 2秒後にダミー結果を表示
    setTimeout(function() {
      cameraBtn.classList.remove("active");
      showOCRTranslationResult();
    }, 2000);
  });
}

// ============================================
// 音声翻訳結果を表示
// ============================================
function showVoiceTranslationResult() {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  // ダミーデータを取得（順番に表示）
  const data = DUMMY_VOICE_TRANSLATIONS[voiceTranslationCount % DUMMY_VOICE_TRANSLATIONS.length];
  voiceTranslationCount++;
  
  // 結果を追加（既存の結果の上に追加）
  const resultHTML = createTranslationResultHTML("voice", data);
  
  // プレースホルダーがあれば削除
  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) {
    placeholder.remove();
  }
  
  // 新しい結果を先頭に追加
  resultArea.insertAdjacentHTML("afterbegin", resultHTML);
  
  // スクロールを一番上に
  resultArea.scrollTop = 0;
}

// ============================================
// OCR翻訳結果を表示
// ============================================
function showOCRTranslationResult() {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  // ダミーデータを取得（順番に表示）
  const data = DUMMY_OCR_TRANSLATIONS[ocrTranslationCount % DUMMY_OCR_TRANSLATIONS.length];
  ocrTranslationCount++;
  
  // 結果を追加（既存の結果の上に追加）
  const resultHTML = createTranslationResultHTML("ocr", data);
  
  // プレースホルダーがあれば削除
  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) {
    placeholder.remove();
  }
  
  // 新しい結果を先頭に追加
  resultArea.insertAdjacentHTML("afterbegin", resultHTML);
  
  // スクロールを一番上に
  resultArea.scrollTop = 0;
}

// ============================================
// 翻訳結果HTMLを生成
// ============================================
function createTranslationResultHTML(type, data) {
  const typeLabel = type === "voice" ? "音声翻訳" : "メニュー翻訳";
  const typeIcon = type === "voice" 
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      </svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>`;
  
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // 改行を<br>に変換
  const originalText = data.original.replace(/\n/g, '<br>');
  const translatedText = data.translated.replace(/\n/g, '<br>');
  
  return `
    <div class="translate-result-item translate-result-item--${type}">
      <div class="translate-result-item__header">
        <span class="translate-result-item__icon">${typeIcon}</span>
        <span class="translate-result-item__label">${typeLabel}</span>
        <span class="translate-result-item__lang">${getLanguageLabel()}</span>
        <span class="translate-result-item__time">${timeStr}</span>
      </div>
      <div class="translate-result-item__content">
        <div class="translate-result-item__original">
          <span class="translate-result-item__tag">原文</span>
          <p>${originalText}</p>
        </div>
        <div class="translate-result-item__divider">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="5 12 12 19 19 12"></polyline>
          </svg>
        </div>
        <div class="translate-result-item__translated">
          <span class="translate-result-item__tag">翻訳</span>
          <p>${translatedText}</p>
        </div>
      </div>
    </div>
  `;
}
