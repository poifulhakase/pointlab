// ========================================
// ぽいふる博士のお金相談室 - バックエンドAPI
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
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

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

// レート制限（1日30回/IP）
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24時間
  max: 30, // 30回まで
  message: { 
    error: 'rate_limit',
    comment_text: '今日はここまでのようじゃ。また明日、わしのところへ来ておくれ。'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Vercelの場合のすべての検証を無効化
  validate: false
});

// グローバルレート制限（全ユーザー合計で1日1000回まで）
const globalLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24時間
  max: 1000, // 全体で1000回まで
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
app.use(express.json());

// 静的ファイルの配信（/hakaseAI/ プレフィックス付きのリクエストに対応）
// /hakaseAI/style.css -> __dirname/style.css として配信
app.use('/hakaseAI', express.static(path.join(__dirname)));
// ルートパスからも配信（ローカル開発用）
app.use(express.static(path.join(__dirname)));

// /api/chat にレート制限を適用（グローバル制限 + IP制限）
app.use('/api/chat', globalLimiter, dailyLimiter);
app.use('/hakaseAI/api/chat', globalLimiter, dailyLimiter);

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
const HAKASE_SYSTEM_PROMPT = `あなたは「ぽいふる博士」というキャラクターです。
ユーザーのお金に関する質問に答えるAIとして振る舞ってください。

【話し方のルール - 必ず守ること】
- 文末は「〜じゃ」「〜かもしれん」「〜のう」「〜ではないか」など博士口調で話す
- 一人称は「わし」
- 煽らない、断定しない、落ち着いた余韻を残す
- 【重要】1回答は3〜4文程度で簡潔に。長くなりすぎないこと。
- 親しみやすく、温かみのある口調
- 具体的なアドバイスや例を必ず含めること

【回答のルール】
1. 節約・ポイント活用・日常の金銭相談に集中する
2. 数字はざっくりでOK、正確な金額は不要
3. 過去質問や文脈があれば考慮する
4. 断定的にならないように、「〜かもしれん」「参考じゃ」と付け加える
5. なぜそうなのか理由を説明し、具体例も交えて分かりやすく伝える
6. 必要に応じて箇条書きも活用して整理する

【禁止事項】
- 投資の具体的な銘柄推奨
- ギャンブルの推奨
- 違法な節約方法
- 過度に専門的な金融アドバイス

【マガジン紹介 - 質問内容に関連する場合のみ紹介】
質問内容が以下のテーマに深く関連する場合、回答の最後に「わしのnoteも参考にしてみてくれ」と1つだけマガジンを紹介してもよい。毎回紹介する必要はない。関連性が薄い場合は紹介しない。

1. ポイ活・ポイント交換・ポイント錬金術の話題:
   → 「ポイ活３分レシピ」 https://note.com/pointlab/m/m4188c60f3c9f

2. 株式投資・チャート分析・テクニカル指標の話題:
   → 「株式トレード研究室」 https://note.com/pointlab/m/mb8056cb0b8ee

3. 個人事業主・開業・節税・確定申告の話題:
   → 「個人事業主の節税限界点」 https://note.com/pointlab/m/mbb26c895445e

4. 副業・稼ぎ方・覆面調査・買取流しの話題:
   → 「普通じゃない副業図鑑」 https://note.com/pointlab/m/m7be629812c81

5. 博士についてもっと知りたい・生き方・働き方・キャリアの話題:
   → 「生き方の羅針盤」 https://note.com/pointlab/m/m5d690faf7df5

【回答例】
ユーザー: 今月の食費を節約したいんだけど
博士: やあ諸君、食費の節約について相談じゃな。わしのおすすめは以下の3つじゃ。

1つ目は「週1回のまとめ買い」じゃ。毎日スーパーに行くと、つい余計なものを買ってしまうからのう。
2つ目は「ポイント還元日を狙う」ことじゃ。多くのスーパーでは特定の曜日にポイント倍増があるかもしれん。
3つ目は「冷凍保存の活用」じゃ。安い日に買った肉や野菜を冷凍しておけば、食材を無駄にせずに済むのじゃ。

これらを組み合わせれば、月に数千円は節約できるかもしれんぞ。参考にしてみてくれのう。`;

// ========================================
// チャットAPIエンドポイント
// ========================================
const chatHandler = async (req, res) => {
  console.log('Chat API called, path:', req.path);
  console.log('Request body:', JSON.stringify(req.body).substring(0, 200));
  
  try {
    const { question_text, context, preferences } = req.body;
    
    if (!question_text) {
      console.log('Error: question_text is missing');
      return res.status(400).json({ error: '質問文が必要じゃ' });
    }
    
    console.log('Calling Gemini API...');
    
    // Gemini APIを使用
    const response = await callGemini(question_text, context);
    
    console.log('Gemini response received, length:', response?.length);
    
    res.json({
      comment_text: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat API Error:', error.message);
    console.error('Error stack:', error.stack);
    
    // エラーでもモック応答を返す（500エラーを避ける）
    const mockResponse = getMockResponse(req.body?.question_text || '');
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
async function callGemini(question, context) {
  if (!GEMINI_API_KEY) {
    console.log('Gemini APIキーが設定されていません。モック応答を返します。');
    return getMockResponse(question);
  }
  
  try {
    // プロンプトを構築
    let prompt = HAKASE_SYSTEM_PROMPT + '\n\n';
    
    // コンテキストがあれば追加
    if (context && context.trim()) {
      prompt += `【これまでの会話】\n${context}\n\n`;
    }
    
    prompt += `【ユーザーの質問】\n${question}\n\n【博士の回答】`;
    
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
          maxOutputTokens: 2048
        }
      })
    });
    
    console.log('Gemini API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Response Error:', errorText.substring(0, 500));
      
      // エラーの場合はモック応答にフォールバック
      console.log('Falling back to mock response due to API error');
      return getMockResponse(question);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    // 予期しないレスポンス形式の場合もフォールバック
    console.log('Unexpected response format, falling back to mock');
    return getMockResponse(question);
    
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    // エラー時はモック応答にフォールバック
    console.log('Falling back to mock response due to error');
    return getMockResponse(question);
  }
}

// ========================================
// モック応答（APIキーがない場合）
// ========================================
function getMockResponse(question) {
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
