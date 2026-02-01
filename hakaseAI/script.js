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
  
  // 全リセットボタン
  const resetAllBtn = document.getElementById('resetAllBtn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', resetAll);
  }
  
  // 保存されたテーマを適用
  loadSavedTheme();
  
  // 履歴があるか確認
  const hasHistory = checkHasHistory();
  
  // 初期メッセージを表示（履歴がない場合はアニメーション付き）
  showInitialMessage(!hasHistory);
  
  // 保存された会話履歴を読み込み・表示
  loadSavedHistory();
});

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
// 初期メッセージ表示
// ========================================
function showInitialMessage(animate = true) {
  const initialText = 'やあ、諸君。わしは「ぽいふる博士」じゃ。\n節約やポイント活用について、何でも聞いてくれ。一緒に考えようではないか。';
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
// メッセージ送信
// ========================================
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  
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
    // API呼び出し
    const response = await callHakaseAPI(text);
    
    // ローディング削除
    removeLoading(loadingId);
    
    // 博士の回答を表示
    addMessage(response, 'hakase');
    
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
    addMessage('すまんのう、ちょっと調子が悪いようじゃ。もう一度試してくれんか？', 'hakase', true);
  }
}

// ========================================
// API呼び出し（バックエンド経由）
// ========================================
async function callHakaseAPI(question) {
  // コンテキストを抽出（直近5件）
  const recentContext = conversationHistory.slice(-10).map(msg => 
    `${msg.role === 'user' ? 'ユーザー' : '博士'}: ${msg.content}`
  ).join('\n');
  
  const requestBody = {
    question_text: question,
    context: recentContext,
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
function addMessage(text, sender, isError = false) {
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
        </div>
        <span class="message-time">${time}</span>
      </div>
    `;
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
    
    // タイピングアニメーション
    const textElement = messageWrapper.querySelector('.typing-text');
    typeText(textElement, text);
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
function typeText(element, text, speed = 70) {
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
  
  // URLをリンクに変換
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  html = html.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return html;
}

// ========================================
// 設定モーダル
// ========================================
function openSettingsModal() {
  settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

// ========================================
// 免責事項モーダル
// ========================================
function openDisclaimerModal() {
  disclaimerModal.classList.remove('hidden');
}

function closeDisclaimerModal() {
  disclaimerModal.classList.add('hidden');
}

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
  
  if (isDark) {
    themeIcon.textContent = '☀️';
    themeText.textContent = 'ライトモード';
  } else {
    themeIcon.textContent = '🌙';
    themeText.textContent = 'ダークモード';
  }
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem('hakaseai-theme');
  if (savedTheme === 'dark') {
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
  if (confirm('会話履歴を削除しますか？')) {
    // LocalStorageをクリア
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    
    // 変数をクリア
    conversationHistory = [];
    savedMessages = [];
    lastDisplayedDate = null;
    
    // チャット表示をクリア（初期メッセージ以外）
    const messages = chatContainer.querySelectorAll('.message-wrapper:not(:first-child), .date-separator');
    messages.forEach(msg => msg.remove());
    
    // モーダルを閉じる
    closeSettingsModal();
  }
}

function resetAll() {
  if (confirm('全てのデータ（会話履歴・テーマ設定）をリセットしますか？\n\nこの操作は取り消せません。')) {
    // ハカセAI関連のLocalStorageを全てクリア
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem('hakaseai-theme');
    
    // ページをリロードして初期状態に戻す
    location.reload();
  }
}
