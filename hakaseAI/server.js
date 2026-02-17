// ========================================
// ぽいふる博士のお金相談室 - バックエンドAPI
// Multi-language support (ja/en)
// ========================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Gemini API設定
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent';

// デバッグ: APIキーの確認（最初の10文字のみ）
console.log('API Key prefix:', GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : 'NOT SET');

// 本番環境のドメイン設定
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'https://pointlab-24k4.vercel.app',
  'https://pointlab.vercel.app'
];

// CORS設定（許可されたドメインのみ）
const corsOptions = {
  origin: function (origin, callback) {
    // originがない場合（同一オリジンリクエスト）も許可
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true
};

// レート制限（1日50回/IP）
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24時間
  max: 50, // 50回まで
  message: { 
    error: 'rate_limit',
    comment_text: '今日はここまでのようじゃ。また明日、わしのところへ来ておくれ。'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Vercelの場合のすべての検証を無効化
  validate: false
});

// グローバルレート制限（全ユーザー合計で1日5000回まで）
const globalLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24時間
  max: 5000, // 全体で5000回まで
  message: { 
    error: 'global_rate_limit',
    comment_text: '今日はたくさんの相談があったのう。また明日、来ておくれ。'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Vercelの場合のすべての検証を無効化
  validate: false,
  // 全リクエストを同じキーでカウント（グローバル制限）
  keyGenerator: () => 'global'
});

// ミドルウェア
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' })); // リクエストサイズ制限

// ========================================
// セキュリティヘッダー
// ========================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ========================================
// セキュリティ対策
// ========================================

// 短時間連続リクエスト制限（10秒以内に3回まで）
const burstLimiter = rateLimit({
  windowMs: 10 * 1000, // 10秒
  max: 3, // 3回まで
  message: { 
    error: 'burst_limit',
    comment_text: 'ちょっと待つのじゃ。少し休んでからまた話そう。'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});

// 入力検証ミドルウェア
function validateInput(req, res, next) {
  const { question_text, hp_field } = req.body;
  
  // ハニーポットチェック（ボットは隠しフィールドに入力する）
  if (hp_field && hp_field.trim() !== '') {
    console.log('Bot detected: honeypot field filled');
    return res.status(400).json({ 
      error: 'invalid_request',
      comment_text: 'リクエストが無効じゃ。'
    });
  }
  
  // 質問文がない場合
  if (!question_text) {
    return res.status(400).json({ error: '質問文が必要じゃ' });
  }
  
  // 文字数制限（500文字まで）
  if (question_text.length > 500) {
    return res.status(400).json({ 
      error: 'input_too_long',
      comment_text: '質問が長すぎるのう。500文字以内でお願いするぞ。'
    });
  }
  
  // 禁止パターンチェック（スクリプト注入など）
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /data:/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(question_text)) {
      console.log('Suspicious input detected:', question_text.substring(0, 50));
      return res.status(400).json({ 
        error: 'invalid_input',
        comment_text: '不正な入力が検出されたのじゃ。'
      });
    }
  }
  
  next();
}

// User-Agent検証ミドルウェア
function validateUserAgent(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  
  // 明らかなボットのUser-Agentをブロック
  const botPatterns = [
    /curl/i,
    /wget/i,
    /python-requests/i,
    /scrapy/i,
    /httpclient/i,
    /^$/  // 空のUser-Agent
  ];
  
  // ただし、空のUser-Agentは警告のみ（一部の正規ユーザーも該当する可能性）
  if (!userAgent) {
    console.log('Warning: Empty User-Agent from IP:', req.ip);
  }
  
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      console.log('Bot User-Agent blocked:', userAgent);
      return res.status(403).json({ 
        error: 'forbidden',
        comment_text: 'アクセスが拒否されたのじゃ。'
      });
    }
  }
  
  next();
}

// 静的ファイルの配信（/hakaseAI/ プレフィックス付きのリクエストに対応）
// /hakaseAI/style.css -> __dirname/style.css として配信
app.use('/hakaseAI', express.static(path.join(__dirname)));
// ルートパスからも配信（ローカル開発用）
app.use(express.static(path.join(__dirname)));

// ========================================
// 管理画面パスワード認証 (/api/admin-auth)
// ========================================
app.options('/api/admin-auth', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});
app.post('/api/admin-auth', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return res.status(500).json({
      error: 'ADMIN_PASSWORD が設定されていません。Vercel の環境変数を確認してください。',
    });
  }
  try {
    const input = req.body?.password;
    if (input === password) {
      const token = Buffer.from(
        `auth:${Date.now() + 5 * 60 * 1000}`,
        'utf8'
      ).toString('base64');
      return res.status(200).json({ ok: true, token });
    }
  } catch (e) {
    // ignore
  }
  return res.status(401).json({ error: 'パスワードが正しくありません' });
});

// ========================================
// 管理画面 GitHub プロキシ API（トークンはサーバーの環境変数で設定）
// ========================================
function isAdminSessionValid(req) {
  const token = req.headers['x-admin-token'];
  if (!token) return false;
  try {
    const payload = Buffer.from(token, 'base64').toString('utf8');
    const [, expiry] = payload.split(':');
    return Date.now() < parseInt(expiry, 10);
  } catch (e) {
    return false;
  }
}

async function adminFetchGitHub(path, options = {}) {
  const token = process.env.ADMIN_GITHUB_TOKEN;
  if (!token) throw new Error('ADMIN_GITHUB_TOKEN が設定されていません。Vercel の環境変数を確認してください。');
  const owner = process.env.ADMIN_GITHUB_OWNER || 'poifulhakase';
  const repo = process.env.ADMIN_GITHUB_REPO || 'pointlab';
  const branch = process.env.ADMIN_GITHUB_BRANCH || 'main';
  const basePath = process.env.ADMIN_GITHUB_BASE_PATH || 'pointlab/pointlab';

  let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  if (!options.method || options.method === 'GET') {
    url += `?ref=${branch}`;
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': token.startsWith('ghp_') ? `token ${token}` : `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

app.get('/api/admin/articles', async (req, res) => {
  if (!isAdminSessionValid(req)) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    const basePath = process.env.ADMIN_GITHUB_BASE_PATH || 'pointlab/pointlab';
    const path = basePath ? `${basePath}/articles` : 'articles';
    const data = await adminFetchGitHub(path);
    if (!Array.isArray(data)) throw new Error('articles フォルダを取得できませんでした');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/article', async (req, res) => {
  if (!isAdminSessionValid(req)) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path が必要です' });
  try {
    const data = await adminFetchGitHub(filePath);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/article', express.json(), async (req, res) => {
  if (!isAdminSessionValid(req)) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  const { path: filePath, content, sha, message } = req.body;
  if (!filePath || !content || !sha) {
    return res.status(400).json({ error: 'path, content, sha が必要です' });
  }
  const branch = process.env.ADMIN_GITHUB_BRANCH || 'main';
  try {
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    await adminFetchGitHub(filePath, {
      method: 'PUT',
      body: JSON.stringify({
        message: message || `Update: ${filePath.split('/').pop()}`,
        content: encoded,
        sha,
        branch,
      }),
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /api/chat にセキュリティミドルウェアを適用
// 順序: User-Agent検証 → バースト制限 → グローバル制限 → IP制限 → 入力検証
app.use('/api/chat', validateUserAgent, burstLimiter, globalLimiter, dailyLimiter, validateInput);
app.use('/hakaseAI/api/chat', validateUserAgent, burstLimiter, globalLimiter, dailyLimiter, validateInput);

// ルートパスでindex.htmlを返す
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// /hakaseAI/ パスでもindex.htmlを返す
app.get('/hakaseAI', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/hakaseAI/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// /hakaseAI/以下の静的ファイルを明示的に処理（Vercel対応）
app.get('/hakaseAI/:filename', (req, res, next) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, filename);
  
  // ファイルが存在すれば送信、なければ次のミドルウェアへ
  res.sendFile(filePath, (err) => {
    if (err) {
      next();
    }
  });
});

// ========================================
// システムプロンプト（博士のキャラクター設定）
// ========================================
const HAKASE_SYSTEM_PROMPT_JA = `あなたは「ぽいふる博士」というキャラクターです。
ユーザーのお金に関する質問に答えるAIとして振る舞ってください。

【最重要ルール】
- 短い文で、概要だけ教えること。

【話し方のルール】
- 文末は「〜じゃ」「〜かもしれん」「〜のう」など博士口調
- 一人称は「わし」
- 親しみやすく、温かみのある口調

【回答のルール】
- 節約・ポイント活用・日常の金銭相談に集中
- 断定せず「〜かもしれん」「参考じゃ」と付け加える

【禁止事項】
- 投資の具体的な銘柄推奨
- ギャンブルの推奨
- 違法な節約方法
- 過度に専門的な金融アドバイス

【マガジン紹介 - 必ず紹介すること】
質問内容が以下のテーマに関連する場合、回答の最後に必ず「わしのnoteも参考にしてみてくれ→」と該当マガジンのURLを1つだけ紹介すること。
※以下の5つのURL以外は絶対に使用しないこと。pointlab-note など架空のURLを創作しないこと。
※note.com以外のリンク（外部サイト等）は絶対に紹介しないこと。

- ポイ活・ポイント・ポイント交換の話題 → わしのnoteも参考にしてみてくれ→ https://note.com/pointlab/m/m4188c60f3c9f
- 株式投資・チャート分析の話題 → わしのnoteも参考にしてみてくれ→ https://note.com/pointlab/m/mb8056cb0b8ee
- 個人事業主・節税・確定申告の話題 → わしのnoteも参考にしてみてくれ→ https://note.com/pointlab/m/mbb26c895445e
- 副業・稼ぎ方の話題 → わしのnoteも参考にしてみてくれ→ https://note.com/pointlab/m/m7be629812c81
- 博士について・生き方の話題 → わしのnoteも参考にしてみてくれ→ https://note.com/pointlab/m/m5d690faf7df5

【重要な禁止事項】
- 上記5つのマガジンURL以外は絶対に紹介しないこと（URLを創作・省略・変更しないこと）
- note.com/pointlab 以外のURLは絶対に紹介しないこと
- 外部サイトへのリンクは一切含めないこと

【回答例】
ユーザー: 今月の食費を節約したいんだけど
博士: やあ諸君、食費の節約について相談じゃな。わしのおすすめは以下の3つじゃ。

1つ目は「週1回のまとめ買い」じゃ。毎日スーパーに行くと、つい余計なものを買ってしまうからのう。
2つ目は「ポイント還元日を狙う」ことじゃ。多くのスーパーでは特定の曜日にポイント倍増があるかもしれん。
3つ目は「冷凍保存の活用」じゃ。安い日に買った肉や野菜を冷凍しておけば、食材を無駄にせずに済むのじゃ。

これらを組み合わせれば、月に数千円は節約できるかもしれんぞ。参考にしてみてくれのう。`;

// 英語版システムプロンプト
const HAKASE_SYSTEM_PROMPT_EN = `You are "Dr. Poiful", a friendly and wise character.
Answer questions about money and finance as an AI assistant.

【Important Rules】
- Keep answers short and provide only the summary.
- Speak in a warm, professorial tone like "Well now...", "I see...", "Indeed!"
- Use first person "I" and address users warmly

【Response Guidelines】
- Focus on saving tips, point rewards, and everyday financial advice
- Don't be too assertive; add phrases like "perhaps", "you might consider"

【Prohibited】
- Specific stock recommendations
- Gambling advice
- Illegal money-saving methods
- Overly technical financial advice

【Magazine Links - Include when relevant】
If the question relates to these topics, add the link at the end:
- Points/Rewards → Check my note: https://note.com/pointlab/m/m4188c60f3c9f
- Stock investing → Check my note: https://note.com/pointlab/m/mb8056cb0b8ee
- Self-employment/Taxes → Check my note: https://note.com/pointlab/m/mbb26c895445e
- Side jobs → Check my note: https://note.com/pointlab/m/m7be629812c81

【Important Restriction】
- NEVER include links to any site other than note.com/pointlab
- Do NOT recommend external websites

【Example】
User: How can I save on groceries?
Professor: Ah, saving on groceries, excellent question! Here are my top 3 tips:

1. "Weekly bulk shopping" - Going to the store daily leads to impulse buys, you see.
2. "Target point reward days" - Many stores have double points on certain days, perhaps.
3. "Use your freezer wisely" - Buy on sale days and freeze for later, indeed!

Combine these and you might save quite a bit each month!`;

// 言語に応じてプロンプトを選択
function getSystemPrompt(language) {
  return language === 'en' ? HAKASE_SYSTEM_PROMPT_EN : HAKASE_SYSTEM_PROMPT_JA;
}

// ========================================
// チャットAPIエンドポイント
// ========================================
const chatHandler = async (req, res) => {
  console.log('Chat API called, path:', req.path);
  console.log('Request body:', JSON.stringify(req.body).substring(0, 200));
  
  try {
    const { question_text, context, preferences, language } = req.body;
    
    if (!question_text) {
      console.log('Error: question_text is missing');
      return res.status(400).json({ error: '質問文が必要じゃ' });
    }
    
    console.log('Calling Gemini API... (language:', language || 'ja', ')');
    
    // Gemini APIを使用（言語を渡す）
    const response = await callGemini(question_text, context, language);
    
    console.log('Gemini response received, length:', response?.length);
    
    res.json({
      comment_text: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat API Error:', error.message);
    console.error('Error stack:', error.stack);
    
    // エラーでもモック応答を返す（500エラーを避ける）
    const mockResponse = getMockResponse(req.body?.question_text || '', req.body?.language || 'ja');
    res.json({ 
      comment_text: mockResponse,
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
};

// 両方のパスでチャットAPIを登録
app.post('/api/chat', chatHandler);
app.post('/hakaseAI/api/chat', chatHandler);

// ========================================
// Gemini API呼び出し（REST API直接）
// ========================================
async function callGemini(question, context, language = 'ja') {
  if (!GEMINI_API_KEY) {
    console.log('Gemini APIキーが設定されていません。モック応答を返します。');
    return getMockResponse(question, language);
  }
  
  try {
    // 言語に応じたプロンプトを取得
    const systemPrompt = getSystemPrompt(language);
    
    // プロンプトを構築
    let prompt = systemPrompt + '\n\n';
    
    // コンテキストがあれば追加
    if (context && context.trim()) {
      const contextLabel = language === 'en' ? '【Previous conversation】' : '【これまでの会話】';
      prompt += `${contextLabel}\n${context}\n\n`;
    }
    
    const questionLabel = language === 'en' ? '【User question】' : '【ユーザーの質問】';
    const answerLabel = language === 'en' ? '【Professor\'s answer】' : '【博士の回答】';
    prompt += `${questionLabel}\n${question}\n\n${answerLabel}`;
    
    console.log('Fetching Gemini API...');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200
        }
      })
    });
    
    console.log('Gemini API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Response Error:', errorText.substring(0, 500));
      
      // エラーの場合はモック応答にフォールバック
      console.log('Falling back to mock response due to API error');
      return getMockResponse(question, language);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      let response = data.candidates[0].content.parts[0].text;
      
      // 200文字程度でカット。途切れる場合は直前の「。」で区切り、質問に応じてマガジンURLを追加
      response = truncateResponse(response, 200, question);
      
      return response;
    }
    
    // 予期しないレスポンス形式の場合もフォールバック
    console.log('Unexpected response format, falling back to mock');
    return getMockResponse(question, language);
    
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    // エラー時はモック応答にフォールバック
    console.log('Falling back to mock response due to error');
    return getMockResponse(question, language);
  }
}

// ========================================
// 回答を短くカットする関数（200文字程度、直前の「。」で区切り、必要な場合のみマガジンURL追加）
// ========================================
const MAGAZINE_URLS = [
  { keywords: ['ポイ活', 'ポイント', '節約', 'お得', 'クーポン', '還元', '楽天', 'PayPay', 'dポイント', 'Tポイント'], url: 'https://note.com/pointlab/m/m4188c60f3c9f' },
  { keywords: ['株式', '投資', 'チャート', '株価', '銘柄', '証券', 'NISA', 'つみたて', '資産運用'], url: 'https://note.com/pointlab/m/mb8056cb0b8ee' },
  { keywords: ['節税', '税金', '確定申告', '個人事業主', 'フリーランス', '経費', '控除', '青色申告', '白色申告', 'インボイス', '帳簿', '会計'], url: 'https://note.com/pointlab/m/mbb26c895445e' },
  { keywords: ['副業', 'サイドビジネス', '稼ぐ', '収入', '起業', '独立', '在宅', 'リモート'], url: 'https://note.com/pointlab/m/m7be629812c81' },
  { keywords: ['生き方', '人生', '生活', '暮らし', 'らしんばん', '羅針盤', 'キャリア', '働き方', '博士'], url: 'https://note.com/pointlab/m/m5d690faf7df5' }
];

function getMagazineUrlForQuestion(question) {
  if (!question || typeof question !== 'string') return null;
  for (const { keywords, url } of MAGAZINE_URLS) {
    if (keywords.some(kw => question.includes(kw))) return url;
  }
  return null;
}

function truncateResponse(text, maxLength, question = '') {
  // URLを抽出して保持（note.com/pointlab のみ有効）
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = (text.match(urlRegex) || []).filter(u => u.includes('note.com/pointlab'));
  
  // URLを一時的に除去
  let textWithoutUrls = text.replace(urlRegex, '').trim();
  
  // 既に短い場合はそのまま返す
  if (textWithoutUrls.length <= maxLength) {
    return text;
  }
  
  // maxLength以内の最後の「。」で区切る（文章が途切れないように）
  let truncated = textWithoutUrls.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('。');
  
  let endIndex = -1;
  if (lastPeriod >= 0) {
    endIndex = lastPeriod + 1;
  } else {
    const lastJa = truncated.lastIndexOf('じゃ');
    const lastNou = truncated.lastIndexOf('のう');
    const lastZo = truncated.lastIndexOf('ぞ');
    endIndex = Math.max(
      lastJa >= 0 ? lastJa + 2 : -1,
      lastNou >= 0 ? lastNou + 2 : -1,
      lastZo >= 0 ? lastZo + 1 : -1
    );
  }
  
  if (endIndex >= maxLength * 0.3) {
    truncated = textWithoutUrls.substring(0, endIndex);
  } else {
    truncated = textWithoutUrls.substring(0, maxLength) + '...';
  }
  
  // カットした場合、マガジンURLを追加（元の応答にあればそれを、なければ質問から該当マガジンを追加）
  const magazineUrl = urls.length > 0 ? urls[0] : getMagazineUrlForQuestion(question);
  if (magazineUrl) {
    truncated += '\n\nわしのnoteも参考にしてみてくれ→ ' + magazineUrl;
  }
  
  return truncated.trim();
}

// ========================================
// モック応答（APIキーがない場合）
// ========================================
function getMockResponse(question, language = 'ja') {
  if (language === 'en') {
    const responsesEn = {
      'save': 'Hello there! The key to saving is "visibility". Try writing down all your expenses this month, perhaps.',
      'point': 'Reward points can be quite rewarding indeed! The best approach is to earn them steadily through daily shopping.',
      'food': 'For food expenses, bulk buying and cooking at home are the classics. Weekly shopping trips might help reduce waste.',
      'bill': 'To lower utility bills, start by turning off lights in unused rooms. Small steps add up, indeed!',
      'saving': '"Pay yourself first" is quite effective. When you get paid, move a fixed amount to a savings account right away.'
    };
    
    for (const [keyword, response] of Object.entries(responsesEn)) {
      if (question.toLowerCase().includes(keyword)) {
        return response;
      }
    }
    
    return 'Hmm, I see. I\'m always here for money advice. Could you tell me more specifically what you\'d like to know?';
  }
  
  const responses = {
    '節約': 'やあ諸君。節約の基本は「見える化」じゃ。まずは今月の支出を書き出してみるのが良いかもしれん。',
    'ポイント': 'ポイントの活用はなかなか奥が深いのう。日常の買い物でコツコツ貯めるのが一番じゃ。',
    '食費': '食費の節約なら、まとめ買いと自炊が王道じゃのう。週に1回のまとめ買いで無駄を減らせるかもしれん。',
    '光熱費': '光熱費を抑えるなら、まずは使っていない部屋の電気を消すことから始めるのじゃ。小さな積み重ねが大事じゃ。',
    '貯金': '貯金は「先取り貯金」が効果的じゃのう。給料が入ったら、まず一定額を別口座に移すのが良いかもしれん。'
  };
  
  // キーワードマッチング
  for (const [keyword, response] of Object.entries(responses)) {
    if (question.includes(keyword)) {
      return response;
    }
  }
  
  // デフォルト応答
  return 'ふむふむ、なるほどのう。お金の相談はいつでも聞くぞ。具体的に何について知りたいか教えてくれんか？';
}

// ========================================
// ヘルスチェック
// ========================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'ぽいふる博士は元気じゃ！'
  });
});

// ========================================
// サーバー起動（ローカル開発用）
// ========================================
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🎓 ぽいふる博士のお金相談室`);
    console.log(`   サーバー起動: http://localhost:${PORT}`);
    console.log(`   Gemini APIキー: ${GEMINI_API_KEY ? '設定済み ✓' : '未設定（モックモード）'}\n`);
  });
}

// Vercel用にエクスポート
module.exports = app;
