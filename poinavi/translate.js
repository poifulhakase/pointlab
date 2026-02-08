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

// 言語コードから表示名
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
  initResetButton();
  initSettingsModal();
  initThemeToggle();
  initLanguageSelect();
  initCameraModal();
  initStartPageSelect();
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
    // 履歴に状態を追加（Android戻るボタン対応）
    history.pushState({ modal: "translateSettings" }, "");
  });

  closeBtn.addEventListener("click", function() {
    modal.classList.add("hidden");
  });

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
    
    // 設定モーダルが開いている場合は閉じる
    if (settingsModal && !settingsModal.classList.contains("hidden")) {
      settingsModal.classList.add("hidden");
      return;
    }
  });
}

// 翻訳設定を初期化
function resetTranslateSettings() {
  if (!confirm("すべての設定を初期化しますか？\n（言語設定、テーマ、起動ページなどがリセットされます）")) {
    return;
  }
  
  // localStorageから翻訳関連の設定を削除
  localStorage.removeItem("poinavi_ocr_lang");
  localStorage.removeItem("poinavi_target_lang");
  localStorage.removeItem("poinavi_mic_input_lang");
  localStorage.removeItem("poinavi_mic_output_lang");
  localStorage.removeItem("poinavi_theme");
  localStorage.removeItem("poinavi_start_page");
  
  // ページをリロードして初期状態に戻す
  alert("設定を初期化しました。ページを再読み込みします。");
  location.reload();
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
  }
  if (micTargetSelect) {
    const savedMicTarget = localStorage.getItem("poinavi_mic_output_lang") || "ja";
    micTargetSelect.value = savedMicTarget;
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

  // 音声入力言語の変更
  if (micInputSelect) {
    micInputSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_mic_input_lang", this.value);
    });
  }

  // 音声出力言語の変更
  if (micTargetSelect) {
    micTargetSelect.addEventListener("change", function() {
      localStorage.setItem("poinavi_mic_output_lang", this.value);
    });
  }
}

// 言語コードから表示名を取得
function getLangName(code) {
  return LANG_NAMES[code] || code;
}

// 現在の言語設定から表示テキストを取得
function getLanguageLabel() {
  const sourceLangCode = OCR_TO_TRANSLATE_LANG[ocrLang] || "ja";
  return `${getLangName(sourceLangCode)} → ${getLangName(targetLang)}`;
}

// ============================================
// 音声翻訳の初期化（Web Speech API版）
// ============================================
function initVoiceTranslation() {
  const voiceBtn = document.getElementById("voiceTranslateBtn");
  
  if (!voiceBtn) return;
  
  // Web Speech API のサポート確認
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("Web Speech APIがサポートされていません");
    voiceBtn.addEventListener("click", function() {
      alert("お使いのブラウザは音声認識に対応していません。\nChrome、Edge、Safariをお試しください。");
    });
    return;
  }
  
  // 音声認識の初期化
  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.maxAlternatives = 1;
  
  // イベントハンドラ
  speechRecognition.onstart = function() {
    isListening = true;
    voiceBtn.classList.add("active");
    voiceBtn.classList.add("listening");
    updateVoiceButtonState("listening");
  };
  
  speechRecognition.onend = function() {
    isListening = false;
    voiceBtn.classList.remove("active");
    voiceBtn.classList.remove("listening");
    updateVoiceButtonState("idle");
  };
  
  speechRecognition.onerror = function(event) {
    console.error("音声認識エラー:", event.error);
    isListening = false;
    voiceBtn.classList.remove("active");
    voiceBtn.classList.remove("listening");
    updateVoiceButtonState("idle");
    
    if (event.error === "no-speech") {
      alert("音声が検出されませんでした。\nもう一度お試しください。");
    } else if (event.error === "not-allowed") {
      alert("マイクへのアクセスが許可されていません。\n設定からマイクへのアクセスを許可してください。");
    } else if (event.error === "network") {
      alert("ネットワークエラーが発生しました。\nインターネット接続を確認してください。");
    }
  };
  
  speechRecognition.onresult = async function(event) {
    const result = event.results[event.results.length - 1];
    
    if (result.isFinal) {
      const transcript = result[0].transcript;
      console.log("認識結果:", transcript);
      
      // 翻訳処理
      await processVoiceTranslation(transcript);
    }
  };
  
  // ボタンクリックイベント
  voiceBtn.addEventListener("click", function() {
    if (isListening) {
      // 停止
      speechRecognition.stop();
    } else {
      // 開始
      startVoiceRecognition();
    }
  });
}

function startVoiceRecognition() {
  if (!speechRecognition) return;
  
  // 設定から入力言語を取得
  const micInputLang = document.getElementById("micInputLangSelect")?.value || "en";
  const langCode = SPEECH_LANG_CODES[micInputLang] || "en-US";
  
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

function updateVoiceButtonState(state) {
  const voiceLabel = document.querySelector(".translate-voice-label");
  if (!voiceLabel) return;
  
  switch (state) {
    case "listening":
      voiceLabel.textContent = "聞き取り中...";
      break;
    case "translating":
      voiceLabel.textContent = "翻訳中...";
      break;
    default:
      voiceLabel.textContent = "音声翻訳";
  }
}

// 翻訳入力の最大文字数
const TRANSLATE_MAX_LENGTH = 5000;

async function processVoiceTranslation(transcript) {
  const voiceBtn = document.getElementById("voiceTranslateBtn");
  
  updateVoiceButtonState("translating");
  voiceBtn?.classList.add("active");
  
  try {
    // 文字数チェック
    if (transcript.length > TRANSLATE_MAX_LENGTH) {
      alert("テキストが長すぎます。" + TRANSLATE_MAX_LENGTH + "文字以内にしてください。");
      return;
    }
    
    // 設定から言語を取得
    const micInputLang = document.getElementById("micInputLangSelect")?.value || "en";
    const micTargetLang = document.getElementById("micTargetLangSelect")?.value || "ja";
    
    // 翻訳実行
    const translatedText = await translateTextLibre(transcript, micInputLang, micTargetLang);
    
    // 結果を表示
    showVoiceTranslationResult(transcript, translatedText, micInputLang, micTargetLang);
    
    // 翻訳結果を読み上げ（オプション）
    speakText(translatedText, micTargetLang);
    
  } catch (err) {
    console.error("翻訳エラー:", err);
    alert("翻訳に失敗しました。\n" + err.message);
  } finally {
    voiceBtn?.classList.remove("active");
    updateVoiceButtonState("idle");
  }
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
// カメラ翻訳の初期化
// ============================================
function initCameraTranslation() {
  const cameraBtn = document.getElementById("cameraTranslateBtn");
  
  if (!cameraBtn) return;
  
  cameraBtn.addEventListener("click", function() {
    openCameraModal();
  });
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
    
    if (confirm("翻訳結果をすべて削除しますか？")) {
      resetTranslationArea();
    }
  });
}

function resetTranslationArea() {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  resultArea.innerHTML = `
    <div class="translate-result-placeholder">
      <p>翻訳結果がここに表示されます</p>
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
    alert("カメラへのアクセスが許可されていません。\n設定からカメラへのアクセスを許可してください。");
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
      const retry = confirm(
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
    const retry = confirm(
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

// カメラ翻訳用（既存の関数を維持）
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
  const typeLabel = type === "voice" ? "音声翻訳" : "カメラ翻訳";
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
  
  // 言語ラベルを取得（音声翻訳の場合はdataから、カメラ翻訳の場合はグローバル設定から）
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
          <span>メモに追加</span>
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
  
  // メモに追加ボタン
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
    alert("メモの保存に失敗しました。ストレージ容量を確認してください。");
  }
}

function addToMemo(content, button) {
  if (!content || !content.trim()) return;
  
  const memos = getMemos();
  
  // 上限チェック
  if (memos.length >= MEMO_MAX_COUNT) {
    alert("上限（" + MEMO_MAX_COUNT + "件）に達しています。\n不要なメモを整理して再度追加してください。");
    return;
  }
  
  const newMemo = {
    id: Date.now().toString(),
    content: content.trim(),
    createdAt: new Date().toISOString()
  };
  memos.unshift(newMemo);
  saveMemos(memos);
  
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
        alert('カメラへのアクセスが許可されていません。\n設定からカメラへのアクセスを許可してください。');
      } else {
        alert('QRコードスキャナーを起動できませんでした。');
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
        if (confirm('このURLを開きますか？\n\n' + text + '\n\n※不審なURLの可能性があります。信頼できるURLのみ開いてください。')) {
          window.open(text, '_blank', 'noopener,noreferrer');
        }
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
