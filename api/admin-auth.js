/**
 * 管理画面の簡易パスワード認証
 * Vercel の環境変数 ADMIN_PASSWORD を設定してください
 */
const ALLOWED_ORIGIN = "https://pointlab.vercel.app";

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 自ドメイン以外からのリクエストを拒否
  if (origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return res.status(500).json({
      error: "ADMIN_PASSWORD が設定されていません。Vercel の環境変数を確認してください。",
    });
  }

  try {
    let body = req.body;
    if (!body || typeof body !== "object") {
      const raw = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
        req.on("error", reject);
      });
      body = raw ? JSON.parse(raw) : {};
    }
    const { password: input } = body;
    if (input === password) {
      const token = Buffer.from(
        `auth:${Date.now() + 5 * 60 * 1000}`,
        "utf8"
      ).toString("base64");
      return res.status(200).json({ ok: true, token });
    }
  } catch (e) {
    // ignore
  }

  return res.status(401).json({ error: "パスワードが正しくありません" });
};
