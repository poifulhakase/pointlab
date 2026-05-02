import { useState } from 'react'

type Tab = 'privacy' | 'disclaimer'

// ── セクションデータ ────────────────────────────────────
type Block =
  | { type: 'para'; text: string }
  | { type: 'list'; heading: string; items: string[] }

interface LegalSection { id: string; icon: string; title: string; content: Block[] }

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'intro', icon: '🧭', title: 'はじめに',
    content: [
      { type: 'para', text: 'ぽいロボ（以下「本サービス」）は、株式市場のカレンダー管理・需給分析・マーケット情報閲覧を目的とした個人運営の Web アプリケーションです。本プライバシーポリシーは、本サービスにおける情報の取り扱い方針を定めたものです。' },
    ],
  },
  {
    id: 'data', icon: '💾', title: '収集・保存する情報',
    content: [
      { type: 'list', heading: 'ブラウザのローカルストレージ', items: [
        'カレンダーメモ、スティッキーメモ、アプリ設定、市場データのキャッシュ等をブラウザのローカルストレージに保存します。',
        'これらのデータはお客様のデバイス内にのみ保存され、当方のサーバーへ自動送信されることはありません。',
      ]},
      { type: 'list', heading: 'Google アカウント（任意）', items: [
        'Google アカウントでログインした場合、Firebase Authentication を通じてメールアドレス・表示名・プロフィール画像 URL を取得します。',
        'Firestore データベースにカレンダーメモ・スティッキーメモを保存し、複数デバイス間の同期に使用します。',
        'Google アカウント連携は任意であり、未使用の場合はすべてローカルストレージのみで動作します。',
      ]},
    ],
  },
  {
    id: 'purpose', icon: '🎯', title: '情報の利用目的',
    content: [
      { type: 'para', text: '収集した情報は以下の目的にのみ使用します。広告配信・マーケティング・第三者への販売等の目的には使用しません。' },
      { type: 'list', heading: '利用目的', items: [
        'サービス機能の提供（クロスデバイス同期）',
        'ユーザー認証・セッション管理',
        'アプリ設定・データの保持',
      ]},
    ],
  },
  {
    id: 'third-party', icon: '🔗', title: '利用する第三者サービス',
    content: [
      { type: 'para', text: '本サービスは以下の外部サービスを利用しています。各サービスのプライバシーポリシーも合わせてご参照ください。' },
      { type: 'list', heading: '外部サービス一覧', items: [
        'Google Firebase（認証・Firestore データベース）',
        'Yahoo Finance（株価・指数データ取得）',
        'nikkei225jp.com / JPX（需給統計データ取得）',
        'TradingView（チャートウィジェット表示）',
        'Vercel（ホスティング・サーバーレス API）',
      ]},
    ],
  },
  {
    id: 'sharing', icon: '🔒', title: '情報の第三者提供',
    content: [
      { type: 'para', text: '法令に基づく場合を除き、取得した個人情報を第三者に提供・開示することはありません。' },
    ],
  },
  {
    id: 'deletion', icon: '🗑️', title: 'データの管理・削除',
    content: [
      { type: 'list', heading: '削除方法', items: [
        'ローカルストレージのデータはブラウザの設定から削除できます。',
        'Firestore に保存されたデータの削除をご希望の場合は、Google アカウントのデータ管理ページよりご対応いただくか、本サービスの運営者までお問い合わせください。',
      ]},
    ],
  },
  {
    id: 'changes', icon: '📝', title: 'ポリシーの変更',
    content: [
      { type: 'para', text: '本ポリシーは予告なく変更する場合があります。重要な変更がある場合は、アプリ内またはアップデートの形でお知らせします。' },
    ],
  },
]

const DISCLAIMER_SECTIONS: LegalSection[] = [
  {
    id: 'purpose', icon: '📢', title: '情報提供の目的',
    content: [
      { type: 'para', text: '本サービスが提供する株価・需給データ・経済指標・マーケットカレンダー等の情報は、すべて一般的な情報提供を目的としたものであり、特定の有価証券の売買を推奨・勧誘するものではありません。' },
    ],
  },
  {
    id: 'investment', icon: '⚠️', title: '投資判断についての注意',
    content: [
      { type: 'para', text: '本サービスの情報を参考にした投資・売買判断はすべてご自身の責任において行ってください。本サービスは、本情報の利用によって生じた投資損失・機会損失・その他いかなる損害についても責任を負いません。投資にはリスクが伴います。重要な判断の前には必ず専門家にご相談ください。' },
    ],
  },
  {
    id: 'accuracy', icon: '📊', title: 'データの正確性・完全性',
    content: [
      { type: 'para', text: '掲載するデータの正確性・完全性・最新性について保証しません。市場データは取得遅延・欠損・誤りが生じる場合があります。' },
      { type: 'list', heading: '注意事項', items: [
        'Yahoo Finance 経由のデータは最大数十分の遅延が生じる場合があります',
        '週次データ（信用倍率・投資主体別等）は公式発表の翌週に更新されます',
        'マクロイベントの日時は変更される場合があります',
      ]},
    ],
  },
  {
    id: 'attribution', icon: '🗄️', title: 'データソースの帰属',
    content: [
      { type: 'para', text: '本サービスで表示するデータは以下のソースから取得しています。各データの著作権・利用規約は当該サービスに帰属します。' },
      { type: 'list', heading: 'データソース一覧', items: [
        '日本取引所グループ（JPX）',
        'nikkei225jp.com',
        'Yahoo Finance',
        'TradingView',
      ]},
    ],
  },
  {
    id: 'service-changes', icon: '🔄', title: 'サービスの変更・中断・終了',
    content: [
      { type: 'para', text: '本サービスは予告なく内容の変更・機能の追加削除・サービスの中断または終了を行う場合があります。これによって生じたいかなる損害についても責任を負いません。' },
    ],
  },
  {
    id: 'external-links', icon: '🔗', title: '外部リンクについて',
    content: [
      { type: 'para', text: '本サービスからリンクされた外部サイト・サービスの内容および運営について、当方は責任を負いません。外部サービスの利用にあたっては、各サービスの利用規約・プライバシーポリシーをご確認ください。' },
    ],
  },
  {
    id: 'jurisdiction', icon: '⚖️', title: '準拠法・管轄',
    content: [
      { type: 'para', text: '本免責事項は日本法に準拠して解釈されます。本サービスに関する紛争については、日本国内の裁判所を管轄裁判所とします。' },
    ],
  },
]

// ── レンダラー（SpecView と同一スタイル）────────────────
function renderBlock(block: Block, isDark: boolean, key: number) {
  const c = {
    text:    isDark ? 'rgba(200,205,225,0.9)'  : 'rgba(30,35,60,0.88)',
    heading: isDark ? 'rgba(220,225,245,0.95)' : 'rgba(20,25,50,0.95)',
    bullet:  isDark ? 'rgba(96,165,250,0.7)'   : 'rgba(37,99,235,0.6)',
  }

  if (block.type === 'para') {
    return (
      <p key={key} style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.75, color: c.text }}>
        {block.text}
      </p>
    )
  }

  return (
    <div key={key} style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: c.heading }}>
        {block.heading}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {block.items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: c.text, lineHeight: 1.6 }}>
            <span style={{ color: c.bullet, flexShrink: 0, marginTop: 2 }}>›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── メインコンポーネント（フルページビュー）────────────
export function LegalModal({ theme, isMobile }: { theme: 'dark' | 'light'; isMobile: boolean }) {
  const [tab, setTab] = useState<Tab>('privacy')
  const isDark = theme === 'dark'

  const c = {
    cardBg:       isDark ? 'rgba(255,255,255,0.04)'   : 'rgba(255,255,255,0.7)',
    cardBorder:   isDark ? 'rgba(255,255,255,0.08)'   : 'rgba(0,0,0,0.08)',
    sectionTitle: isDark ? 'rgba(230,235,255,0.95)'   : 'rgba(15,20,50,0.95)',
    divider:      isDark ? 'rgba(255,255,255,0.07)'   : 'rgba(0,0,0,0.07)',
    logoText:     isDark ? 'rgba(180,185,210,0.6)'    : 'rgba(80,90,130,0.55)',
  }

  const sections = tab === 'privacy' ? PRIVACY_SECTIONS : DISCLAIMER_SECTIONS

  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      padding: isMobile ? '20px 16px 40px' : '28px 32px 48px',
    }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo.svg" alt="ぽいロボ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.sectionTitle, letterSpacing: '-0.5px' }}>
              プライバシー・免責事項
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: c.logoText }}>
              ぽいロボ — 最終更新: 2026年4月26日
            </p>
          </div>
        </div>

        {/* タブ切り替え */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['privacy', 'disclaimer'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'background 0.15s, color 0.15s',
                background: tab === t ? 'var(--view-btn-active-bg)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                color: tab === t ? 'var(--view-btn-active-color)' : c.logoText,
              }}
            >
              {t === 'privacy' ? 'プライバシーポリシー' : '免責事項'}
            </button>
          ))}
        </div>

        {/* セクション一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map(section => (
            <section
              key={section.id}
              style={{
                background: c.cardBg,
                border: `1px solid ${c.cardBorder}`,
                borderRadius: 14,
                padding: isMobile ? '18px 16px' : '22px 24px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <h2 style={{
                margin: '0 0 12px', fontSize: isMobile ? 15 : 16, fontWeight: 700,
                color: c.sectionTitle,
                display: 'flex', alignItems: 'center', gap: 8,
                letterSpacing: '-0.3px',
              }}>
                <span style={{ fontSize: 17 }}>{section.icon}</span>
                {section.title}
              </h2>
              <div style={{ borderTop: `1px solid ${c.divider}`, paddingTop: 14 }}>
                {section.content.map((block, i) => renderBlock(block, isDark, i))}
              </div>
            </section>
          ))}
        </div>

      </div>
    </div>
  )
}
