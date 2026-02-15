/**
 * ぽいなび (/poinavi) にベーシック認証を適用
 * 環境変数: POINAVI_USER（既定: poinavi）, POINAVI_PASSWORD（必須）
 */
import { next } from '@vercel/functions';

const POINAVI_USER = process.env.POINAVI_USER || 'poinavi';
const POINAVI_PASSWORD = process.env.POINAVI_PASSWORD || '56899946';

export const config = {
  matcher: ['/poinavi', '/poinavi/', '/poinavi/(.*)'],
};

export default function middleware(request) {
  const auth = request.headers.get('authorization');

  if (!auth || !auth.startsWith('Basic ')) {
    return new Response('認証が必要です', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="ぽいなび"',
      },
    });
  }

  try {
    const base64 = auth.slice(6);
    const decoded = atob(base64);
    const [user, pass] = decoded.split(':');

    if (user === POINAVI_USER && pass === POINAVI_PASSWORD) {
      return next();
    }
  } catch (_) {
    // invalid base64 or format
  }

  return new Response('認証に失敗しました', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ぽいなび"',
    },
  });
}
