// ========================================
// ぽいロボ - フロントエンド
// ========================================

// DOM要素
const menuButton = document.getElementById('menuButton');
const settingsButton = document.getElementById('settingsButton');
const disclaimerModal = document.getElementById('disclaimerModal');
const disclaimerModalClose = document.getElementById('disclaimerModalClose');
const settingsModal = document.getElementById('settingsModal');
const settingsModalClose = document.getElementById('settingsModalClose');
const themeToggle = document.getElementById('themeToggle');
const cancelVoteBtn = document.getElementById('cancelVoteBtn');
const targetDateEl = document.getElementById('targetDate');
const gaugeBull = document.getElementById('gaugeBull');
const gaugeBear = document.getElementById('gaugeBear');
const bullPercentEl = document.getElementById('bullPercent');
const bearPercentEl = document.getElementById('bearPercent');
const totalVotesEl = document.getElementById('totalVotes');
const voteBullBtn = document.getElementById('voteBull');
const voteBearBtn = document.getElementById('voteBear');
const votedMessage = document.getElementById('votedMessage');
const votedChoice = document.getElementById('votedChoice');

// 投票データ（ローカルストレージで管理）
const STORAGE_KEY_VOTES = 'poirobo-votes';
const STORAGE_KEY_USER_VOTE = 'poirobo-user-vote';
const STORAGE_KEY_THEME = 'poirobo-theme';

// 初期データ
let voteData = {
  bull: 0,
  bear: 0,
  date: null
};

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // 日付を設定
  setTargetDate();
  
  // テーマを読み込み
  loadTheme();
  
  // 投票データを読み込み
  loadVoteData();
  
  // UIを更新
  updateUI();
  
  // イベントリスナーを設定
  setupEventListeners();
});

// ========================================
// 日付設定
// ========================================
function setTargetDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const month = tomorrow.getMonth() + 1;
  const day = tomorrow.getDate();
  
  targetDateEl.textContent = `${month}/${day}`;
  
  // 日付が変わったら投票データをリセット
  const dateKey = `${tomorrow.getFullYear()}-${month}-${day}`;
  if (voteData.date && voteData.date !== dateKey) {
    resetVoteData();
  }
  voteData.date = dateKey;
}

// ========================================
// 投票データ管理
// ========================================
function loadVoteData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_VOTES);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 日付が同じ場合のみデータを使用
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateKey = `${tomorrow.getFullYear()}-${tomorrow.getMonth() + 1}-${tomorrow.getDate()}`;
      
      if (parsed.date === dateKey) {
        voteData = parsed;
      } else {
        // 日付が違う場合はリセット
        resetVoteData();
        voteData.date = dateKey;
      }
    }
  } catch (e) {
    console.error('投票データの読み込みに失敗:', e);
  }
}

function saveVoteData() {
  try {
    localStorage.setItem(STORAGE_KEY_VOTES, JSON.stringify(voteData));
  } catch (e) {
    console.error('投票データの保存に失敗:', e);
  }
}

function resetVoteData() {
  voteData = {
    bull: 0,
    bear: 0,
    date: null
  };
  localStorage.removeItem(STORAGE_KEY_USER_VOTE);
}

function getUserVote() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER_VOTE);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 日付が同じ場合のみ使用
      if (parsed.date === voteData.date) {
        return parsed.choice;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function setUserVote(choice) {
  try {
    localStorage.setItem(STORAGE_KEY_USER_VOTE, JSON.stringify({
      choice: choice,
      date: voteData.date
    }));
  } catch (e) {
    console.error('ユーザー投票の保存に失敗:', e);
  }
}

// ========================================
// UI更新
// ========================================
function updateUI() {
  const total = voteData.bull + voteData.bear;
  let bullPercent = 50;
  let bearPercent = 50;
  
  if (total > 0) {
    bullPercent = Math.round((voteData.bull / total) * 100);
    bearPercent = 100 - bullPercent;
  }
  
  // ゲージを更新
  gaugeBull.style.width = `${bullPercent}%`;
  gaugeBear.style.width = `${bearPercent}%`;
  
  // パーセント表示を更新
  bullPercentEl.textContent = bullPercent;
  bearPercentEl.textContent = bearPercent;
  
  // 投票人数を更新
  totalVotesEl.textContent = total;
  
  // 投票済みかチェック
  const userVote = getUserVote();
  if (userVote) {
    // ボタンを無効化
    voteBullBtn.disabled = true;
    voteBearBtn.disabled = true;
    voteBullBtn.setAttribute('disabled', 'disabled');
    voteBearBtn.setAttribute('disabled', 'disabled');
    
    // 投票済みメッセージを表示
    votedMessage.classList.remove('hidden');
    votedChoice.innerHTML = userVote === 'bull' 
      ? '<span style="color: var(--bull-color)">上がる</span>'
      : '<span style="color: var(--bear-color)">下がる</span>';
    
    // キャンセルボタンを有効化
    cancelVoteBtn.disabled = false;
  } else {
    // ボタンを有効化
    voteBullBtn.disabled = false;
    voteBearBtn.disabled = false;
    voteBullBtn.removeAttribute('disabled');
    voteBearBtn.removeAttribute('disabled');
    
    // 投票済みメッセージを非表示
    votedMessage.classList.add('hidden');
    
    // キャンセルボタンを無効化
    cancelVoteBtn.disabled = true;
  }
}

// ========================================
// 投票処理
// ========================================
function vote(choice) {
  if (getUserVote()) return; // 既に投票済み
  
  // 投票を記録
  if (choice === 'bull') {
    voteData.bull++;
  } else {
    voteData.bear++;
  }
  
  // 保存
  saveVoteData();
  setUserVote(choice);
  
  // UI更新
  updateUI();
}

// ========================================
// 投票キャンセル処理
// ========================================
function cancelVote() {
  const userVote = getUserVote();
  if (!userVote) {
    alert('本日はまだ投票していません。');
    return;
  }
  
  // 確認ダイアログ
  if (!confirm('本日の投票をキャンセルしますか？')) {
    return;
  }
  
  // 投票数を減らす
  if (userVote === 'bull') {
    voteData.bull = Math.max(0, voteData.bull - 1);
  } else {
    voteData.bear = Math.max(0, voteData.bear - 1);
  }
  
  // 保存
  saveVoteData();
  
  // ユーザーの投票を削除
  localStorage.removeItem(STORAGE_KEY_USER_VOTE);
  
  // UI更新
  updateUI();
  
  // 設定モーダルを閉じる
  settingsModal.classList.add('hidden');
}

// ========================================
// タブ切り替え
// ========================================
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      
      // ボタンのアクティブ状態を切り替え
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // コンテンツの表示を切り替え
      tabContents.forEach(content => content.classList.remove('active'));
      
      if (tabId === 'prediction') {
        document.getElementById('tabPrediction').classList.add('active');
      } else if (tabId === 'history') {
        document.getElementById('tabHistory').classList.add('active');
      } else if (tabId === 'signal') {
        document.getElementById('tabSignal').classList.add('active');
      }
    });
  });
}

// ========================================
// イベントリスナー
// ========================================
function setupEventListeners() {
  // タブ切り替え
  setupTabs();
  
  // 免責事項モーダル
  menuButton.addEventListener('click', () => {
    disclaimerModal.classList.remove('hidden');
  });
  
  disclaimerModalClose.addEventListener('click', () => {
    disclaimerModal.classList.add('hidden');
  });
  
  disclaimerModal.querySelector('.modal__overlay').addEventListener('click', () => {
    disclaimerModal.classList.add('hidden');
  });
  
  // 設定モーダル
  settingsButton.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });
  
  settingsModalClose.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
  
  settingsModal.querySelector('.modal__overlay').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
  
  // 投票キャンセルボタン
  cancelVoteBtn.addEventListener('click', () => {
    cancelVote();
  });
  
  // テーマ切り替え
  themeToggle.addEventListener('click', toggleTheme);
  
  // 投票ボタン
  voteBullBtn.addEventListener('click', () => vote('bull'));
  voteBearBtn.addEventListener('click', () => vote('bear'));
}

// ========================================
// テーマ管理
// ========================================
function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    updateThemeButton(true);
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem(STORAGE_KEY_THEME, isDark ? 'dark' : 'light');
  updateThemeButton(isDark);
}

function updateThemeButton(isDark) {
  const icon = themeToggle.querySelector('.theme-icon');
  const text = themeToggle.querySelector('.theme-text');
  
  if (isDark) {
    icon.textContent = '☀️';
    text.textContent = 'ライトモード';
  } else {
    icon.textContent = '🌙';
    text.textContent = 'ダークモード';
  }
}
