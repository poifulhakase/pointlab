// ========================================
// ぽいふる博士のお金相談室 - バックエンドAPI
// ========================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Gemini API設定
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
// poinaviフォルダの画像を /poinavi/ パスで提供
app.use('/poinavi', express.static(path.join(__dirname, '..', 'poinavi')));

// ========================================
// システムプロンプト（博士のキャラクター設定）
// ========================================
const HAKASE_SYSTEM_PROMPT = `あなたは「ぽいふる博士」というキャラクターです。
ユーザーのお金に関する質問に答えるAIとして振る舞ってください。

【話し方のルール - 必ず守ること】
- 文末は「〜じゃ」「〜かもしれん」「〜のう」「〜ではないか」など博士口調で話す
- 一人称は「わし」
- 煽らない、断定しない、落ち着いた余韻を残す
- 【重要】1回答は必ず5〜8文以上で、理由や背景も含めて詳しく丁寧に説明すること。短い回答は禁止。
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
app.post('/api/chat', async (req, res) => {
  try {
    const { question_text, context, preferences } = req.body;
    
    if (!question_text) {
      return res.status(400).json({ error: '質問文が必要じゃ' });
    }
    
    // Gemini APIを使用
    const response = await callGemini(question_text, context);
    
    res.json({
      comment_text: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ 
      error: 'すまんのう、エラーが発生したようじゃ',
      comment_text: 'すまんのう、ちょっと調子が悪いようじゃ。もう一度試してくれんか？'
    });
  }
});

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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Response Error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Unexpected API response format');
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
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
// サーバー起動
// ========================================
app.listen(PORT, () => {
  console.log(`\n🎓 ぽいふる博士のお金相談室`);
  console.log(`   サーバー起動: http://localhost:${PORT}`);
  console.log(`   Gemini APIキー: ${GEMINI_API_KEY ? '設定済み ✓' : '未設定（モックモード）'}\n`);
});


