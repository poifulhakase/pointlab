// ============================================
// ぽいナビ 翻訳ページ - メインスクリプト
// ============================================

// ============================================
// セキュリティ: HTMLエスケープ関数
// ============================================
function escapeHtmlForDisplay(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// グローバル変数
// ============================================

// 翻訳結果カウンター
let voiceTranslationCount = 0;
let ocrTranslationCount = 0;

// 現在の言語設定（デフォルトを英語に変更 - 日本語データは重いため）
let ocrLang = localStorage.getItem("poinavi_ocr_lang") || "eng";
let targetLang = localStorage.getItem("poinavi_target_lang") || "ja";

// カメラ関連
let cameraStream = null;
let capturedImageData = null;

// クロップ関連
let cropBox = {
  x: 0,
  y: 0,
  width: 0,
  height: 0
};
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragStartX = 0;
let dragStartY = 0;
let cropStartX = 0;
let cropStartY = 0;
let cropStartWidth = 0;
let cropStartHeight = 0;

// キャンバス情報
let canvasRect = null;
let canvasScale = 1;

// Tesseract ワーカー
let tesseractWorker = null;

// ============================================
// 定数
// ============================================

// OCR言語コードから翻訳API用の言語コードへのマッピング
const OCR_TO_TRANSLATE_LANG = {
  "jpn": "ja",
  "eng": "en",
  "chi_sim": "zh",
  "chi_tra": "zh",
  "kor": "ko",
  "fra": "fr",
  "deu": "de",
  "spa": "es",
  "ita": "it",
  "por": "pt",
  "rus": "ru",
  "tha": "th",
  "vie": "vi"
};

// 言語コードから表示名（日本語）
const LANG_NAMES = {
  "ja": "日本語",
  "en": "英語",
  "zh": "中国語",
  "ko": "韓国語",
  "fr": "フランス語",
  "de": "ドイツ語",
  "es": "スペイン語",
  "it": "イタリア語",
  "pt": "ポルトガル語",
  "ru": "ロシア語",
  "th": "タイ語",
  "vi": "ベトナム語"
};

// 言語コードから表示名（英語）会話モード上部用
const LANG_NAMES_EN = {
  "ja": "Japanese",
  "en": "English",
  "zh": "Chinese",
  "ko": "Korean",
  "fr": "French",
  "de": "German",
  "es": "Spanish",
  "it": "Italian",
  "pt": "Portuguese",
  "ru": "Russian",
  "th": "Thai",
  "vi": "Vietnamese"
};

// OCR言語コードから表示名
const OCR_LANG_NAMES = {
  "jpn": "日本語",
  "eng": "英語",
  "chi_sim": "中国語（簡体）",
  "chi_tra": "中国語（繁体）",
  "kor": "韓国語",
  "fra": "フランス語",
  "deu": "ドイツ語",
  "spa": "スペイン語",
  "ita": "イタリア語",
  "por": "ポルトガル語",
  "rus": "ロシア語",
  "tha": "タイ語",
  "vie": "ベトナム語"
};

// OCR言語コードから表示名を取得
function getLangNameFromOcr(ocrCode) {
  return OCR_LANG_NAMES[ocrCode] || ocrCode;
}

// 翻訳API（LibreTranslate - 完全無料・オープンソース）
const LIBRETRANSLATE_API_URL = "https://libretranslate.com/translate";

// Web Speech API 用の言語コードマッピング
const SPEECH_LANG_CODES = {
  "ja": "ja-JP",
  "en": "en-US",
  "zh": "zh-CN",
  "ko": "ko-KR",
  "fr": "fr-FR",
  "de": "de-DE",
  "es": "es-ES",
  "it": "it-IT",
  "pt": "pt-PT",
  "ru": "ru-RU",
  "th": "th-TH",
  "vi": "vi-VN"
};

// 音声認識の状態
let isListening = false;
let speechRecognition = null;

// ============================================
// テーマ管理
// ============================================
function initTheme() {
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
// 初期化
// ============================================
document.addEventListener("DOMContentLoaded", function() {
  initTheme();
  initVoiceTranslation();
  initCameraTranslation();
  initImageTranslation();
  initResetButton();
  initSettingsModal();
  initThemeToggle();
  initLanguageSelect();
  initCameraModal();
  initStartPageSelect();
  initCurrencyModal();
  initUnitConversionModal();
});

// ============================================
// 起動ページ設定
// ============================================
function initStartPageSelect() {
  const select = document.getElementById("translateStartPageSelect");
  if (!select) return;

  // 保存された値を読み込み
  const savedStartPage = localStorage.getItem("poinavi_start_page") || "index.html";
  select.value = savedStartPage;

  // 変更時に保存
  select.addEventListener("change", function() {
    localStorage.setItem("poinavi_start_page", this.value);
  });
}

// ============================================
// 通貨モーダル
// ============================================
const CURRENCY_API_URL = "https://api.frankfurter.app/latest";

function initCurrencyModal() {
  const modal = document.getElementById("currencyModal");
  const openBtn = document.getElementById("currencyConvertBtn");
  const closeBtn = document.getElementById("currencyModalClose");
  const overlay = modal?.querySelector(".translate-modal__overlay");
  const amountInput = document.getElementById("currencyAmount");
  const fromSelect = document.getElementById("currencyFrom");
  const toSelect = document.getElementById("currencyTo");
  const resultEl = document.getElementById("currencyResult");
  const swapBtn = document.getElementById("currencySwapBtn");
  const pairDisplay = document.getElementById("currencyPairDisplay");
  const fromUnitEl = document.getElementById("currencyFromUnit");
  const toUnitEl = document.getElementById("currencyToUnit");

  if (!modal) return;

  let exchangeRate = null;
  let lastResult = null;
  let lastAmount = null;

  function getFromTo() {
    const from = fromSelect?.value || "JPY";
    const to = toSelect?.value || "USD";
    return { from, to };
  }

  function updateCurrencyPairDisplay() {
    const { from, to } = getFromTo();
    if (pairDisplay) pairDisplay.textContent = from + " → " + to;
    if (fromUnitEl) fromUnitEl.textContent = from;
    if (toUnitEl) toUnitEl.textContent = to;
  }

  function openCurrencyModal() {
    modal.classList.remove("hidden");
    history.pushState({ modal: "currency" }, "");
    updateCurrencyPairDisplay();
    fetchExchangeRate();
  }

  function handleCurrencyBtnOpen(e) {
    if (e.target.closest("#currencyConvertBtn")) {
      e.preventDefault();
      openCurrencyModal();
    }
  }
  document.body.addEventListener("click", handleCurrencyBtnOpen);
  document.body.addEventListener("touchend", handleCurrencyBtnOpen, { passive: false });

  if (closeBtn) closeBtn.addEventListener("click", closeCurrencyModal);

  if (overlay) overlay.addEventListener("click", closeCurrencyModal);

  function closeCurrencyModal() {
    modal.classList.add("hidden");
  }

  function fetchExchangeRate() {
    updateCurrencyPairDisplay();
    const { from, to } = getFromTo();
    if (from === to) {
      exchangeRate = 1;
      updateResult();
      return;
    }
    fetch(`${CURRENCY_API_URL}?from=${from}&to=${to}`)
      .then(res => res.json())
      .then(data => {
        exchangeRate = data.rates?.[to] ?? null;
        updateResult();
      })
      .catch(() => {
        exchangeRate = null;
        if (resultEl) resultEl.textContent = "レート取得失敗";
      });
  }

  function updateResult() {
    const amount = parseFloat(String(amountInput?.value || "").replace(/,/g, "")) || 0;
    const { from, to } = getFromTo();
    if (!resultEl) return;
    if (exchangeRate === null) {
      lastResult = null;
      lastAmount = null;
      resultEl.textContent = amount > 0 ? "—" : "—";
      if (amount > 0) showCurrencyConversionResult(amount, from, null, to);
      return;
    }
    const result = amount * exchangeRate;
    lastResult = amount > 0 ? result : null;
    lastAmount = amount > 0 ? amount : null;
    var resultStr;
    if (result != null && result > 0 && Math.abs(result - Math.round(result)) < 0.005) {
      resultStr = Math.round(result).toLocaleString("ja-JP");
    } else {
      resultStr = result.toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
    }
    resultEl.textContent = resultStr;
    if (amount > 0) showCurrencyConversionResult(amount, from, result, to);
  }

  if (fromSelect) {
    fromSelect.addEventListener("change", function() {
      updateCurrencyPairDisplay();
      fetchExchangeRate();
    });
  }
  if (toSelect) {
    toSelect.addEventListener("change", function() {
      updateCurrencyPairDisplay();
      fetchExchangeRate();
    });
  }

  if (swapBtn && fromSelect && toSelect) {
    swapBtn.addEventListener("click", function() {
      const fromVal = fromSelect.value;
      const toVal = toSelect.value;
      var newAmount = "";
      var useStoredResult = false;
      if (exchangeRate != null && exchangeRate > 0 && amountInput && lastResult != null && lastResult > 0 && lastAmount != null) {
        exchangeRate = 1 / exchangeRate;
        newAmount = parseFloat(lastResult.toFixed(8)).toString();
        useStoredResult = true;
      }
      fromSelect.value = toVal;
      toSelect.value = fromVal;
      if (amountInput && newAmount !== "") {
        amountInput.value = newAmount;
      }
      updateCurrencyPairDisplay();
      if (newAmount === "") {
        fetchExchangeRate();
      } else {
        updateResult();
        if (useStoredResult && resultEl && lastAmount != null) {
          var roundDisplay = Math.abs(lastAmount - Math.round(lastAmount)) < 0.005;
          resultEl.textContent = roundDisplay
            ? Math.round(lastAmount).toLocaleString("ja-JP")
            : lastAmount.toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
        }
      }
    });
  }

  const currencySettingsBtn = document.getElementById("currencySettingsBtn");
  if (currencySettingsBtn) {
    currencySettingsBtn.addEventListener("click", function() {
      closeCurrencyModal();
      openSettingsModalToSection("settingsCurrencySection", "currency");
    });
  }

  window.poinaviOpenCurrencyModal = openCurrencyModal;

  if (amountInput) {
    modal.querySelectorAll(".currency-modal__key").forEach(btn => {
      btn.addEventListener("click", function() {
        const key = this.getAttribute("data-key");
        if (key === "close") {
          modal.classList.add("hidden");
          return;
        }
        let val = amountInput.value || "0";
        if (key === "backspace") {
          val = val.slice(0, -1) || "0";
        } else if (key === "clear") {
          val = "0";
        } else if (key === ".") {
          if (!val.includes(".")) val = val === "0" ? "0." : val + ".";
        } else {
          val = val === "0" && key !== "." ? key : val + key;
        }
        amountInput.value = val;
        updateResult();
      });
    });
  }

  window.addEventListener("popstate", function() {
    const currencyModal = document.getElementById("currencyModal");
    if (currencyModal && !currencyModal.classList.contains("hidden")) {
      currencyModal.classList.add("hidden");
    }
  });
}

// ============================================
// 単位モーダル（変換元・変換先で個別選択）
// ============================================
// カテゴリごとの単位一覧と換算係数（基準単位への変換: 1単位 = toBase 基準単位）
const UNIT_CATEGORIES = {
  length: {
    label: "長さ",
    units: [
      { id: "cm", label: "cm" },
      { id: "inch", label: "inch" },
      { id: "ft", label: "ft" }
    ],
    toBase: { cm: 1, inch: 2.54, ft: 30.48 },
    fromBase: { cm: 1, inch: 1 / 2.54, ft: 1 / 30.48 }
  },
  weight: {
    label: "重さ",
    units: [
      { id: "kg", label: "kg" },
      { id: "lb", label: "lb" }
    ],
    toBase: { kg: 1, lb: 0.453592 },
    fromBase: { kg: 1, lb: 1 / 0.453592 }
  },
  temp: {
    label: "温度",
    units: [
      { id: "℃", label: "℃" },
      { id: "℉", label: "℉" }
    ],
    toBase: null,
    fromBase: null
  },
  distance: {
    label: "距離",
    units: [
      { id: "km", label: "km" },
      { id: "mile", label: "mile" }
    ],
    toBase: { km: 1, mile: 1.60934 },
    fromBase: { km: 1, mile: 1 / 1.60934 }
  },
  speed: {
    label: "速度",
    units: [
      { id: "km/h", label: "km/h" },
      { id: "mph", label: "mph" }
    ],
    toBase: { "km/h": 1, mph: 1.60934 },
    fromBase: { "km/h": 1, mph: 1 / 1.60934 }
  },
  volume: {
    label: "容量",
    units: [
      { id: "ml", label: "ml" },
      { id: "fl oz", label: "fl oz" },
      { id: "L", label: "L" },
      { id: "gallon", label: "gallon" }
    ],
    toBase: { ml: 1, "fl oz": 29.5735, L: 1000, gallon: 3785.41 },
    fromBase: { ml: 1, "fl oz": 1 / 29.5735, L: 1 / 1000, gallon: 1 / 3785.41 }
  }
};

function convertUnit(categoryId, fromUnit, toUnit, value) {
  const cat = UNIT_CATEGORIES[categoryId];
  if (!cat) return null;
  if (fromUnit === toUnit) return value;
  if (cat.toBase === null) {
    if (fromUnit === "℃" && toUnit === "℉") return value * 9 / 5 + 32;
    if (fromUnit === "℉" && toUnit === "℃") return (value - 32) * 5 / 9;
    return null;
  }
  const inBase = value * (cat.toBase[fromUnit] || 1);
  return inBase * (cat.fromBase[toUnit] || 1);
}

function initUnitConversionModal() {
  const modal = document.getElementById("unitModal");
  const openBtn = document.getElementById("unitConvertBtn");
  const closeBtn = document.getElementById("unitModalClose");
  const overlay = modal?.querySelector(".translate-modal__overlay");
  const amountInput = document.getElementById("unitAmount");
  const resultEl = document.getElementById("unitResult");
  const fromUnitEl = document.getElementById("unitFromUnit");
  const toUnitEl = document.getElementById("unitToUnit");
  const pairDisplay = document.getElementById("unitPairDisplay");
  const swapBtn = document.getElementById("unitSwapBtn");

  if (!modal) return;

  let lastUnitResult = null;
  let lastUnitAmount = null;

  function getCurrentUnits() {
    const cat = localStorage.getItem("poinavi_unit_category") || "length";
    const from = localStorage.getItem("poinavi_unit_from") || "cm";
    const to = localStorage.getItem("poinavi_unit_to") || "inch";
    const catData = UNIT_CATEGORIES[cat];
    const validFrom = catData?.units.some(u => u.id === from) ? from : (catData?.units[0]?.id || "cm");
    const validTo = catData?.units.some(u => u.id === to) ? to : (catData?.units[1]?.id || catData?.units[0]?.id || "inch");
    return { category: cat, from: validFrom, to: validTo };
  }

  function saveCurrentUnits(from, to) {
    if (from) localStorage.setItem("poinavi_unit_from", from);
    if (to) localStorage.setItem("poinavi_unit_to", to);
  }

  function updateUnitDisplay() {
    const { from, to } = getCurrentUnits();
    if (fromUnitEl) fromUnitEl.textContent = from;
    if (toUnitEl) toUnitEl.textContent = to;
    if (pairDisplay) pairDisplay.textContent = from + " → " + to;
    updateUnitResult();
  }

  function updateUnitResult() {
    const amount = parseFloat(String(amountInput?.value || "").replace(/,/g, "")) || 0;
    const { category, from, to } = getCurrentUnits();
    if (!resultEl) return;
    if (amount === 0 && amountInput?.value !== "0") {
      lastUnitResult = null;
      lastUnitAmount = null;
      resultEl.textContent = "—";
      return;
    }
    const result = convertUnit(category, from, to, amount);
    lastUnitResult = amount !== 0 && result != null ? result : null;
    lastUnitAmount = amount !== 0 ? amount : null;
    const isTemp = from === "℃" || from === "℉" || to === "℃" || to === "℉";
    const resultStr = result != null
      ? (isTemp ? result.toFixed(1) : result.toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 }))
      : "—";
    resultEl.textContent = resultStr;
    if (amount !== 0 && result != null) showUnitConversionResult(amount, from, result, to);
  }

  function openUnitModal() {
    modal.classList.remove("hidden");
    history.pushState({ modal: "unit" }, "");
    updateUnitDisplay();
  }

  function handleUnitBtnOpen(e) {
    if (e.target.closest("#unitConvertBtn")) {
      e.preventDefault();
      openUnitModal();
    }
  }
  document.body.addEventListener("click", handleUnitBtnOpen);
  document.body.addEventListener("touchend", handleUnitBtnOpen, { passive: false });

  if (closeBtn) closeBtn.addEventListener("click", closeUnitModal);
  if (overlay) overlay.addEventListener("click", closeUnitModal);

  function closeUnitModal() {
    modal.classList.add("hidden");
  }

  const unitSettingsBtn = document.getElementById("unitSettingsBtn");
  if (unitSettingsBtn) {
    unitSettingsBtn.addEventListener("click", function() {
      closeUnitModal();
      openSettingsModalToSection("settingsUnitSection", "unit");
    });
  }

  window.poinaviOpenUnitModal = openUnitModal;

  if (swapBtn) {
    swapBtn.addEventListener("click", function() {
      const amount = parseFloat(String(amountInput?.value || "").replace(/,/g, "")) || 0;
      const { from, to } = getCurrentUnits();
      saveCurrentUnits(to, from);
      if (amountInput && lastUnitResult != null && amount > 0) {
        amountInput.value = parseFloat(Number(lastUnitResult).toFixed(8)).toString();
      }
      updateUnitDisplay();
      if (resultEl && lastUnitAmount != null && amount > 0) {
        var r = lastUnitAmount;
        var isTemp = from === "℃" || from === "℉" || to === "℃" || to === "℉";
        resultEl.textContent = isTemp ? r.toFixed(1) : r.toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
      }
    });
  }

  if (amountInput) {
    const keys = modal.querySelectorAll(".currency-modal__key, .unit-modal__key");
    keys.forEach(function(btn) {
      btn.addEventListener("click", function() {
        const key = this.getAttribute("data-key");
        if (key === "neg") {
          const val = amountInput.value || "0";
          amountInput.value = val.startsWith("-") ? val.slice(1) : "-" + val;
        } else if (key === "close") {
          modal.classList.add("hidden");
          return;
        } else {
          let val = amountInput.value || "0";
          if (key === "backspace") {
            val = val.slice(0, -1) || "0";
          } else if (key === "clear") {
            val = "0";
          } else if (key === ".") {
            if (!val.includes(".")) val = val === "0" ? "0." : val + ".";
          } else if (/^[0-9]$/.test(key)) {
            val = val === "0" && key !== "." ? key : val + key;
          }
          if (key !== "neg") amountInput.value = val;
        }
        updateUnitResult();
      });
    });
  }

  window.addEventListener("popstate", function() {
    const unitModalEl = document.getElementById("unitModal");
    if (unitModalEl && !unitModalEl.classList.contains("hidden")) {
      unitModalEl.classList.add("hidden");
    }
  });
}

function showUnitConversionResult(amount, fromUnit, result, toUnit) {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;

  const amountStr = Number(amount).toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const isTemp = fromUnit === "℃" || fromUnit === "℉" || toUnit === "℃" || toUnit === "℉";
  const resultStr = result != null
    ? (isTemp ? result.toFixed(1) : Number(result).toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 }))
    : "—";
  const copyText = result != null ? `${amountStr} ${fromUnit} = ${resultStr} ${toUnit}` : `${amountStr} ${fromUnit}`;

  const typeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 17H8a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z"></path>
    <path d="M3 7h13a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2z"></path>
  </svg>`;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const existingUnit = resultArea.querySelector(".translate-result-item--unit");
  const resultHTML = `
    <div class="translate-result-item translate-result-item--unit" data-type="unit" data-copy="${encodeURIComponent(copyText)}">
      <div class="translate-result-item__header">
        <span class="translate-result-item__icon">${typeIcon}</span>
        <span class="translate-result-item__label">単位</span>
        <span class="translate-result-item__lang">${fromUnit} → ${toUnit}</span>
        <span class="translate-result-item__time">${timeStr}</span>
      </div>
      <div class="translate-result-item__content">
        <div class="translate-result-item__original">
          <span class="translate-result-item__tag">変換元</span>
          <p>${escapeHtmlForDisplay(amountStr)} ${fromUnit}</p>
        </div>
        <div class="translate-result-item__divider">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="5 12 12 19 19 12"></polyline>
          </svg>
        </div>
        <div class="translate-result-item__translated">
          <span class="translate-result-item__tag">換算結果</span>
          <p>${escapeHtmlForDisplay(resultStr)} ${toUnit}</p>
        </div>
      </div>
      <div class="translate-result-item__actions">
        <button class="translate-result-item__action-btn copy-unit-result-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>結果をコピー</span>
        </button>
        <button class="translate-result-item__action-btn add-unit-to-memo-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <span>ラボノートに追加</span>
        </button>
      </div>
    </div>
  `;

  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) placeholder.remove();

  resultArea.querySelectorAll(".translate-result-item--latest").forEach(function(item) {
    item.classList.remove("translate-result-item--latest");
  });

  if (existingUnit) {
    existingUnit.outerHTML = resultHTML;
  } else {
    resultArea.insertAdjacentHTML("afterbegin", resultHTML);
  }

  const latestItem = resultArea.querySelector(".translate-result-item--unit");
  latestItem?.classList.add("translate-result-item--latest");
  latestItem?.querySelector(".copy-unit-result-btn")?.addEventListener("click", function() {
    const text = decodeURIComponent(latestItem.dataset.copy || "");
    if (text && typeof copyToClipboard === "function") copyToClipboard(text, this);
  });
  latestItem?.querySelector(".add-unit-to-memo-btn")?.addEventListener("click", function() {
    const memoText = decodeURIComponent(latestItem.dataset.copy || "");
    if (memoText) addToMemo(memoText, this);
  });
  resultArea.scrollTop = 0;
  setupCopyButtons();
}

// ============================================
// 設定モーダル
// ============================================
function openSettingsModalToSection(sectionId, source) {
  const modal = document.getElementById("translateSettingsModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  history.pushState({ modal: "translateSettings", source: source }, "");

  var backBtn = document.getElementById("translateSettingsBack");
  var backLabel = document.getElementById("translateSettingsBackLabel");
  var voiceSection = document.getElementById("settingsVoiceSection");
  var cameraSection = document.getElementById("settingsCameraSection");
  var currencySection = document.getElementById("settingsCurrencySection");
  var unitSection = document.getElementById("settingsUnitSection");
  var guideSection = document.getElementById("settingsGuideSection");

  function showSection(el) { if (el) el.style.display = ""; }
  function hideSection(el) { if (el) el.style.display = "none"; }

  if (source === "unit") {
    if (backBtn) { backBtn.classList.remove("hidden"); backBtn.dataset.returnTo = "unit"; }
    if (backLabel) backLabel.textContent = "単位に戻る";
    hideSection(voiceSection);
    hideSection(cameraSection);
    hideSection(currencySection);
    showSection(unitSection);
    hideSection(guideSection);
  } else if (source === "currency") {
    if (backBtn) { backBtn.classList.remove("hidden"); backBtn.dataset.returnTo = "currency"; }
    if (backLabel) backLabel.textContent = "通貨に戻る";
    hideSection(voiceSection);
    hideSection(cameraSection);
    showSection(currencySection);
    hideSection(unitSection);
    hideSection(guideSection);
  } else {
    if (backBtn) { backBtn.classList.add("hidden"); backBtn.dataset.returnTo = ""; }
    showSection(voiceSection);
    showSection(cameraSection);
    showSection(currencySection);
    showSection(unitSection);
    showSection(guideSection);
  }

  if (sectionId === "settingsUnitSection") {
    var unitFromEl = document.getElementById("unitFrom");
    var unitToEl = document.getElementById("unitTo");
    var from = localStorage.getItem("poinavi_unit_from");
    var to = localStorage.getItem("poinavi_unit_to");
    if (unitFromEl && from) unitFromEl.value = from;
    if (unitToEl && to) unitToEl.value = to;
  }
  if (sectionId) {
    requestAnimationFrame(function() {
      var section = document.getElementById(sectionId);
      var body = modal.querySelector(".translate-modal__body");
      if (section && body && body.contains(section)) {
        body.scrollTop = Math.max(0, section.offsetTop - 16);
      }
    });
  }
}

function initSettingsModal() {
  const modal = document.getElementById("translateSettingsModal");
  const openBtn = document.getElementById("translateSettingsButton");
  const closeBtn = document.getElementById("translateSettingsClose");
  const overlay = modal?.querySelector(".translate-modal__overlay");

  if (!modal || !openBtn || !closeBtn) return;

  openBtn.addEventListener("click", function() {
    openSettingsModalToSection();
  });

  closeBtn.addEventListener("click", function() {
    modal.classList.add("hidden");
  });

  var backBtn = document.getElementById("translateSettingsBack");
  if (backBtn) {
    backBtn.addEventListener("click", function() {
      var returnTo = this.dataset.returnTo;
      modal.classList.add("hidden");
      if (returnTo === "unit" && typeof window.poinaviOpenUnitModal === "function") {
        window.poinaviOpenUnitModal();
      } else if (returnTo === "currency" && typeof window.poinaviOpenCurrencyModal === "function") {
        window.poinaviOpenCurrencyModal();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener("click", function() {
      modal.classList.add("hidden");
    });
  }
  
  // 設定初期化ボタン
  const resetBtn = document.getElementById("translateResetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", function() {
      resetTranslateSettings();
    });
  }
  
  // Android戻るボタン対応（popstateイベント）
  window.addEventListener("popstate", function(event) {
    const settingsModal = document.getElementById("translateSettingsModal");
    const cameraModal = document.getElementById("cameraModal");
    const qrModal = document.getElementById("qrModal");
    
    // カメラモーダルが開いている場合は閉じる
    if (cameraModal && !cameraModal.classList.contains("hidden")) {
      closeCameraModal();
      return;
    }
    
    // QRモーダルが開いている場合は閉じる
    if (qrModal && !qrModal.classList.contains("hidden")) {
      closeQrModal();
      return;
    }
    
    // 設定モーダルが開いている場合は閉じ、単位/通貨から来ていたら戻る
    if (settingsModal && !settingsModal.classList.contains("hidden")) {
      var backBtn = document.getElementById("translateSettingsBack");
      var returnTo = backBtn && backBtn.dataset.returnTo;
      settingsModal.classList.add("hidden");
      if (returnTo === "unit" && typeof window.poinaviOpenUnitModal === "function") {
        window.poinaviOpenUnitModal();
      } else if (returnTo === "currency" && typeof window.poinaviOpenCurrencyModal === "function") {
        window.poinaviOpenCurrencyModal();
      }
      return;
    }
  });
}

// 翻訳設定を初期化
function resetTranslateSettings() {
  poinaviConfirm("すべての設定を初期化しますか？\n（言語設定、テーマ、起動ページなどがリセットされます）").then(ok => {
    if (!ok) return;
    localStorage.removeItem("poinavi_ocr_lang");
    localStorage.removeItem("poinavi_target_lang");
    localStorage.removeItem("poinavi_mic_input_lang");
    localStorage.removeItem("poinavi_mic_output_lang");
    localStorage.removeItem("poinavi_theme");
    localStorage.removeItem("poinavi_start_page");
    localStorage.removeItem("poinavi_unit_category");
    localStorage.removeItem("poinavi_unit_from");
    localStorage.removeItem("poinavi_unit_to");
    localStorage.removeItem("poinavi_currency_from");
    localStorage.removeItem("poinavi_currency_to");
    poinaviAlert("設定を初期化しました。ページを再読み込みします。");
    location.reload();
  });
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
      document.documentElement.classList.remove("dark-mode");
      document.documentElement.classList.add("light-mode");
      localStorage.setItem("poinavi_theme", "light");
    } else {
      document.body.classList.remove("light-mode");
      document.body.classList.add("dark-mode");
      document.documentElement.classList.remove("light-mode");
      document.documentElement.classList.add("dark-mode");
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

  if (icon) icon.textContent = isDark ? "🌙" : "☀️";
  if (text) text.textContent = isDark ? "ダークモード" : "ライトモード";
}

// ============================================
// 言語選択
// ============================================
function initLanguageSelect() {
  const ocrSelect = document.getElementById("ocrLanguageSelect");
  const targetSelect = document.getElementById("translateTargetLang");
  const micInputSelect = document.getElementById("micInputLangSelect");
  const micTargetSelect = document.getElementById("micTargetLangSelect");
  
  if (!ocrSelect || !targetSelect) return;

  // 保存された言語を復元（カメラ）
  ocrSelect.value = ocrLang;
  targetSelect.value = targetLang;

  // 保存された言語を復元（音声）
  if (micInputSelect) {
    const savedMicInput = localStorage.getItem("poinavi_mic_input_lang") || "en";
    micInputSelect.value = savedMicInput;
    micInputSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_mic_input_lang", this.value);
      updateConversationModeLangLabels();
    });
  }
  if (micTargetSelect) {
    const savedMicTarget = localStorage.getItem("poinavi_mic_output_lang") || "ja";
    micTargetSelect.value = savedMicTarget;
    micTargetSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_mic_output_lang", this.value);
      updateConversationModeLangLabels();
    });
  }

  // OCR言語の変更
  ocrSelect.addEventListener("change", function() {
    ocrLang = this.value;
    localStorage.setItem("poinavi_ocr_lang", ocrLang);
  });

  // 翻訳後言語の変更
  targetSelect.addEventListener("change", function() {
    targetLang = this.value;
    localStorage.setItem("poinavi_target_lang", targetLang);
  });

  // 単位の初期化（変換元・変換先で個別選択）
  const OLD_UNIT_MIGRATION = {
    length_cm_inch: { category: "length", from: "cm", to: "inch" },
    length_cm_ft: { category: "length", from: "cm", to: "ft" },
    weight: { category: "weight", from: "kg", to: "lb" },
    temp: { category: "temp", from: "℃", to: "℉" },
    distance: { category: "distance", from: "km", to: "mile" },
    speed: { category: "speed", from: "km/h", to: "mph" },
    volume_ml: { category: "volume", from: "ml", to: "fl oz" },
    volume_L: { category: "volume", from: "L", to: "gallon" }
  };
  const unitCategorySelect = document.getElementById("unitCategory");
  const unitFromSelect = document.getElementById("unitFrom");
  const unitToSelect = document.getElementById("unitTo");

  function populateUnitSelects(categoryId) {
    const cat = UNIT_CATEGORIES[categoryId];
    if (!cat || !unitFromSelect || !unitToSelect) return;
    unitFromSelect.innerHTML = "";
    unitToSelect.innerHTML = "";
    cat.units.forEach(function(u) {
      const optFrom = document.createElement("option");
      optFrom.value = u.id;
      optFrom.textContent = u.label;
      unitFromSelect.appendChild(optFrom);
      const optTo = document.createElement("option");
      optTo.value = u.id;
      optTo.textContent = u.label;
      unitToSelect.appendChild(optTo);
    });
  }

  function initUnitSelectsFromStorage() {
    let cat = localStorage.getItem("poinavi_unit_category");
    let from = localStorage.getItem("poinavi_unit_from");
    let to = localStorage.getItem("poinavi_unit_to");
    if (OLD_UNIT_MIGRATION[cat]) {
      const m = OLD_UNIT_MIGRATION[cat];
      cat = m.category;
      from = m.from;
      to = m.to;
      localStorage.setItem("poinavi_unit_category", cat);
      localStorage.setItem("poinavi_unit_from", from);
      localStorage.setItem("poinavi_unit_to", to);
    }
    if (!cat || !UNIT_CATEGORIES[cat]) cat = "length";
    if (!from || !to) {
      const c = UNIT_CATEGORIES[cat];
      from = from || c?.units[0]?.id || "cm";
      to = to || c?.units[1]?.id || c?.units[0]?.id || "inch";
    }
    if (unitCategorySelect) unitCategorySelect.value = cat;
    populateUnitSelects(cat);
    if (unitFromSelect) unitFromSelect.value = from;
    if (unitToSelect) unitToSelect.value = to;
  }

  if (unitCategorySelect && unitFromSelect && unitToSelect) {
    initUnitSelectsFromStorage();
    unitCategorySelect.addEventListener("change", function() {
      const cat = this.value;
      localStorage.setItem("poinavi_unit_category", cat);
      populateUnitSelects(cat);
      const c = UNIT_CATEGORIES[cat];
      const first = c?.units[0]?.id;
      const second = c?.units[1]?.id || first;
      unitFromSelect.value = first;
      unitToSelect.value = second;
      localStorage.setItem("poinavi_unit_from", first);
      localStorage.setItem("poinavi_unit_to", second);
    });
    unitFromSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_unit_from", this.value);
    });
    unitToSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_unit_to", this.value);
    });
  }

  // 通貨ペアの保存・復元
  const currencyFromSelect = document.getElementById("currencyFrom");
  const currencyToSelect = document.getElementById("currencyTo");
  if (currencyFromSelect && currencyToSelect) {
    const savedCurrencyFrom = localStorage.getItem("poinavi_currency_from") || "JPY";
    const savedCurrencyTo = localStorage.getItem("poinavi_currency_to") || "USD";
    if (savedCurrencyFrom) currencyFromSelect.value = savedCurrencyFrom;
    if (savedCurrencyTo) currencyToSelect.value = savedCurrencyTo;
    currencyFromSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_currency_from", this.value);
    });
    currencyToSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_currency_to", this.value);
    });
  }

}

// 言語コードから表示名を取得
function getLangName(code) {
  return LANG_NAMES[code] || code;
}

// 会話モードの言語ラベルを更新（上：自分→日本語表示、下：相手→英語表示）
function updateConversationModeLangLabels() {
  const myLabel = document.getElementById("convMyLangLabel");
  const opponentLabel = document.getElementById("convOpponentLangLabel");
  const micTarget = document.getElementById("micTargetLangSelect")?.value || "ja";
  const micInput = document.getElementById("micInputLangSelect")?.value || "en";
  if (myLabel) myLabel.textContent = LANG_NAMES[micTarget] || micTarget;
  if (opponentLabel) opponentLabel.textContent = LANG_NAMES_EN[micInput] || micInput;
}

// 現在の言語設定から表示テキストを取得
function getLanguageLabel() {
  const sourceLangCode = OCR_TO_TRANSLATE_LANG[ocrLang] || "ja";
  return `${getLangName(sourceLangCode)} → ${getLangName(targetLang)}`;
}

// ============================================
// 会話モードの初期化（Web Speech API版）
// ============================================
function initVoiceTranslation() {
  const conversationMode = document.getElementById("conversationMode");
  const startBtn = document.getElementById("convStartBtn");
  const splitEl = document.getElementById("conversationSplit");
  const opponentBtn = document.getElementById("convOpponentBtn");
  const myBtn = document.getElementById("convMyBtn");
  const stopBtn = document.getElementById("conversationStopBtn");

  if (!startBtn || !splitEl || !opponentBtn || !myBtn) return;

  // Web Speech API のサポート確認
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("Web Speech APIがサポートされていません");
    startBtn.addEventListener("click", function() {
      poinaviAlert("お使いのブラウザは音声認識に対応していません。\nChrome、Edge、Safariをお試しください。");
    });
    return;
  }

  // 音声認識の初期化
  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.maxAlternatives = 1;

  let currentSpeaker = null;

  function switchToStart() {
    startBtn.classList.remove("hidden");
    splitEl.classList.add("hidden");
    opponentBtn.classList.remove("listening");
    myBtn.classList.remove("listening");
    currentSpeaker = null;
    if (conversationMode) conversationMode.classList.remove("conversation-active");
    if (stopBtn) stopBtn.classList.add("hidden");
  }

  function switchToSplit() {
    startBtn.classList.add("hidden");
    splitEl.classList.remove("hidden");
    opponentBtn.classList.remove("listening");
    myBtn.classList.remove("listening");
    currentSpeaker = null;
    if (conversationMode) conversationMode.classList.add("conversation-active");
    if (stopBtn) stopBtn.classList.remove("hidden");
    updateConversationModeLangLabels();
  }

  speechRecognition.onstart = function() {
    isListening = true;
    if (currentSpeaker === "opponent") opponentBtn.classList.add("listening");
    else if (currentSpeaker === "my") myBtn.classList.add("listening");
  };

  speechRecognition.onend = function() {
    isListening = false;
    opponentBtn.classList.remove("listening");
    myBtn.classList.remove("listening");
    if (currentSpeaker) switchToSplit();
    currentSpeaker = null;
  };

  speechRecognition.onerror = function(event) {
    console.error("音声認識エラー:", event.error);
    isListening = false;
    opponentBtn.classList.remove("listening");
    myBtn.classList.remove("listening");
    currentSpeaker = null;
    switchToSplit();

    if (event.error === "no-speech") {
      poinaviAlert("音声が検出されませんでした。\nもう一度お試しください。");
    } else if (event.error === "not-allowed") {
      poinaviAlert("マイクへのアクセスが許可されていません。\n設定からマイクへのアクセスを許可してください。");
    } else if (event.error === "network") {
      poinaviAlert("ネットワークエラーが発生しました。\nインターネット接続を確認してください。");
    }
  };

  speechRecognition.onresult = async function(event) {
    const result = event.results[event.results.length - 1];

    if (result.isFinal) {
      const transcript = result[0].transcript;
      console.log("認識結果:", transcript);

      const micInputLang = document.getElementById("micInputLangSelect")?.value || "en";
      const micTargetLang = document.getElementById("micTargetLangSelect")?.value || "ja";

      const sourceLang = currentSpeaker === "opponent" ? micInputLang : micTargetLang;
      const targetLang = currentSpeaker === "opponent" ? micTargetLang : micInputLang;

      await processConversationTranslation(transcript, sourceLang, targetLang);
    }
  };

  startBtn.addEventListener("click", function() {
    switchToSplit();
  });

  opponentBtn.addEventListener("click", function() {
    if (isListening) return;
    currentSpeaker = "opponent";
    startConversationRecognition("opponent");
  });

  myBtn.addEventListener("click", function() {
    if (isListening) return;
    currentSpeaker = "my";
    startConversationRecognition("my");
  });

  if (stopBtn) {
    stopBtn.classList.add("hidden");
    stopBtn.addEventListener("click", function() {
      if (isListening && speechRecognition) {
        speechRecognition.stop();
      }
      switchToStart();
    });
  }
}

function startConversationRecognition(speaker) {
  if (!speechRecognition) return;

  const micInputLang = document.getElementById("micInputLangSelect")?.value || "en";
  const micTargetLang = document.getElementById("micTargetLangSelect")?.value || "ja";

  const lang = speaker === "opponent" ? micInputLang : micTargetLang;
  const langCode = SPEECH_LANG_CODES[lang] || (lang === "ja" ? "ja-JP" : "en-US");

  speechRecognition.lang = langCode;

  try {
    speechRecognition.start();
  } catch (err) {
    console.error("音声認識の開始に失敗:", err);
    if (err.message.includes("already started")) {
      speechRecognition.stop();
    }
  }
}

// 翻訳入力の最大文字数
const TRANSLATE_MAX_LENGTH = 5000;

async function processConversationTranslation(transcript, sourceLang, targetLang) {
  try {
    if (transcript.length > TRANSLATE_MAX_LENGTH) {
      poinaviAlert("テキストが長すぎます。" + TRANSLATE_MAX_LENGTH + "文字以内にしてください。");
      return;
    }

    const translatedText = await translateTextLibre(transcript, sourceLang, targetLang);

    showVoiceTranslationResult(transcript, translatedText, sourceLang, targetLang);

    speakText(translatedText, targetLang);

  } catch (err) {
    console.error("翻訳エラー:", err);
    poinaviAlert("翻訳に失敗しました。\n" + err.message);
  }
}

async function processVoiceTranslation(transcript) {
  const micInputLang = document.getElementById("micInputLangSelect")?.value || "en";
  const micTargetLang = document.getElementById("micTargetLangSelect")?.value || "ja";
  await processConversationTranslation(transcript, micInputLang, micTargetLang);
}

function showVoiceTranslationResult(originalText, translatedText, sourceLang, targetLang) {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  voiceTranslationCount++;
  
  const data = {
    original: originalText,
    translated: translatedText,
    sourceLang: sourceLang,
    targetLang: targetLang
  };
  
  const resultHTML = createTranslationResultHTML("voice", data);
  
  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) {
    placeholder.remove();
  }
  
  // 以前の最新マークを削除
  resultArea.querySelectorAll(".translate-result-item--latest").forEach(item => {
    item.classList.remove("translate-result-item--latest");
  });
  
  resultArea.insertAdjacentHTML("afterbegin", resultHTML);
  
  // 最新の結果にマークを付ける
  const latestItem = resultArea.querySelector(".translate-result-item");
  if (latestItem) {
    latestItem.classList.add("translate-result-item--latest");
  }
  
  resultArea.scrollTop = 0;
  
  // コピーボタンのイベントを設定
  setupCopyButtons();
}

// ============================================
// 通貨結果を翻訳結果エリアに表示
// ============================================
function showCurrencyConversionResult(amount, fromCurrency, result, toCurrency) {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;

  const amountStr = Number(amount).toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const resultStr = result != null
    ? Number(result).toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 0 })
    : "—";
  const copyText = result != null ? `${amountStr} ${fromCurrency} = ${resultStr} ${toCurrency}` : `${amountStr} ${fromCurrency}`;

  const typeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="1" x2="12" y2="23"></line>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>`;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const existingCurrency = resultArea.querySelector(".translate-result-item--currency");
  const resultHTML = `
    <div class="translate-result-item translate-result-item--currency" data-type="currency" data-copy="${encodeURIComponent(copyText)}">
      <div class="translate-result-item__header">
        <span class="translate-result-item__icon">${typeIcon}</span>
        <span class="translate-result-item__label">通貨</span>
        <span class="translate-result-item__lang">${fromCurrency} → ${toCurrency}</span>
        <span class="translate-result-item__time">${timeStr}</span>
      </div>
      <div class="translate-result-item__content">
        <div class="translate-result-item__original">
          <span class="translate-result-item__tag">変換元</span>
          <p>${escapeHtmlForDisplay(amountStr)} ${fromCurrency}</p>
        </div>
        <div class="translate-result-item__divider">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="5 12 12 19 19 12"></polyline>
          </svg>
        </div>
        <div class="translate-result-item__translated">
          <span class="translate-result-item__tag">換算結果</span>
          <p>${escapeHtmlForDisplay(resultStr)} ${toCurrency}</p>
        </div>
      </div>
      <div class="translate-result-item__actions">
        <button class="translate-result-item__action-btn copy-currency-result-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>結果をコピー</span>
        </button>
        <button class="translate-result-item__action-btn add-currency-to-memo-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <span>ラボノートに追加</span>
        </button>
      </div>
    </div>
  `;

  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) placeholder.remove();

  resultArea.querySelectorAll(".translate-result-item--latest").forEach(function(item) {
    item.classList.remove("translate-result-item--latest");
  });

  if (existingCurrency) {
    existingCurrency.outerHTML = resultHTML;
  } else {
    resultArea.insertAdjacentHTML("afterbegin", resultHTML);
  }

  const latestItem = resultArea.querySelector(".translate-result-item--currency");
  if (latestItem) latestItem.classList.add("translate-result-item--latest");

  resultArea.scrollTop = 0;

  latestItem?.querySelector(".copy-currency-result-btn")?.addEventListener("click", function() {
    const text = decodeURIComponent(latestItem.dataset.copy || "");
    if (text && typeof copyToClipboard === "function") {
      copyToClipboard(text, this);
    }
  });

  latestItem?.querySelector(".add-currency-to-memo-btn")?.addEventListener("click", function() {
    const memoText = decodeURIComponent(latestItem.dataset.copy || "");
    if (memoText) addToMemo(memoText, this);
  });
}

// 翻訳結果を読み上げる
function speakText(text, lang) {
  if (!window.speechSynthesis) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG_CODES[lang] || "ja-JP";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  
  window.speechSynthesis.speak(utterance);
}

// ============================================
// カメラの初期化
// ============================================
function initCameraTranslation() {
  const cameraBtn = document.getElementById("cameraTranslateBtn");
  
  if (!cameraBtn) return;
  
  cameraBtn.addEventListener("click", function() {
    openCameraModal();
  });
}

// ============================================
// 画像の初期化
// ============================================
function initImageTranslation() {
  const imageBtn = document.getElementById("imageTranslateBtn");
  const fileInput = document.getElementById("imageTranslateInput");
  const overlay = document.getElementById("imageTranslateOverlay");
  const processingText = document.getElementById("imageProcessingText");
  const progressFill = document.getElementById("imageProgressFill");

  if (!imageBtn || !fileInput) return;

  imageBtn.addEventListener("click", function() {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", async function() {
    const file = this.files && this.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    if (!overlay) return;
    overlay.classList.remove("hidden");
    if (processingText) processingText.textContent = "画像を読み込み中...";
    if (progressFill) progressFill.style.width = "0%";

    const reader = new FileReader();
    reader.onload = async function() {
      const imageData = reader.result;
      if (!imageData || typeof imageData !== "string") {
        closeImageTranslateOverlay();
        poinaviAlert("画像の読み込みに失敗しました。");
        return;
      }

      try {
        if (processingText) processingText.textContent = "文字を認識中...";
        if (progressFill) progressFill.style.width = "20%";

        const ocrResult = await performOCR(imageData, function(progress) {
          if (progressFill) progressFill.style.width = (20 + progress * 40) + "%";
        });

        if (!ocrResult || ocrResult.trim() === "") {
          closeImageTranslateOverlay();
          poinaviAlert("文字を認識できませんでした。\n\n画像に文字が含まれていますか？\n言語設定を確認してください。（現在: " + getLangNameFromOcr(ocrLang) + "）");
          return;
        }

        if (processingText) processingText.textContent = "翻訳中...";
        if (progressFill) progressFill.style.width = "70%";

        const sourceLangCode = OCR_TO_TRANSLATE_LANG[ocrLang] || "ja";
        const translatedText = await translateText(ocrResult, sourceLangCode, targetLang);

        if (progressFill) progressFill.style.width = "100%";

        setTimeout(function() {
          closeImageTranslateOverlay();
          showImageTranslationResult(ocrResult, translatedText, imageData);
        }, 300);
      } catch (err) {
        console.error("画像エラー:", err);
        closeImageTranslateOverlay();
        poinaviAlert("処理中にエラーが発生しました。\n\n" + (err.message || "不明なエラー"));
      }
    };

    reader.readAsDataURL(file);
  });
}

function closeImageTranslateOverlay() {
  const overlay = document.getElementById("imageTranslateOverlay");
  if (overlay) overlay.classList.add("hidden");
}

function showImageTranslationResult(originalText, translatedText, imageData) {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;

  ocrTranslationCount++;

  const data = {
    original: originalText,
    translated: translatedText,
    image: imageData
  };

  const resultHTML = createTranslationResultHTML("image", data);

  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) placeholder.remove();

  resultArea.querySelectorAll(".translate-result-item--latest").forEach(function(item) {
    item.classList.remove("translate-result-item--latest");
  });

  resultArea.insertAdjacentHTML("afterbegin", resultHTML);

  const latestItem = resultArea.querySelector(".translate-result-item");
  if (latestItem) latestItem.classList.add("translate-result-item--latest");

  resultArea.scrollTop = 0;
  setupCopyButtons();
}

// ============================================
// リセットボタンの初期化
// ============================================
function initResetButton() {
  const resetBtn = document.getElementById("resetTranslateBtn");
  
  if (!resetBtn) return;
  
  resetBtn.addEventListener("click", function() {
    const resultArea = document.getElementById("translateResultArea");
    const hasResults = resultArea && !resultArea.querySelector(".translate-result-placeholder");
    
    if (!hasResults) return;
    
    poinaviConfirm("翻訳結果をすべて削除しますか？").then(ok => {
      if (ok) resetTranslationArea();
    });
  });
}

function resetTranslationArea() {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  resultArea.innerHTML = `
    <div class="translate-result-placeholder">
      <p>翻訳がここに表示されます</p>
    </div>
  `;
  
  voiceTranslationCount = 0;
  ocrTranslationCount = 0;
}

// ============================================
// カメラモーダル
// ============================================
function initCameraModal() {
  const closeBtn = document.getElementById("cameraCloseBtn");
  const captureBtn = document.getElementById("cameraCaptureBtn");
  const backBtn = document.getElementById("cropBackBtn");
  const doneBtn = document.getElementById("cropDoneBtn");
  
  if (closeBtn) {
    closeBtn.addEventListener("click", closeCameraModal);
  }
  
  if (captureBtn) {
    captureBtn.addEventListener("click", capturePhoto);
  }
  
  if (backBtn) {
    backBtn.addEventListener("click", goBackToCamera);
  }
  
  if (doneBtn) {
    doneBtn.addEventListener("click", startOCRProcess);
  }
  
  // クロップボックスのイベント
  initCropEvents();
}

function openCameraModal() {
  const modal = document.getElementById("cameraModal");
  const previewScreen = document.getElementById("cameraPreviewScreen");
  const cropScreen = document.getElementById("cropScreen");
  const processingScreen = document.getElementById("ocrProcessingScreen");
  
  if (!modal) return;
  
  // 画面をリセット
  previewScreen?.classList.remove("hidden");
  cropScreen?.classList.add("hidden");
  processingScreen?.classList.add("hidden");
  
  modal.classList.remove("hidden");
  
  // 履歴に状態を追加（Android戻るボタン対応）
  history.pushState({ modal: "camera" }, "");
  
  // カメラを起動
  startCamera();
}

function closeCameraModal() {
  const modal = document.getElementById("cameraModal");
  if (modal && !modal.classList.contains("hidden")) {
    modal.classList.add("hidden");
  }
  stopCamera();
}

async function startCamera() {
  const video = document.getElementById("cameraVideo");
  if (!video) return;
  
  try {
    const constraints = {
      video: {
        facingMode: "environment", // 背面カメラ優先
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraStream;
  } catch (err) {
    console.error("カメラの起動に失敗しました:", err);
    poinaviAlert("カメラへのアクセスが許可されていません。\n設定からカメラへのアクセスを許可してください。");
    closeCameraModal();
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  
  const video = document.getElementById("cameraVideo");
  if (video) {
    video.srcObject = null;
  }
}

function capturePhoto() {
  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("capturedCanvas");
  
  if (!video || !canvas) return;
  
  const ctx = canvas.getContext("2d");
  
  // ビデオのサイズを取得
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  
  // パフォーマンスのため幅640pxにリサイズ
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / videoWidth);
  const width = Math.floor(videoWidth * scale);
  const height = Math.floor(videoHeight * scale);
  
  canvas.width = width;
  canvas.height = height;
  
  // 描画
  ctx.drawImage(video, 0, 0, width, height);
  
  // 画像データを保存
  capturedImageData = canvas.toDataURL("image/jpeg", 0.9);
  
  // カメラを停止
  stopCamera();
  
  // クロップ画面に切り替え
  showCropScreen();
}

function showCropScreen() {
  const previewScreen = document.getElementById("cameraPreviewScreen");
  const cropScreen = document.getElementById("cropScreen");
  
  previewScreen?.classList.add("hidden");
  cropScreen?.classList.remove("hidden");
  
  // クロップボックスを初期化
  initCropBox();
}

function goBackToCamera() {
  const previewScreen = document.getElementById("cameraPreviewScreen");
  const cropScreen = document.getElementById("cropScreen");
  
  cropScreen?.classList.add("hidden");
  previewScreen?.classList.remove("hidden");
  
  // カメラを再起動
  startCamera();
}

// ============================================
// クロップ機能
// ============================================
function initCropBox() {
  const canvas = document.getElementById("capturedCanvas");
  const cropBoxEl = document.getElementById("cropBox");
  const wrapper = document.getElementById("cropWrapper");
  
  if (!canvas || !cropBoxEl || !wrapper) return;
  
  // キャンバスの実際の表示サイズを取得
  setTimeout(() => {
    canvasRect = canvas.getBoundingClientRect();
    canvasScale = canvas.width / canvasRect.width;
    
    // 初期クロップボックス（画像の60%の領域を中央に）
    const boxWidth = canvasRect.width * 0.8;
    const boxHeight = canvasRect.height * 0.6;
    const boxX = (canvasRect.width - boxWidth) / 2;
    const boxY = (canvasRect.height - boxHeight) / 2;
    
    // wrapper内でのキャンバスのオフセットを計算
    const wrapperRect = wrapper.getBoundingClientRect();
    const offsetX = canvasRect.left - wrapperRect.left;
    const offsetY = canvasRect.top - wrapperRect.top;
    
    cropBox = {
      x: offsetX + boxX,
      y: offsetY + boxY,
      width: boxWidth,
      height: boxHeight
    };
    
    updateCropBoxPosition();
  }, 100);
}

function updateCropBoxPosition() {
  const cropBoxEl = document.getElementById("cropBox");
  if (!cropBoxEl) return;
  
  cropBoxEl.style.left = cropBox.x + "px";
  cropBoxEl.style.top = cropBox.y + "px";
  cropBoxEl.style.width = cropBox.width + "px";
  cropBoxEl.style.height = cropBox.height + "px";
}

function initCropEvents() {
  const cropBoxEl = document.getElementById("cropBox");
  const wrapper = document.getElementById("cropWrapper");
  
  if (!cropBoxEl || !wrapper) return;
  
  // ボックスのドラッグ
  cropBoxEl.addEventListener("mousedown", startDrag);
  cropBoxEl.addEventListener("touchstart", startDrag, { passive: false });
  
  // ハンドルのリサイズ
  const handles = cropBoxEl.querySelectorAll(".crop-handle");
  handles.forEach(handle => {
    handle.addEventListener("mousedown", startResize);
    handle.addEventListener("touchstart", startResize, { passive: false });
  });
  
  // グローバルイベント
  document.addEventListener("mousemove", handleMove);
  document.addEventListener("touchmove", handleMove, { passive: false });
  document.addEventListener("mouseup", handleEnd);
  document.addEventListener("touchend", handleEnd);
}

function startDrag(e) {
  if (e.target.classList.contains("crop-handle")) return;
  
  e.preventDefault();
  isDragging = true;
  
  const pos = getEventPosition(e);
  dragStartX = pos.x;
  dragStartY = pos.y;
  cropStartX = cropBox.x;
  cropStartY = cropBox.y;
}

function startResize(e) {
  e.preventDefault();
  e.stopPropagation();
  isResizing = true;
  resizeHandle = e.target.dataset.handle;
  
  const pos = getEventPosition(e);
  dragStartX = pos.x;
  dragStartY = pos.y;
  cropStartX = cropBox.x;
  cropStartY = cropBox.y;
  cropStartWidth = cropBox.width;
  cropStartHeight = cropBox.height;
}

function handleMove(e) {
  if (!isDragging && !isResizing) return;
  
  e.preventDefault();
  
  const canvas = document.getElementById("capturedCanvas");
  const wrapper = document.getElementById("cropWrapper");
  if (!canvas || !wrapper) return;
  
  const wrapperRect = wrapper.getBoundingClientRect();
  canvasRect = canvas.getBoundingClientRect();
  
  const pos = getEventPosition(e);
  const deltaX = pos.x - dragStartX;
  const deltaY = pos.y - dragStartY;
  
  // キャンバスの境界を計算
  const canvasOffsetX = canvasRect.left - wrapperRect.left;
  const canvasOffsetY = canvasRect.top - wrapperRect.top;
  const canvasRight = canvasOffsetX + canvasRect.width;
  const canvasBottom = canvasOffsetY + canvasRect.height;
  
  if (isDragging) {
    // ドラッグ移動
    let newX = cropStartX + deltaX;
    let newY = cropStartY + deltaY;
    
    // 境界制限
    newX = Math.max(canvasOffsetX, Math.min(newX, canvasRight - cropBox.width));
    newY = Math.max(canvasOffsetY, Math.min(newY, canvasBottom - cropBox.height));
    
    cropBox.x = newX;
    cropBox.y = newY;
  } else if (isResizing) {
    // リサイズ
    const minSize = 50;
    let newX = cropBox.x;
    let newY = cropBox.y;
    let newWidth = cropBox.width;
    let newHeight = cropBox.height;
    
    switch (resizeHandle) {
      case "nw":
        newX = Math.max(canvasOffsetX, Math.min(cropStartX + deltaX, cropStartX + cropStartWidth - minSize));
        newY = Math.max(canvasOffsetY, Math.min(cropStartY + deltaY, cropStartY + cropStartHeight - minSize));
        newWidth = cropStartWidth - (newX - cropStartX);
        newHeight = cropStartHeight - (newY - cropStartY);
        break;
      case "ne":
        newY = Math.max(canvasOffsetY, Math.min(cropStartY + deltaY, cropStartY + cropStartHeight - minSize));
        newWidth = Math.max(minSize, Math.min(cropStartWidth + deltaX, canvasRight - cropStartX));
        newHeight = cropStartHeight - (newY - cropStartY);
        break;
      case "sw":
        newX = Math.max(canvasOffsetX, Math.min(cropStartX + deltaX, cropStartX + cropStartWidth - minSize));
        newWidth = cropStartWidth - (newX - cropStartX);
        newHeight = Math.max(minSize, Math.min(cropStartHeight + deltaY, canvasBottom - cropStartY));
        break;
      case "se":
        newWidth = Math.max(minSize, Math.min(cropStartWidth + deltaX, canvasRight - cropStartX));
        newHeight = Math.max(minSize, Math.min(cropStartHeight + deltaY, canvasBottom - cropStartY));
        break;
      case "n":
        newY = Math.max(canvasOffsetY, Math.min(cropStartY + deltaY, cropStartY + cropStartHeight - minSize));
        newHeight = cropStartHeight - (newY - cropStartY);
        break;
      case "s":
        newHeight = Math.max(minSize, Math.min(cropStartHeight + deltaY, canvasBottom - cropStartY));
        break;
      case "w":
        newX = Math.max(canvasOffsetX, Math.min(cropStartX + deltaX, cropStartX + cropStartWidth - minSize));
        newWidth = cropStartWidth - (newX - cropStartX);
        break;
      case "e":
        newWidth = Math.max(minSize, Math.min(cropStartWidth + deltaX, canvasRight - cropStartX));
        break;
    }
    
    cropBox.x = newX;
    cropBox.y = newY;
    cropBox.width = newWidth;
    cropBox.height = newHeight;
  }
  
  updateCropBoxPosition();
}

function handleEnd() {
  isDragging = false;
  isResizing = false;
  resizeHandle = null;
}

function getEventPosition(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

// ============================================
// OCR処理
// ============================================
async function startOCRProcess() {
  const cropScreen = document.getElementById("cropScreen");
  const processingScreen = document.getElementById("ocrProcessingScreen");
  const processingText = document.getElementById("processingText");
  const progressFill = document.getElementById("ocrProgressFill");
  
  // 重要: 画面を非表示にする前にクロップ画像を取得
  // getBoundingClientRectは要素が表示されている必要がある
  let croppedImage = getCroppedImage();
  
  // クロップ失敗時は元画像を使用
  if (!croppedImage || croppedImage.length < 100) {
    console.log("クロップ失敗、元画像を使用");
    croppedImage = capturedImageData;
  }
  
  // 画面を切り替え
  cropScreen?.classList.add("hidden");
  processingScreen?.classList.remove("hidden");
  
  if (processingText) processingText.textContent = "文字を認識中...";
  if (progressFill) progressFill.style.width = "0%";
  
  try {
    console.log("OCR画像準備完了, 言語:", ocrLang);
    console.log("画像データ長:", croppedImage?.length || 0);
    
    // 画像データの確認
    if (!croppedImage || croppedImage.length < 100) {
      throw new Error("画像データの取得に失敗しました。もう一度撮影してください。");
    }
    
    // OCR実行
    const ocrResult = await performOCR(croppedImage, (progress) => {
      if (progressFill) {
        progressFill.style.width = (progress * 50) + "%"; // OCRは50%まで
      }
    });
    console.log("OCR結果:", ocrResult);
    
    if (!ocrResult || ocrResult.trim() === "") {
      // 文字が認識されなかった場合、確認を求める
      const retry = await poinaviConfirm(
        "文字を認識できませんでした。\n\n" +
        "【確認事項】\n" +
        "・撮影した画像に文字が含まれていますか？\n" +
        "・言語設定は正しいですか？（現在: " + getLangNameFromOcr(ocrLang) + "）\n" +
        "・文字がはっきり見えていますか？\n\n" +
        "再撮影しますか？"
      );
      if (retry) {
        goBackToCamera();
        return;
      } else {
        closeCameraModal();
        return;
      }
    }
    
    if (processingText) processingText.textContent = "翻訳中...";
    if (progressFill) progressFill.style.width = "60%";
    
    // 翻訳実行
    const sourceLangCode = OCR_TO_TRANSLATE_LANG[ocrLang] || "ja";
    const translatedText = await translateText(ocrResult, sourceLangCode, targetLang);
    
    if (progressFill) progressFill.style.width = "100%";
    
    // 結果を表示
    setTimeout(() => {
      closeCameraModal();
      showOCRTranslationResult(ocrResult, translatedText, croppedImage);
    }, 300);
    
  } catch (err) {
    console.error("OCR/翻訳エラー:", err);
    console.error("エラースタック:", err.stack);
    
    // デバッグ情報を含めたエラーメッセージ
    let debugInfo = "";
    try {
      debugInfo = `\n\n【デバッグ情報】\n` +
        `言語: ${ocrLang}\n` +
        `Tesseract: ${typeof Tesseract !== 'undefined' ? 'あり' : 'なし'}\n` +
        `最終ステータス: ${typeof ocrLastStatus !== 'undefined' ? ocrLastStatus : '不明'}\n` +
        `エラー詳細: ${err.message || '不明'}`;
    } catch (e) {
      debugInfo = `\n\nエラー: ${err.message || '不明'}`;
    }
    
    // エラーメッセージを表示して選択肢を提供
    const retry = await poinaviConfirm(
      "処理中にエラーが発生しました" + 
      debugInfo +
      "\n\n再撮影しますか？\n（キャンセルで閉じます）"
    );
    
    if (retry) {
      goBackToCamera();
    } else {
      closeCameraModal();
    }
  }
}

function getCroppedImage() {
  const canvas = document.getElementById("capturedCanvas");
  const wrapper = document.getElementById("cropWrapper");
  const cropBoxEl = document.getElementById("cropBox");
  
  if (!canvas || !wrapper || !cropBoxEl) {
    console.error("Required elements not found");
    return capturedImageData;
  }
  
  console.log("=== getCroppedImage START ===");
  console.log("Canvas actual size:", canvas.width, "x", canvas.height);
  
  // キャンバスが無効な場合は元画像を使用
  if (canvas.width === 0 || canvas.height === 0) {
    console.log("Canvas has no size, using original");
    return capturedImageData;
  }
  
  try {
    // 要素の表示位置を取得
    const canvasRect = canvas.getBoundingClientRect();
    const cropBoxRect = cropBoxEl.getBoundingClientRect();
    
    console.log("Canvas display size:", canvasRect.width, "x", canvasRect.height);
    console.log("Canvas position:", canvasRect.left, canvasRect.top);
    console.log("CropBox display:", cropBoxRect.width, "x", cropBoxRect.height);
    console.log("CropBox position:", cropBoxRect.left, cropBoxRect.top);
    
    // クロップボックスがキャンバス上のどこにあるかを計算
    // （画面座標からの相対位置）
    const relativeLeft = cropBoxRect.left - canvasRect.left;
    const relativeTop = cropBoxRect.top - canvasRect.top;
    const relativeWidth = cropBoxRect.width;
    const relativeHeight = cropBoxRect.height;
    
    console.log("Relative to canvas:", relativeLeft, relativeTop, relativeWidth, relativeHeight);
    
    // 表示サイズから実際のキャンバスピクセルへの変換比率
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    
    console.log("Scale factors:", scaleX, scaleY);
    
    // 実際のキャンバス座標に変換
    let cropX = Math.round(relativeLeft * scaleX);
    let cropY = Math.round(relativeTop * scaleY);
    let cropWidth = Math.round(relativeWidth * scaleX);
    let cropHeight = Math.round(relativeHeight * scaleY);
    
    console.log("Before bounds check:", { cropX, cropY, cropWidth, cropHeight });
    
    // 範囲を0以上に制限
    cropX = Math.max(0, cropX);
    cropY = Math.max(0, cropY);
    
    // キャンバスの範囲内に収める
    if (cropX + cropWidth > canvas.width) {
      cropWidth = canvas.width - cropX;
    }
    if (cropY + cropHeight > canvas.height) {
      cropHeight = canvas.height - cropY;
    }
    
    // 最小サイズチェック
    cropWidth = Math.max(20, cropWidth);
    cropHeight = Math.max(20, cropHeight);
    
    console.log("Final crop params:", { cropX, cropY, cropWidth, cropHeight });
    
    // 有効な範囲かチェック
    if (cropX < 0 || cropY < 0 || cropWidth <= 0 || cropHeight <= 0) {
      console.log("Invalid crop area, using original");
      return capturedImageData;
    }
    
    // クロップしたキャンバスを作成
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    
    const ctx = croppedCanvas.getContext("2d");
    ctx.drawImage(
      canvas,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );
    
    const dataUrl = croppedCanvas.toDataURL("image/png");
    console.log("Cropped image created, data length:", dataUrl.length);
    console.log("=== getCroppedImage END ===");
    
    // 結果が有効か確認
    if (dataUrl && dataUrl.length > 1000) {
      return dataUrl;
    } else {
      console.log("Cropped data too small, using original");
      return capturedImageData;
    }
  } catch (err) {
    console.error("Crop error:", err);
    return capturedImageData;
  }
}

// OCR処理の進捗追跡用
let ocrLastStatus = "";

async function performOCR(imageData, onProgress) {
  const processingText = document.getElementById("processingText");
  ocrLastStatus = "開始";
  
  try {
    console.log("OCR開始, 言語:", ocrLang);
    console.log("Tesseract available:", typeof Tesseract !== 'undefined');
    
    // Tesseractライブラリの存在確認
    if (typeof Tesseract === 'undefined') {
      ocrLastStatus = "ライブラリなし";
      throw new Error("OCRライブラリが読み込まれていません");
    }
    
    if (processingText) processingText.textContent = "OCRエンジンを準備中...";
    ocrLastStatus = "準備中";
    
    console.log("Tesseract.recognize 開始...");
    
    const result = await Tesseract.recognize(imageData, ocrLang, {
      logger: (m) => {
        ocrLastStatus = m.status || "unknown";
        console.log("Tesseract:", m.status, m.progress);
        
        if (processingText) {
          switch (m.status) {
            case "loading tesseract core":
              processingText.textContent = "OCRエンジンを読み込み中...";
              break;
            case "initializing tesseract":
              processingText.textContent = "初期化中...";
              break;
            case "loading language traineddata":
              processingText.textContent = "言語データを読み込み中...";
              break;
            case "loaded language traineddata":
              processingText.textContent = "言語データ読み込み完了";
              break;
            case "initializing api":
              processingText.textContent = "API初期化中...";
              break;
            case "recognizing text":
              processingText.textContent = `文字を認識中... ${Math.round((m.progress || 0) * 100)}%`;
              if (onProgress) onProgress(m.progress);
              break;
          }
        }
      }
    });
    
    ocrLastStatus = "完了";
    console.log("OCR完了, 結果:", result);
    console.log("認識テキスト:", result?.data?.text);
    
    return result.data.text;
    
  } catch (err) {
    console.error("OCRエラー:", err);
    console.error("最後のステータス:", ocrLastStatus);
    
    // 元のエラーメッセージを保持
    const originalError = err.message || String(err);
    throw new Error(`OCRエラー (${ocrLastStatus}): ${originalError}`);
  }
}

// ============================================
// 翻訳API（LibreTranslate - 完全無料）
// ============================================

// LibreTranslateの公開サーバーリスト（フォールバック用）
const LIBRETRANSLATE_SERVERS = [
  "https://libretranslate.com",
  "https://translate.argosopentech.com",
  "https://translate.terraprint.co"
];

let currentServerIndex = 0;

// LibreTranslate用の言語コードマッピング
const LIBRE_LANG_CODES = {
  "ja": "ja",
  "en": "en",
  "zh": "zh",
  "ko": "ko",
  "fr": "fr",
  "de": "de",
  "es": "es",
  "it": "it",
  "pt": "pt",
  "ru": "ru",
  "th": "th",
  "vi": "vi"
};

async function translateTextLibre(text, sourceLang, targetLang) {
  // 同じ言語なら翻訳不要
  if (sourceLang === targetLang) {
    return text;
  }
  
  const source = LIBRE_LANG_CODES[sourceLang] || sourceLang;
  const target = LIBRE_LANG_CODES[targetLang] || targetLang;
  
  // 複数のサーバーを試す
  let lastError = null;
  
  for (let i = 0; i < LIBRETRANSLATE_SERVERS.length; i++) {
    const serverIndex = (currentServerIndex + i) % LIBRETRANSLATE_SERVERS.length;
    const server = LIBRETRANSLATE_SERVERS[serverIndex];
    
    try {
      const result = await translateWithServer(server, text, source, target);
      currentServerIndex = serverIndex; // 成功したサーバーを記憶
      return result;
    } catch (err) {
      console.warn(`サーバー ${server} でエラー:`, err.message);
      lastError = err;
    }
  }
  
  // すべてのサーバーが失敗した場合、MyMemoryにフォールバック
  console.log("LibreTranslate失敗、MyMemoryにフォールバック");
  return translateWithMyMemory(text, sourceLang, targetLang);
}

async function translateWithServer(server, text, source, target) {
  const url = `${server}/translate`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: text,
      source: source,
      target: target,
      format: "text"
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data.translatedText;
}

// MyMemoryへのフォールバック（バックアップ）
async function translateWithMyMemory(text, sourceLang, targetLang) {
  const langPair = `${sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error("翻訳APIエラー");
  }
  
  const data = await response.json();
  
  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || "翻訳に失敗しました");
  }
  
  return data.responseData.translatedText;
}

// カメラ用（既存の関数を維持）
async function translateText(text, sourceLang, targetLang) {
  return translateTextLibre(text, sourceLang, targetLang);
}

async function translateChunk(text, sourceLang, targetLang) {
  return translateTextLibre(text, sourceLang, targetLang);
}

function splitText(text, maxLength) {
  const chunks = [];
  const lines = text.split("\n");
  let currentChunk = "";
  
  for (const line of lines) {
    if ((currentChunk + "\n" + line).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n" + line : line;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// ============================================
// 翻訳結果を表示
// ============================================
function showOCRTranslationResult(originalText, translatedText, imageData) {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  ocrTranslationCount++;
  
  const data = {
    original: originalText,
    translated: translatedText,
    image: imageData
  };
  
  const resultHTML = createTranslationResultHTML("ocr", data);
  
  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) {
    placeholder.remove();
  }
  
  // 以前の最新マークを削除
  resultArea.querySelectorAll(".translate-result-item--latest").forEach(item => {
    item.classList.remove("translate-result-item--latest");
  });
  
  resultArea.insertAdjacentHTML("afterbegin", resultHTML);
  
  // 最新の結果にマークを付ける
  const latestItem = resultArea.querySelector(".translate-result-item");
  if (latestItem) {
    latestItem.classList.add("translate-result-item--latest");
  }
  
  resultArea.scrollTop = 0;
  
  // コピーボタンのイベントを設定
  setupCopyButtons();
}

// ============================================
// 翻訳結果HTMLを生成
// ============================================
function createTranslationResultHTML(type, data) {
  const typeLabels = { voice: "会話モード", ocr: "カメラ", image: "画像" };
  const typeLabel = typeLabels[type] || "翻訳";
  const typeIcons = {
    voice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      </svg>`,
    ocr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>`
  };
  const typeIcon = typeIcons[type] || typeIcons.ocr;
  
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // XSS対策: HTMLエスケープしてから改行を<br>に変換
  const originalText = escapeHtmlForDisplay(data.original || "").replace(/\n/g, '<br>');
  const translatedText = escapeHtmlForDisplay(data.translated || "").replace(/\n/g, '<br>');
  
  // OCRの場合は画像プレビューを追加
  const imagePreview = data.image ? `
    <div class="translate-result-item__ocr-preview">
      <img src="${data.image}" alt="認識した画像" class="translate-result-item__ocr-image" />
    </div>
  ` : "";
  
  // コピー用のプレーンテキスト
  const plainOriginal = data.original || "";
  const plainTranslated = data.translated || "";
  
  // 言語ラベルを取得（音声翻訳の場合はdataから、カメラの場合はグローバル設定から）
  let languageLabel;
  if (data.sourceLang && data.targetLang) {
    languageLabel = `${getLangName(data.sourceLang)} → ${getLangName(data.targetLang)}`;
  } else {
    languageLabel = getLanguageLabel();
  }
  
  return `
    <div class="translate-result-item translate-result-item--${type}" data-original="${encodeURIComponent(plainOriginal)}" data-translated="${encodeURIComponent(plainTranslated)}">
      <div class="translate-result-item__header">
        <span class="translate-result-item__icon">${typeIcon}</span>
        <span class="translate-result-item__label">${typeLabel}</span>
        <span class="translate-result-item__lang">${languageLabel}</span>
        <span class="translate-result-item__time">${timeStr}</span>
      </div>
      ${imagePreview}
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
      <div class="translate-result-item__actions">
        <button class="translate-result-item__action-btn copy-original-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>原文をコピー</span>
        </button>
        <button class="translate-result-item__action-btn add-to-memo-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <span>ラボノートに追加</span>
        </button>
      </div>
    </div>
  `;
}

// ============================================
// コピー機能
// ============================================
function setupCopyButtons() {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  // 原文コピーボタン
  resultArea.querySelectorAll(".copy-original-btn").forEach(btn => {
    btn.onclick = function() {
      const item = this.closest(".translate-result-item");
      const text = decodeURIComponent(item.dataset.original || "");
      copyToClipboard(text, this);
    };
  });
  
  // ラボノートに追加ボタン
  resultArea.querySelectorAll(".add-to-memo-btn").forEach(btn => {
    btn.onclick = function() {
      const item = this.closest(".translate-result-item");
      const original = decodeURIComponent(item.dataset.original || "");
      const translated = decodeURIComponent(item.dataset.translated || "");
      const memoText = `${original}\n\n↓\n\n${translated}`;
      addToMemo(memoText, this);
    };
  });
}

// ============================================
// メモ機能連携
// ============================================
const MEMO_STORAGE_KEY = "poinavi_memos";
const MEMO_MAX_COUNT = 50;

function getMemos() {
  try {
    const data = localStorage.getItem(MEMO_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("メモの読み込みに失敗:", e);
    return [];
  }
}

function saveMemos(memos) {
  try {
    localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos));
  } catch (e) {
    console.error("メモの保存に失敗:", e);
    poinaviAlert("メモの保存に失敗しました。ストレージ容量を確認してください。");
  }
}

function addToMemo(content, button) {
  if (!content || !content.trim()) return;
  
  const memos = getMemos();
  
  // 上限チェック
  if (memos.length >= MEMO_MAX_COUNT) {
    poinaviAlert("上限（" + MEMO_MAX_COUNT + "件）に達しています。\n不要なメモを整理して再度追加してください。");
    return;
  }
  
  const newMemo = {
    id: Date.now().toString(),
    content: content.trim(),
    createdAt: new Date().toISOString()
  };
  memos.unshift(newMemo);
  saveMemos(memos);
  
  poinaviAlert("ラボノートに追加しました");
  
  // ボタンの表示を一時的に変更
  const originalText = button.querySelector("span").textContent;
  button.querySelector("span").textContent = "追加しました";
  button.classList.add("translate-result-item__action-btn--copied");
  
  setTimeout(() => {
    button.querySelector("span").textContent = originalText;
    button.classList.remove("translate-result-item__action-btn--copied");
  }, 1500);
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    
    // ボタンの表示を変更
    button.classList.add("translate-result-item__action-btn--copied");
    const span = button.querySelector("span");
    const originalText = span.textContent;
    span.textContent = "コピーしました";
    
    // 2秒後に元に戻す
    setTimeout(() => {
      button.classList.remove("translate-result-item__action-btn--copied");
      span.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error("コピーに失敗しました:", err);
  }
}

// ============================================
// QRコードスキャン機能
// ============================================
let qrStream = null;
let qrScanning = false;
let barcodeDetector = null;
let jsQRLoaded = false;

// BarcodeDetector APIのサポートチェック
function isBarcodeDetectorSupported() {
  return 'BarcodeDetector' in window;
}

// jsQRライブラリを動的に読み込み（iOS用フォールバック）
async function loadJsQR() {
  if (jsQRLoaded) return true;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.onload = () => {
      jsQRLoaded = true;
      resolve(true);
    };
    script.onerror = () => reject(new Error('jsQRの読み込みに失敗しました'));
    document.head.appendChild(script);
  });
}

// QRコードスキャン初期化
function initQRScanner() {
  const qrScanBtn = document.getElementById('qrScanBtn');
  const qrModal = document.getElementById('qrModal');
  const qrCloseBtn = document.getElementById('qrCloseBtn');
  const qrVideo = document.getElementById('qrVideo');
  const qrResult = document.getElementById('qrResult');
  const qrResultText = document.getElementById('qrResultText');
  const qrCopyBtn = document.getElementById('qrCopyBtn');
  const qrOpenBtn = document.getElementById('qrOpenBtn');
  
  if (!qrScanBtn || !qrModal) return;
  
  // QRスキャンボタン
  qrScanBtn.addEventListener('click', async () => {
    try {
      // BarcodeDetector初期化
      if (isBarcodeDetectorSupported()) {
        barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      } else {
        // iOSなど非対応ブラウザ用にjsQRを読み込み
        await loadJsQR();
      }
      
      // カメラ起動
      qrStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      qrVideo.srcObject = qrStream;
      qrModal.classList.remove('hidden');
      qrResult.classList.add('hidden');
      qrScanning = true;
      
      // 履歴に状態を追加（Android戻るボタン対応）
      history.pushState({ modal: "qr" }, "");
      
      // スキャン開始
      scanQRCode();
    } catch (err) {
      console.error('QRスキャナーの起動に失敗:', err);
      if (err.name === 'NotAllowedError') {
        poinaviAlert('カメラへのアクセスが許可されていません。\n設定からカメラへのアクセスを許可してください。');
      } else {
        poinaviAlert('QRコードスキャナーを起動できませんでした。');
      }
    }
  });
  
  // 閉じるボタン
  qrCloseBtn.addEventListener('click', () => {
    stopQRScanner();
  });
  
  // コピーボタン
  qrCopyBtn.addEventListener('click', async () => {
    const text = qrResultText.textContent;
    try {
      await navigator.clipboard.writeText(text);
      qrCopyBtn.textContent = 'コピーしました';
      setTimeout(() => {
        qrCopyBtn.textContent = 'コピー';
      }, 2000);
    } catch (err) {
      console.error('コピーに失敗:', err);
    }
  });
  
  // 開くボタン
  qrOpenBtn.addEventListener('click', () => {
    const text = qrResultText.textContent;
    // URLの場合は開く
    if (text.startsWith('http://') || text.startsWith('https://')) {
      // URL安全確認
      if (isUrlSafe(text)) {
        window.open(text, '_blank', 'noopener,noreferrer');
      } else {
        // 警告付きで確認
        poinaviConfirm('このURLを開きますか？\n\n' + text + '\n\n※不審なURLの可能性があります。信頼できるURLのみ開いてください。').then(ok => {
          if (ok) window.open(text, '_blank', 'noopener,noreferrer');
        });
      }
    } else {
      // URLでない場合はGoogle検索
      window.open('https://www.google.com/search?q=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
    }
  });
}

// ============================================
// URL安全確認
// ============================================
function isUrlSafe(url) {
  try {
    const parsed = new URL(url);
    
    // HTTPSでない場合は警告対象
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    // 危険なドメインパターン（フィッシングなど）
    const suspiciousPatterns = [
      /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/, // IPアドレス直接
      /-login/i,
      /signin.*\./i,
      /account.*verify/i,
      /secure.*update/i,
      /\.tk$/,
      /\.ml$/,
      /\.ga$/,
      /\.cf$/
    ];
    
    const hostname = parsed.hostname;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(hostname) || pattern.test(url)) {
        return false;
      }
    }
    
    // 非常に長いURLは警告
    if (url.length > 500) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

// QRコードスキャン処理
async function scanQRCode() {
  const qrVideo = document.getElementById('qrVideo');
  const qrResult = document.getElementById('qrResult');
  const qrResultText = document.getElementById('qrResultText');
  
  if (!qrScanning) return;
  
  try {
    if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
      let qrData = null;
      
      if (barcodeDetector) {
        // BarcodeDetector API使用
        const barcodes = await barcodeDetector.detect(qrVideo);
        if (barcodes.length > 0) {
          qrData = barcodes[0].rawValue;
        }
      } else if (window.jsQR) {
        // jsQR使用（iOSフォールバック）
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = qrVideo.videoWidth;
        canvas.height = qrVideo.videoHeight;
        ctx.drawImage(qrVideo, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          qrData = code.data;
        }
      }
      
      if (qrData) {
        // QRコード検出成功
        qrResultText.textContent = qrData;
        qrResult.classList.remove('hidden');
        
        // バイブレーション（対応端末のみ）
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        
        // 一時停止（結果表示中）
        qrScanning = false;
        return;
      }
    }
  } catch (err) {
    console.error('QRコードスキャンエラー:', err);
  }
  
  // 継続スキャン
  if (qrScanning) {
    requestAnimationFrame(scanQRCode);
  }
}

// QRスキャナー停止
function stopQRScanner() {
  const qrModal = document.getElementById('qrModal');
  
  qrScanning = false;
  
  if (qrStream) {
    qrStream.getTracks().forEach(track => track.stop());
    qrStream = null;
  }
  
  if (qrModal && !qrModal.classList.contains('hidden')) {
    qrModal.classList.add('hidden');
  }
}

// QRモーダルを閉じる（Android戻るボタン対応用のエイリアス）
function closeQrModal() {
  stopQRScanner();
}

// 初期化時にQRスキャナーも初期化
document.addEventListener('DOMContentLoaded', function() {
  // 既存の初期化処理は維持...
  initQRScanner();
});
