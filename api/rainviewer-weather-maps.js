/**
 * RainViewer API プロキシ
 * クライアントの CORS / ネットワーク制限を回避
 */
const ALLOWED_ORIGIN = "https://pointlab.vercel.app";

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null");
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "public, max-age=300");
  try {
    const r = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!r.ok) throw new Error(`RainViewer API: ${r.status}`);
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    // 内部エラー詳細はクライアントへ返さない（他APIの方針に統一・第13セッション）
    console.error("[rainviewer-weather-maps]", e);
    res.status(502).json({ error: "RainViewer API への接続に失敗しました" });
  }
};
