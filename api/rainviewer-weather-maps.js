/**
 * RainViewer API プロキシ
 * クライアントの CORS / ネットワーク制限を回避
 */
const ALLOWED_ORIGIN = "https://pointlab.vercel.app";

module.exports = async (req, res) => {
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
    res.status(502).json({ error: e.message || "RainViewer API への接続に失敗しました" });
  }
};
