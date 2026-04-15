// ぽいふる博士のお金相談室 - Chat API (Vercel Serverless Function)
// POST /api/chat

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent'

const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'https://pointlab-24k4.vercel.app',
  'https://pointlab.vercel.app',
]

// ── システムプロンプト ──────────────────────────────────
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

【マガジン紹介】
質問内容が以下のテーマに関連する場合、回答の最後に必ず該当マガジンのURLを1つだけ紹介すること。
- ポイ活・ポイント → https://note.com/pointlab/m/m4188c60f3c9f
- 株式投資・チャート → https://note.com/pointlab/m/mb8056cb0b8ee
- 個人事業主・節税・確定申告 → https://note.com/pointlab/m/mbb26c895445e
- 副業・稼ぎ方 → https://note.com/pointlab/m/m7be629812c81
- 生き方・博士について → https://note.com/pointlab/m/m5d690faf7df5`

const HAKASE_SYSTEM_PROMPT_EN = `You are "Dr. Poiful", a friendly and wise character.
Answer questions about money and finance as an AI assistant.
Keep answers short, warm, and professorial. Focus on saving tips and everyday financial advice.
- Points/Rewards → https://note.com/pointlab/m/m4188c60f3c9f
- Stock investing → https://note.com/pointlab/m/mb8056cb0b8ee`

// ── マガジンURL ──────────────────────────────────────
const MAGAZINE_URLS = [
  { keywords: ['ポイ活', 'ポイント', '節約', 'お得', 'クーポン', '還元', '楽天', 'PayPay'], url: 'https://note.com/pointlab/m/m4188c60f3c9f' },
  { keywords: ['株式', '投資', 'チャート', '株価', 'NISA', '資産運用'], url: 'https://note.com/pointlab/m/mb8056cb0b8ee' },
  { keywords: ['節税', '税金', '確定申告', '個人事業主', 'フリーランス', '経費', '控除'], url: 'https://note.com/pointlab/m/mbb26c895445e' },
  { keywords: ['副業', 'サイドビジネス', '稼ぐ', '収入', '起業', '独立'], url: 'https://note.com/pointlab/m/m7be629812c81' },
  { keywords: ['生き方', '人生', '生活', '暮らし', '博士'], url: 'https://note.com/pointlab/m/m5d690faf7df5' },
]

function getMagazineUrl(question) {
  if (!question) return null
  for (const { keywords, url } of MAGAZINE_URLS) {
    if (keywords.some(kw => question.includes(kw))) return url
  }
  return null
}

function truncateResponse(text, maxLength, question = '') {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urls = (text.match(urlRegex) || []).filter(u => u.includes('note.com/pointlab'))
  let cleaned = text.replace(urlRegex, '').trim()
  if (cleaned.length <= maxLength) return text
  let truncated = cleaned.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('。')
  if (lastPeriod >= maxLength * 0.3) truncated = cleaned.substring(0, lastPeriod + 1)
  else truncated = cleaned.substring(0, maxLength) + '...'
  const url = urls[0] || getMagazineUrl(question)
  if (url) truncated += '\n\nわしのnoteも参考にしてみてくれ→ ' + url
  return truncated.trim()
}

function getMockResponse(question, language = 'ja') {
  if (language === 'en') return "I'm here to help with financial advice! Could you tell me more about what you'd like to know?"
  const responses = {
    '節約': 'やあ諸君。節約の基本は「見える化」じゃ。まずは今月の支出を書き出してみるのが良いかもしれん。',
    'ポイント': 'ポイントの活用はなかなか奥が深いのう。日常の買い物でコツコツ貯めるのが一番じゃ。',
    '食費': '食費の節約なら、まとめ買いと自炊が王道じゃのう。週に1回のまとめ買いで無駄を減らせるかもしれん。',
    '貯金': '貯金は「先取り貯金」が効果的じゃのう。給料が入ったら、まず一定額を別口座に移すのが良いかもしれん。',
  }
  for (const [kw, res] of Object.entries(responses)) {
    if (question.includes(kw)) return res
  }
  return 'ふむふむ、なるほどのう。お金の相談はいつでも聞くぞ。具体的に何について知りたいか教えてくれんか？'
}

// ── Gemini API 呼び出し ───────────────────────────────
async function callGemini(question, context, language = 'ja') {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return getMockResponse(question, language)

  const systemPrompt = language === 'en' ? HAKASE_SYSTEM_PROMPT_EN : HAKASE_SYSTEM_PROMPT_JA
  let prompt = systemPrompt + '\n\n'
  if (context?.trim()) prompt += `【これまでの会話】\n${context}\n\n`
  prompt += `【ユーザーの質問】\n${question}\n\n【博士の回答】`

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return getMockResponse(question, language)
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return getMockResponse(question, language)
    return truncateResponse(text, 200, question)
  } catch {
    return getMockResponse(question, language)
  }
}

// ── メインハンドラー ──────────────────────────────────
module.exports = async (req, res) => {
  // CORS
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { question_text, context, language, hp_field } = req.body || {}

  // ハニーポットチェック
  if (hp_field?.trim()) return res.status(400).json({ error: 'invalid_request', comment_text: 'リクエストが無効じゃ。' })

  // 入力検証
  if (!question_text) return res.status(400).json({ error: '質問文が必要じゃ' })
  if (question_text.length > 500) return res.status(400).json({ error: 'input_too_long', comment_text: '質問が長すぎるのう。500文字以内でお願いするぞ。' })

  const dangerous = [/<script/i, /javascript:/i, /on\w+=/i, /<iframe/i]
  if (dangerous.some(p => p.test(question_text))) return res.status(400).json({ error: 'invalid_input', comment_text: '不正な入力が検出されたのじゃ。' })

  try {
    const comment_text = await callGemini(question_text, context, language || 'ja')
    res.json({ comment_text, timestamp: new Date().toISOString() })
  } catch (e) {
    res.json({ comment_text: getMockResponse(question_text, language || 'ja'), timestamp: new Date().toISOString(), fallback: true })
  }
}
