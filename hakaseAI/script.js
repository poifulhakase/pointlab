// ========================================
// ハカセAI - フロントエンド
// ========================================

// DOM要素
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const settingsModalClose = document.getElementById('settingsModalClose');
const settingsModalOverlay = document.querySelector('.settings-modal__overlay');
const themeToggle = document.getElementById('themeToggle');

// 免責事項モーダル
const infoButton = document.getElementById('infoButton');
const disclaimerModal = document.getElementById('disclaimerModal');
const disclaimerModalClose = document.getElementById('disclaimerModalClose');
const disclaimerModalOverlay = disclaimerModal?.querySelector('.settings-modal__overlay');

// 会話履歴（コンテキスト保持用）
let conversationHistory = [];

// 保存されたメッセージ（表示用）
let savedMessages = [];

// APIエンドポイント
const API_ENDPOINT = '/api/chat';

// LocalStorageのキー
const STORAGE_KEY_HISTORY = 'hakaseai-conversation-history';
const STORAGE_KEY_MESSAGES = 'hakaseai-messages';

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // 入力監視
  userInput.addEventListener('input', handleInputChange);
  userInput.addEventListener('keydown', handleKeyDown);
  
  // 送信ボタン
  sendButton.addEventListener('click', sendMessage);
  
  // テキストエリア自動リサイズ
  userInput.addEventListener('input', autoResize);
  
  // 設定モーダル
  settingsButton.addEventListener('click', openSettingsModal);
  settingsModalClose.addEventListener('click', closeSettingsModal);
  settingsModalOverlay.addEventListener('click', closeSettingsModal);
  
  // 免責事項モーダル
  if (infoButton && disclaimerModal) {
    infoButton.addEventListener('click', openDisclaimerModal);
    disclaimerModalClose.addEventListener('click', closeDisclaimerModal);
    disclaimerModalOverlay.addEventListener('click', closeDisclaimerModal);
  }
  
  // テーマ切り替え
  themeToggle.addEventListener('click', toggleDarkMode);
  
  // 履歴クリアボタン
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearHistory);
  }
  
  // 保存されたテーマを適用
  loadSavedTheme();
  
  // 言語に応じたUI設定
  applyLanguageSettings();
  
  // 履歴があるか確認
  const hasHistory = checkHasHistory();
  
  // 初期メッセージを表示（履歴がない場合はアニメーション付き）
  showInitialMessage(!hasHistory);
  
  // 保存された会話履歴を読み込み・表示
  loadSavedHistory();
});

// ========================================
// 言語に応じたUI設定
// ========================================
function applyLanguageSettings() {
  const userLang = detectUserLanguage();
  
  if (userLang === 'en') {
    // 英語UI
    userInput.placeholder = 'Ask me anything...';
    
    // 設定モーダル
    const settingsTitle = document.getElementById('settingsTitle');
    const themeLabel = document.getElementById('themeLabel');
    const historyLabel = document.getElementById('historyLabel');
    const clearHistoryText = document.getElementById('clearHistoryText');
    
    if (settingsTitle) settingsTitle.textContent = 'Settings';
    if (themeLabel) themeLabel.textContent = 'Theme';
    if (historyLabel) historyLabel.textContent = 'History';
    if (clearHistoryText) clearHistoryText.textContent = 'Clear History';
    
    // フッター
    const footerDisclaimer = document.getElementById('footerDisclaimer');
    if (footerDisclaimer) footerDisclaimer.innerHTML = '*This is an<br>Entertainment AI';
  } else {
    // 日本語UI（デフォルト）
    userInput.placeholder = '相談してみる';
  }
}

// ========================================
// 履歴チェック
// ========================================
function checkHasHistory() {
  try {
    const savedMessagesStr = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (savedMessagesStr) {
      const messages = JSON.parse(savedMessagesStr);
      return messages.length > 0;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// ========================================
// 言語検出
// ========================================
function detectUserLanguage() {
  const lang = navigator.language || navigator.userLanguage || 'ja';
  // 日本語かどうかを判定
  return lang.startsWith('ja') ? 'ja' : 'en';
}

// ========================================
// マガジン一覧データ（キーワードマッチング用）
// バックエンドのプロンプトと同じURLを使用すること
// ========================================
const MAGAZINES = [
  {
    id: 'poikatsu',
    name: 'ポイ活３分レシピ 〜 ぽいふる博士の料理本',
    image: '../images/Poikatsu_3min_Recipe_cooking_class.jpg',
    url: 'https://note.com/pointlab/m/m4188c60f3c9f',
    keywords: ['ポイ活', 'ポイント', '節約', 'お得', 'クーポン', 'キャッシュバック', '還元', 'マイル', '楽天', 'PayPay', 'dポイント', 'Tポイント', 'クレジットカード', 'ショッピング', '買い物']
  },
  {
    id: 'stock',
    name: '株式トレード研究室 〜 ぽいふる博士の研究録',
    image: '../images/Stock_Trade_Lab_TradingView.png',
    url: 'https://note.com/pointlab/m/mb8056cb0b8ee',
    keywords: ['株式', '投資', 'チャート', '配当', '株価', '銘柄', '証券', 'NISA', 'つみたて', '資産運用']
  },
  {
    id: 'tax',
    name: '個人事業主の節税限界点 〜 ぽよん君の大冒険',
    image: '../images/Sole_Proprietor_Kaigyo_thumbnail.png',
    url: 'https://note.com/pointlab/m/mbb26c895445e',
    keywords: ['節税', '税金', '確定申告', '個人事業主', 'フリーランス', '経費', '控除', '青色申告', '白色申告', '所得税', '住民税', '消費税', 'インボイス', '帳簿', '会計']
  },
  {
    id: 'side-biz',
    name: '普通じゃない副業図鑑 〜 ぽいふる博士の見聞録',
    image: '../images/Compass_for_Living_career_eye_catching_parallel_carrier.jpg',
    url: 'https://note.com/pointlab/m/m7be629812c81',
    keywords: ['副業', 'サイドビジネス', '稼ぐ', '収入', '起業', 'ビジネス', '独立', '在宅', 'リモート', '不労所得', 'お金', '金融']
  },
  {
    id: 'rashimban',
    name: '生き方の羅針盤 〜 ぽいふる博士の人生録',
    image: '../images/Compass_for_Living_find_eye_catching_find.jpg',
    url: 'https://note.com/pointlab/m/m5d690faf7df5',
    keywords: ['生き方', '人生', '生活', '暮らし', 'らしんばん', '羅針盤', 'ライフ', 'life', '幸せ', '幸福', '目標', '夢', 'キャリア', '仕事', '働き方', '博士']
  }
];

// ========================================
// 初期メッセージ表示
// ========================================
function showInitialMessage(animate = true) {
  const userLang = detectUserLanguage();
  const initialText = userLang === 'en' 
    ? 'Hello there! I am "Dr. Poiful".\nFeel free to ask me anything about saving money and maximizing rewards. Let\'s figure it out together!'
    : 'やあ、諸君。わしは「ぽいふる博士」じゃ。\n節約やポイント活用について、何でも聞いてくれ。一緒に考えようではないか。';
  const now = new Date();
  const time = formatTime(now);
  
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'message-wrapper hakase-wrapper';
  
  if (animate) {
    messageWrapper.innerHTML = `
      <div class="avatar">
        <img src="hakase.png" alt="ハカセ" class="avatar-img">
      </div>
      <div class="message-group">
        <div class="message-bubble hakase-bubble">
          <p class="typing-text"></p>
        </div>
        <span class="message-time">${time}</span>
      </div>
    `;
    chatContainer.appendChild(messageWrapper);
    
    // タイピングアニメーション
    const textElement = messageWrapper.querySelector('.typing-text');
    typeText(textElement, initialText);
  } else {
    messageWrapper.innerHTML = `
      <div class="avatar">
        <img src="hakase.png" alt="ハカセ" class="avatar-img">
      </div>
      <div class="message-group">
        <div class="message-bubble hakase-bubble">
          <p>${escapeHtml(initialText)}</p>
        </div>
        <span class="message-time">${time}</span>
      </div>
    `;
    chatContainer.appendChild(messageWrapper);
  }
}

// ========================================
// マガジン関連表示（回答内のnoteリンクからマガジンを検出）
// ========================================

// 回答内容からnote.comのリンクを抽出
function extractNoteLink(responseText) {
  const noteUrlPattern = /https?:\/\/note\.com\/pointlab\/[^\s）」』\]<>]+/g;
  const matches = responseText.match(noteUrlPattern);
  return matches ? matches[0] : null;
}

// noteリンクのURLからマガジンを特定
function findMagazineByNoteUrl(noteUrl) {
  if (!noteUrl) return null;
  
  // URLからマガジンID（/m/xxxxx の部分）を抽出
  const magazineIdMatch = noteUrl.match(/\/m\/([a-zA-Z0-9]+)/);
  if (!magazineIdMatch) return null;
  
  const urlMagazineId = magazineIdMatch[1];
  
  // マガジン一覧からURLが一致するものを探す
  for (const magazine of MAGAZINES) {
    if (magazine.url.includes(urlMagazineId)) {
      return magazine;
    }
  }
  
  return null;
}

// 博士の吹き出し内にマガジンバナーを追加
function addMagazineBannerToBubble(container, responseText) {
  // 回答内からnoteリンクを抽出
  const noteUrl = extractNoteLink(responseText);
  
  // リンクがない場合は表示しない
  if (!noteUrl) {
    container.remove();
    return;
  }
  
  // URLからマガジン情報を取得
  const matchedMagazine = findMagazineByNoteUrl(noteUrl);
  
  if (!matchedMagazine) {
    container.remove();
    return;
  }
  
  // 博士が提案したリンクをそのまま使用（画像のみ、横幅いっぱい）
  container.innerHTML = `
    <div class="magazine-banner">
      <a href="${noteUrl}" target="_blank" rel="noopener noreferrer" class="magazine-banner__link">
        <img src="${matchedMagazine.image}" alt="${matchedMagazine.name}" class="magazine-banner__image" loading="lazy">
      </a>
    </div>
  `;
  
  scrollToBottom();
}

// ========================================
// 入力ハンドラー
// ========================================
function handleInputChange() {
  const hasText = userInput.value.trim().length > 0;
  sendButton.disabled = !hasText;
}

function handleKeyDown(e) {
  // Shift+Enter以外のEnterで送信
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendButton.disabled) {
      sendMessage();
    }
  }
}

function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 100) + 'px';
}

// ========================================
// 機密情報検出
// ========================================
const SENSITIVE_KEYWORDS = [
  'パスワード', 'password', 'pwd',
  'クレジットカード', 'credit card', 'カード番号',
  '暗証番号', 'pin', 'ピン番号',
  '口座番号', '銀行口座', 'bank account',
  'マイナンバー', '社会保障番号', 'ssn',
  '秘密の質問', 'secret question',
  'cvv', 'cvc', 'セキュリティコード'
];

function containsSensitiveInfo(text) {
  const lowerText = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function showSensitiveWarning() {
  return new Promise((resolve) => {
    const userLang = detectUserLanguage();
    const message = userLang === 'en'
      ? '⚠️ Sensitive Information Warning\n\n' +
        'Your message may contain sensitive information such as passwords, credit card numbers, or PINs.\n\n' +
        'Your input will be sent to an external AI service.\n' +
        'Please avoid entering sensitive information.\n\n' +
        'Do you want to send this message?'
      : '⚠️ 機密情報の入力について\n\n' +
        'パスワード、クレジットカード番号、暗証番号などの機密情報が含まれている可能性があります。\n\n' +
        '入力内容は外部のAIサービスに送信されます。\n' +
        '機密情報の入力は避けてください。\n\n' +
        'このまま送信しますか？';
    const result = confirm(message);
    resolve(result);
  });
}

// ========================================
// メッセージ送信
// ========================================
let isSending = false; // 送信中フラグ

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  
  // 二重送信防止
  if (isSending) return;
  
  // 機密情報チェック
  if (containsSensitiveInfo(text)) {
    const proceed = await showSensitiveWarning();
    if (!proceed) {
      return; // 送信キャンセル
    }
  }
  
  isSending = true;
  
  // ユーザーメッセージを表示
  addMessage(text, 'user');
  
  // 入力クリア
  userInput.value = '';
  userInput.style.height = 'auto';
  sendButton.disabled = true;
  
  // 会話履歴に追加
  const userTimestamp = new Date().toISOString();
  conversationHistory.push({
    role: 'user',
    content: text
  });
  savedMessages.push({
    role: 'user',
    content: text,
    timestamp: userTimestamp
  });
  
  // ローディング表示
  const loadingId = showLoading();
  
  try {
    // GA4イベント: 質問送信（プライバシー保護のため質問内容は送信しない）
    if (typeof gtag === 'function') {
      gtag('event', 'ask_question', {
        'event_category': 'hakase_ai'
      });
    }
    
    // API呼び出し
    const response = await callHakaseAPI(text);
    
    // ローディング削除
    removeLoading(loadingId);
    
    // 博士の回答を表示（マガジンバナー表示フラグをtrue）
    addMessage(response, 'hakase', false, true);
    
    // GA4イベント: 回答受信
    if (typeof gtag === 'function') {
      gtag('event', 'receive_answer', {
        'event_category': 'hakase_ai'
      });
    }
    
    // 会話履歴に追加
    const hakaseTimestamp = new Date().toISOString();
    conversationHistory.push({
      role: 'assistant',
      content: response
    });
    savedMessages.push({
      role: 'hakase',
      content: response,
      timestamp: hakaseTimestamp
    });
    
    // 履歴を保存
    saveHistory();
    
  } catch (error) {
    console.error('API Error:', error);
    removeLoading(loadingId);
    const errorMsg = detectUserLanguage() === 'en'
      ? 'Oops, I seem to be having some trouble. Could you try again?'
      : 'すまんのう、ちょっと調子が悪いようじゃ。もう一度試してくれんか？';
    addMessage(errorMsg, 'hakase', true);
  } finally {
    // 送信中フラグをリセット
    isSending = false;
  }
}

// ========================================
// 言語検出
// ========================================
function detectUserLanguage() {
  const lang = navigator.language || navigator.userLanguage || 'ja';
  // 日本語かどうかを判定
  return lang.startsWith('ja') ? 'ja' : 'en';
}

// ========================================
// API呼び出し（バックエンド経由）
// ========================================
async function callHakaseAPI(question) {
  // コンテキストを抽出（直近5件）
  const recentContext = conversationHistory.slice(-10).map(msg => 
    `${msg.role === 'user' ? 'ユーザー' : '博士'}: ${msg.content}`
  ).join('\n');
  
  // ユーザーの言語を検出
  const userLanguage = detectUserLanguage();
  
  // ハニーポットフィールドの値を取得（ボット対策）
  const hpField = document.getElementById('hpField');
  const hpValue = hpField ? hpField.value : '';
  
  const requestBody = {
    question_text: question,
    context: recentContext,
    language: userLanguage,
    hp_field: hpValue, // ハニーポット値（正常なユーザーは空）
    preferences: {
      tone: 'hakase',
      focus: '節約・ポイント活用'
    }
  };
  
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  const data = await response.json();
  
  // レート制限エラーの場合
  if (response.status === 429 || data.error === 'rate_limit') {
    return data.comment_text || '今日はここまでのようじゃ。また明日、わしのところへ来ておくれ。';
  }
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return data.comment_text;
}

// ========================================
// 時刻フォーマット
// ========================================
function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 最後に表示した日付を記録
let lastDisplayedDate = null;

// 日付フォーマット（「1月29日(木)」形式）
function formatDate(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // 今日の場合は何も返さない
  if (targetDate.getTime() === today.getTime()) {
    return null;
  }
  
  // 昨日の場合
  if (targetDate.getTime() === yesterday.getTime()) {
    return '昨日';
  }
  
  // それ以外は「1月29日(木)」形式
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];
  
  return `${month}月${day}日(${weekday})`;
}

// 日付が変わったかチェックして、必要なら日付区切りを追加
function addDateSeparatorIfNeeded(date) {
  const dateStr = formatDate(date);
  const dateKey = date.toDateString();
  
  // 今日の場合、または同じ日付が既に表示されている場合はスキップ
  if (dateStr === null || lastDisplayedDate === dateKey) {
    return;
  }
  
  lastDisplayedDate = dateKey;
  
  const separator = document.createElement('div');
  separator.className = 'date-separator';
  separator.innerHTML = `<span class="date-separator__text">${dateStr}</span>`;
  chatContainer.appendChild(separator);
}

// ========================================
// メッセージ表示
// ========================================
function addMessage(text, sender, isError = false, showMagazine = false) {
  const now = new Date();
  
  // 日付区切りを追加（必要な場合のみ）
  addDateSeparatorIfNeeded(now);
  
  const messageWrapper = document.createElement('div');
  const time = formatTime(now);
  
  if (sender === 'hakase') {
    messageWrapper.className = 'message-wrapper hakase-wrapper';
    messageWrapper.innerHTML = `
      <div class="avatar">
        <img src="hakase.png" alt="ハカセ" class="avatar-img">
      </div>
      <div class="message-group">
        <div class="message-bubble hakase-bubble${isError ? ' error-bubble' : ''}">
          <p class="typing-text"></p>
          <div class="magazine-banner-container"></div>
        </div>
        <span class="message-time">${time}</span>
      </div>
    `;
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
    
    // タイピングアニメーション
    const textElement = messageWrapper.querySelector('.typing-text');
    const magazineContainer = messageWrapper.querySelector('.magazine-banner-container');
    typeText(textElement, text, 70, showMagazine ? magazineContainer : null, showMagazine ? text : null);
  } else {
    messageWrapper.className = 'message-wrapper user-wrapper';
    messageWrapper.innerHTML = `
      <div class="message-group">
        <div class="message-bubble user-bubble">
          <p>${escapeHtml(text)}</p>
        </div>
        <span class="message-time">${time}</span>
      </div>
    `;
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
  }
}

// タイピングアニメーション
function typeText(element, text, speed = 70, magazineContainer = null, responseText = null) {
  const processedText = escapeHtml(text);
  let index = 0;
  
  function type() {
    if (index < processedText.length) {
      // <br>タグの処理
      if (processedText.substring(index, index + 4) === '&lt;') {
        // HTMLエンティティはそのまま追加
        let endIndex = processedText.indexOf(';', index) + 1;
        element.innerHTML += processedText.substring(index, endIndex);
        index = endIndex;
      } else if (processedText.substring(index, index + 4) === '<br>') {
        element.innerHTML += '<br>';
        index += 4;
      } else if (processedText.substring(index, index + 3) === '<a ') {
        // リンクタグは一括で追加
        let endIndex = processedText.indexOf('</a>', index) + 4;
        element.innerHTML += processedText.substring(index, endIndex);
        index = endIndex;
      } else {
        element.innerHTML += processedText[index];
        index++;
      }
      scrollToBottom();
      setTimeout(type, speed);
    } else {
      // タイピング完了後にマガジンバナーを追加
      if (magazineContainer && responseText) {
        addMagazineBannerToBubble(magazineContainer, responseText);
      }
    }
  }
  
  type();
}

// ========================================
// ローディング表示
// ========================================
function showLoading() {
  const id = 'loading-' + Date.now();
  const loadingWrapper = document.createElement('div');
  loadingWrapper.id = id;
  loadingWrapper.className = 'message-wrapper hakase-wrapper';
  loadingWrapper.innerHTML = `
    <div class="avatar">
      <img src="hakase.png" alt="ハカセ" class="avatar-img">
    </div>
    <div class="message-group">
      <div class="message-bubble hakase-bubble loading-bubble">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `;
  
  chatContainer.appendChild(loadingWrapper);
  scrollToBottom();
  
  return id;
}

function removeLoading(id) {
  const loadingDiv = document.getElementById(id);
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

// ========================================
// ユーティリティ
// ========================================
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  let html = div.innerHTML.replace(/\n/g, '<br>');
  
  // URLをリンクに変換（noteマガジンはタイトル表示、その他は「リンクを見る」）
  const urlRegex = /(https?:\/\/[^\s)\]<>）』」]+)/g;
  html = html.replace(urlRegex, function (url) {
    const magazine = findMagazineByNoteUrl(url);
    const linkText = magazine ? magazine.name : (url.includes('note.com') ? 'noteを見る' : 'リンクを見る');
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + linkText + '</a>';
  });
  
  return html;
}

// ========================================
// 設定モーダル
// ========================================
function openSettingsModal() {
  settingsModal.classList.remove('hidden');
  // 履歴に状態を追加（Android戻るボタン対応）
  history.pushState({ modal: 'settings' }, '');
}

function closeSettingsModal() {
  if (!settingsModal.classList.contains('hidden')) {
    settingsModal.classList.add('hidden');
  }
}

// ========================================
// 免責事項モーダル
// ========================================
function openDisclaimerModal() {
  // 言語に応じて表示を切り替え
  const userLang = detectUserLanguage();
  const disclaimerJa = document.getElementById('disclaimerJa');
  const disclaimerEn = document.getElementById('disclaimerEn');
  const disclaimerTitle = document.getElementById('disclaimerTitle');
  
  if (userLang === 'en') {
    disclaimerJa.style.display = 'none';
    disclaimerEn.style.display = 'block';
    disclaimerTitle.textContent = 'Disclaimer & Privacy';
  } else {
    disclaimerJa.style.display = 'block';
    disclaimerEn.style.display = 'none';
    disclaimerTitle.textContent = '免責事項・プライバシー';
  }
  
  disclaimerModal.classList.remove('hidden');
  // 履歴に状態を追加（Android戻るボタン対応）
  history.pushState({ modal: 'disclaimer' }, '');
}

function closeDisclaimerModal() {
  if (disclaimerModal && !disclaimerModal.classList.contains('hidden')) {
    disclaimerModal.classList.add('hidden');
  }
}

// Android戻るボタン対応（popstateイベント）
window.addEventListener('popstate', function(event) {
  // 設定モーダルが開いている場合は閉じる
  if (settingsModal && !settingsModal.classList.contains('hidden')) {
    closeSettingsModal();
    return;
  }
  
  // 免責事項モーダルが開いている場合は閉じる
  if (disclaimerModal && !disclaimerModal.classList.contains('hidden')) {
    closeDisclaimerModal();
    return;
  }
});

// ========================================
// ダークモード
// ========================================
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  updateThemeButton(isDark);
  localStorage.setItem('hakaseai-theme', isDark ? 'dark' : 'light');
}

function updateThemeButton(isDark) {
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const themeText = themeToggle.querySelector('.theme-text');
  const userLang = detectUserLanguage();
  
  if (isDark) {
    themeIcon.textContent = '☀️';
    themeText.textContent = userLang === 'en' ? 'Light Mode' : 'ライトモード';
  } else {
    themeIcon.textContent = '🌙';
    themeText.textContent = userLang === 'en' ? 'Dark Mode' : 'ダークモード';
  }
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem('hakaseai-theme');
  
  // ライトモードが明示的に保存されている場合のみライトモードに
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
    updateThemeButton(false);
  } else {
    // デフォルトはダークモード（HTMLに既にdark-modeクラスがある）
    document.body.classList.add('dark-mode');
    updateThemeButton(true);
  }
}

// ========================================
// 会話履歴の保存・読み込み
// ========================================
function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(conversationHistory));
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(savedMessages));
  } catch (e) {
    console.error('履歴の保存に失敗:', e);
  }
}

function loadSavedHistory() {
  try {
    const savedHistoryStr = localStorage.getItem(STORAGE_KEY_HISTORY);
    const savedMessagesStr = localStorage.getItem(STORAGE_KEY_MESSAGES);
    
    if (savedHistoryStr && savedMessagesStr) {
      conversationHistory = JSON.parse(savedHistoryStr);
      savedMessages = JSON.parse(savedMessagesStr);
      
      // 保存されたメッセージを表示
      if (savedMessages.length > 0) {
        displaySavedMessages();
        return true; // 履歴あり
      }
    }
    return false; // 履歴なし
  } catch (e) {
    console.error('履歴の読み込みに失敗:', e);
    return false;
  }
}

function displaySavedMessages() {
  // 既存の初期メッセージは残す
  savedMessages.forEach(msg => {
    const timestamp = new Date(msg.timestamp);
    addMessageWithTime(msg.content, msg.role, timestamp);
  });
}

function addMessageWithTime(text, sender, timestamp) {
  // 日付区切りを追加（必要な場合のみ）
  addDateSeparatorIfNeeded(timestamp);
  
  const messageWrapper = document.createElement('div');
  const time = formatTime(timestamp);
  
  if (sender === 'hakase') {
    messageWrapper.className = 'message-wrapper hakase-wrapper';
    messageWrapper.innerHTML = `
      <div class="avatar">
        <img src="hakase.png" alt="ハカセ" class="avatar-img">
      </div>
      <div class="message-group">
        <div class="message-bubble hakase-bubble">
          <p>${escapeHtml(text)}</p>
        </div>
        <span class="message-time">${time}</span>
      </div>
    `;
  } else {
    messageWrapper.className = 'message-wrapper user-wrapper';
    messageWrapper.innerHTML = `
      <div class="message-group">
        <div class="message-bubble user-bubble">
          <p>${escapeHtml(text)}</p>
        </div>
        <span class="message-time">${time}</span>
      </div>
    `;
  }
  
  chatContainer.appendChild(messageWrapper);
  scrollToBottom();
}

function clearHistory() {
  const userLang = detectUserLanguage();
  const confirmMsg = userLang === 'en' 
    ? 'Delete chat history and reset settings?' 
    : '会話履歴と設定を削除しますか？';
  
  if (confirm(confirmMsg)) {
    // LocalStorageをクリア（履歴とテーマ設定）
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem('hakaseai-theme');
    
    // 変数をクリア
    conversationHistory = [];
    savedMessages = [];
    lastDisplayedDate = null;
    
    // テーマをデフォルト（ダークモード）にリセット
    document.body.classList.add('dark-mode');
    updateThemeButton(true);
    
    // チャット表示をクリア（初期メッセージ以外）
    const messages = chatContainer.querySelectorAll('.message-wrapper:not(:first-child), .date-separator');
    messages.forEach(msg => msg.remove());
    
    // モーダルを閉じる
    closeSettingsModal();
  }
}

