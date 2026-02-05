// ============================================
// ぽいナビ 翻訳ページ - メインスクリプト
// ============================================

// ============================================
// グローバル変数
// ============================================

// 翻訳結果カウンター
let voiceTranslationCount = 0;
let ocrTranslationCount = 0;

// 現在の言語設定
let ocrLang = localStorage.getItem("poinavi_ocr_lang") || "jpn";
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

// 翻訳API（MyMemory - 無料）
const TRANSLATE_API_URL = "https://api.mymemory.translated.net/get";

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
  initDisclaimerModal();
  initThemeToggle();
  initLanguageSelect();
  initCameraModal();
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
  const ocrSelect = document.getElementById("ocrLanguageSelect");
  const targetSelect = document.getElementById("translateTargetLang");
  
  if (!ocrSelect || !targetSelect) return;

  // 保存された言語を復元
  ocrSelect.value = ocrLang;
  targetSelect.value = targetLang;

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
// 音声翻訳の初期化（ダミー版）
// ============================================
const DUMMY_VOICE_TRANSLATIONS = [
  {
    original: "Excuse me, where is the nearest station?",
    translated: "すみません、一番近い駅はどこですか？"
  },
  {
    original: "How much is this?",
    translated: "これはいくらですか？"
  },
  {
    original: "Could you take a picture of us?",
    translated: "写真を撮っていただけますか？"
  }
];

function initVoiceTranslation() {
  const voiceBtn = document.getElementById("voiceTranslateBtn");
  
  if (!voiceBtn) return;
  
  voiceBtn.addEventListener("click", function() {
    voiceBtn.classList.add("active");
    
    setTimeout(function() {
      voiceBtn.classList.remove("active");
      showVoiceTranslationResult();
    }, 1500);
  });
}

function showVoiceTranslationResult() {
  const resultArea = document.getElementById("translateResultArea");
  if (!resultArea) return;
  
  const data = DUMMY_VOICE_TRANSLATIONS[voiceTranslationCount % DUMMY_VOICE_TRANSLATIONS.length];
  voiceTranslationCount++;
  
  const resultHTML = createTranslationResultHTML("voice", data);
  
  const placeholder = resultArea.querySelector(".translate-result-placeholder");
  if (placeholder) {
    placeholder.remove();
  }
  
  resultArea.insertAdjacentHTML("afterbegin", resultHTML);
  resultArea.scrollTop = 0;
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
  
  // カメラを起動
  startCamera();
}

function closeCameraModal() {
  const modal = document.getElementById("cameraModal");
  if (modal) {
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
  
  cropScreen?.classList.add("hidden");
  processingScreen?.classList.remove("hidden");
  
  if (processingText) processingText.textContent = "文字を認識中...";
  if (progressFill) progressFill.style.width = "0%";
  
  try {
    // クロップした画像を取得
    const croppedImage = getCroppedImage();
    console.log("クロップ画像取得完了, OCR言語:", ocrLang);
    
    // OCR実行
    const ocrResult = await performOCR(croppedImage, (progress) => {
      if (progressFill) {
        progressFill.style.width = (progress * 50) + "%"; // OCRは50%まで
      }
    });
    console.log("OCR結果:", ocrResult);
    
    if (!ocrResult || ocrResult.trim() === "") {
      throw new Error("文字を認識できませんでした");
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
    
    // エラーメッセージを表示して選択肢を提供
    const retry = confirm(
      (err.message || "処理中にエラーが発生しました") + 
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
  
  if (!canvas || !wrapper) return null;
  
  const wrapperRect = wrapper.getBoundingClientRect();
  canvasRect = canvas.getBoundingClientRect();
  
  // クロップボックスのキャンバス上の位置を計算
  const canvasOffsetX = canvasRect.left - wrapperRect.left;
  const canvasOffsetY = canvasRect.top - wrapperRect.top;
  
  const cropX = (cropBox.x - canvasOffsetX) * (canvas.width / canvasRect.width);
  const cropY = (cropBox.y - canvasOffsetY) * (canvas.height / canvasRect.height);
  const cropWidth = cropBox.width * (canvas.width / canvasRect.width);
  const cropHeight = cropBox.height * (canvas.height / canvasRect.height);
  
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
  
  return croppedCanvas.toDataURL("image/jpeg", 0.9);
}

async function performOCR(imageData, onProgress) {
  try {
    // 処理中のテキストを更新
    const processingText = document.getElementById("processingText");
    
    // Tesseract.js を使用してOCR実行
    const result = await Tesseract.recognize(imageData, ocrLang, {
      logger: (m) => {
        console.log("Tesseract:", m.status, m.progress);
        
        // ステータスに応じてUIを更新
        if (processingText) {
          if (m.status === "loading tesseract core") {
            processingText.textContent = "OCRエンジンを読み込み中...";
          } else if (m.status === "initializing tesseract") {
            processingText.textContent = "OCRエンジンを初期化中...";
          } else if (m.status === "loading language traineddata") {
            processingText.textContent = "言語データを読み込み中...";
          } else if (m.status === "initializing api") {
            processingText.textContent = "APIを初期化中...";
          } else if (m.status === "recognizing text") {
            processingText.textContent = "文字を認識中...";
            if (onProgress) {
              onProgress(m.progress);
            }
          }
        }
      }
    });
    
    return result.data.text;
  } catch (err) {
    console.error("OCRエラー:", err);
    
    // エラーの種類に応じてメッセージを変更
    if (err.message && err.message.includes("network")) {
      throw new Error("ネットワークエラー: 言語データの読み込みに失敗しました");
    } else if (err.message && err.message.includes("language")) {
      throw new Error("言語データの読み込みに失敗しました。別の言語を試してください");
    }
    
    throw new Error("文字認識に失敗しました。もう一度お試しください");
  }
}

// ============================================
// 翻訳API
// ============================================
async function translateText(text, sourceLang, targetLang) {
  // 同じ言語なら翻訳不要
  if (sourceLang === targetLang) {
    return text;
  }
  
  // 文字数が多い場合は分割
  const MAX_CHARS = 500;
  if (text.length > MAX_CHARS) {
    const chunks = splitText(text, MAX_CHARS);
    const translatedChunks = [];
    
    for (const chunk of chunks) {
      const translated = await translateChunk(chunk, sourceLang, targetLang);
      translatedChunks.push(translated);
    }
    
    return translatedChunks.join("\n");
  }
  
  return translateChunk(text, sourceLang, targetLang);
}

async function translateChunk(text, sourceLang, targetLang) {
  try {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = `${TRANSLATE_API_URL}?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("翻訳APIエラー");
    }
    
    const data = await response.json();
    
    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || "翻訳に失敗しました");
    }
    
    return data.responseData.translatedText;
  } catch (err) {
    console.error("翻訳エラー:", err);
    throw new Error("翻訳に失敗しました。しばらく待ってからお試しください。");
  }
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
  
  resultArea.insertAdjacentHTML("afterbegin", resultHTML);
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
  
  const originalText = (data.original || "").replace(/\n/g, '<br>');
  const translatedText = (data.translated || "").replace(/\n/g, '<br>');
  
  // OCRの場合は画像プレビューを追加
  const imagePreview = data.image ? `
    <div class="translate-result-item__ocr-preview">
      <img src="${data.image}" alt="認識した画像" class="translate-result-item__ocr-image" />
    </div>
  ` : "";
  
  // コピー用のプレーンテキスト
  const plainOriginal = data.original || "";
  const plainTranslated = data.translated || "";
  
  return `
    <div class="translate-result-item translate-result-item--${type}" data-original="${encodeURIComponent(plainOriginal)}" data-translated="${encodeURIComponent(plainTranslated)}">
      <div class="translate-result-item__header">
        <span class="translate-result-item__icon">${typeIcon}</span>
        <span class="translate-result-item__label">${typeLabel}</span>
        <span class="translate-result-item__lang">${getLanguageLabel()}</span>
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
        <button class="translate-result-item__action-btn copy-translated-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>翻訳をコピー</span>
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
  
  // 翻訳コピーボタン
  resultArea.querySelectorAll(".copy-translated-btn").forEach(btn => {
    btn.onclick = function() {
      const item = this.closest(".translate-result-item");
      const text = decodeURIComponent(item.dataset.translated || "");
      copyToClipboard(text, this);
    };
  });
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
