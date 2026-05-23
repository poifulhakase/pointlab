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
      { type: 'para', text: 'ぽいロボ（以下「本サービス」）は、株式市場のカレンダー管理・需給分析・マーケット情報閲覧を目的とした個人運営の Web アプリケーションです。本プライバシーポリシーは、本サービスにおける個人情報・利用データの取り扱い方針を定めたものです。本サービスをご利用いただくことで、本ポリシーの内容にご同意いただいたものとみなします。' },
    ],
  },
  {
    id: 'data', icon: '💾', title: '収集・保存する情報',
    content: [
      { type: 'list', heading: 'ブラウザのローカルストレージ', items: [
        'カレンダーメモ、スティッキーメモ、クオンツ分析レポート、アプリ設定、市場データのキャッシュ等をブラウザのローカルストレージに保存します。',
        'これらのデータはお客様のデバイス内にのみ保存され、当方のサーバーへ自動送信されることはありません。',
        'ブラウザのキャッシュクリアやデータ削除を行うと、ローカルデータは消去されます。',
      ]},
      { type: 'list', heading: 'Google アカウント（任意）', items: [
        'Google アカウントでログインした場合、Firebase Authentication を通じてメールアドレス・表示名・プロフィール画像 URL を取得します。',
        'Firestore データベースにカレンダーメモ・スティッキーメモ・クオンツ分析レポートを保存し、複数デバイス間の同期に使用します。',
        'Google アカウント連携は任意です。未使用の場合はすべてローカルストレージのみで動作します。',
      ]},
      { type: 'list', heading: '音声通話（ぽいロボ コネクト）', items: [
        'ぽいロボ コネクト機能をご利用の際、8x8.vc（JaaS）経由で音声・映像の通信が行われます。',
        '通話データはリアルタイムにのみ処理され、当方のサーバーには録音・録画・保存されません。',
        'Google アカウントでのログインが必要です。通話に関するデータは JaaS のプライバシーポリシーに準拠します。',
      ]},
    ],
  },
  {
    id: 'purpose', icon: '🎯', title: '情報の利用目的',
    content: [
      { type: 'para', text: '収集した情報は以下の目的にのみ使用します。広告配信・マーケティング・第三者への販売等の目的には一切使用しません。' },
      { type: 'list', heading: '利用目的', items: [
        'サービス機能の提供（クロスデバイス同期・データ保持）',
        'ユーザー認証・セッション管理',
        'アプリの品質向上・バグ修正（エラーログの分析）',
        'お問い合わせへの対応',
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
        '8x8.vc / JaaS（音声・映像通話機能）',
        'Sentry（エラー監視・クラッシュレポート）',
      ]},
    ],
  },
  {
    id: 'sharing', icon: '🔒', title: '情報の第三者提供',
    content: [
      { type: 'para', text: '法令に基づく場合を除き、取得した個人情報を第三者に提供・開示・売却することはありません。上記の外部サービスへの情報提供は、サービス運営上必要な範囲に限定されます。' },
    ],
  },
  {
    id: 'deletion', icon: '🗑️', title: 'データの管理・削除',
    content: [
      { type: 'list', heading: '削除方法', items: [
        'ローカルストレージのデータはブラウザの設定（サイトデータの消去）から削除できます。',
        'Firestore に保存されたデータの削除をご希望の場合は、研究室 > お問い合わせフォームよりご連絡ください。',
        'Google アカウントの連携解除は、Google アカウント設定の「サードパーティアプリへのアクセス」からも行えます。',
      ]},
    ],
  },
  {
    id: 'cookies', icon: '🍪', title: 'Cookie・トラッキング',
    content: [
      { type: 'para', text: '本サービスは独自の追跡 Cookie を使用しません。ただし Firebase・TradingView 等の組み込みサービスが独自に Cookie やストレージを使用する場合があります。詳細は各サービスのポリシーをご確認ください。' },
    ],
  },
  {
    id: 'changes', icon: '📝', title: 'ポリシーの変更',
    content: [
      { type: 'para', text: '本ポリシーは必要に応じて予告なく変更する場合があります。重要な変更がある場合は、アプリ内またはアップデートの形でお知らせします。最新版は本ページにて常時公開します。' },
    ],
  },
]

const DISCLAIMER_SECTIONS: LegalSection[] = [
  {
    id: 'purpose', icon: '📢', title: '情報提供の目的',
    content: [
      { type: 'para', text: '本サービスが提供する株価・需給データ・経済指標・マーケットカレンダー等の情報は、すべて一般的な情報提供を目的としたものです。特定の有価証券・ETF・ETN・先物・デリバティブ等の売買を推奨・勧誘するものではありません。' },
    ],
  },
  {
    id: 'investment', icon: '⚠️', title: '投資判断についての注意',
    content: [
      { type: 'para', text: '本サービスの情報を参考にした投資・売買判断はすべてご自身の責任において行ってください。本サービスは、本情報の利用によって生じた投資損失・機会損失・その他いかなる損害についても一切責任を負いません。' },
      { type: 'list', heading: '特にご注意ください', items: [
        'レバレッジ型・インバース型 ETF・ETN は長期保有による減価リスクがあります',
        '先物・オプション取引は元本を大きく上回る損失が生じる可能性があります',
        '重要な投資判断の前には必ず専門家（証券会社・ファイナンシャルアドバイザー等）にご相談ください',
      ]},
    ],
  },
  {
    id: 'ai-tools', icon: '🤖', title: 'AI 分析機能についての注意',
    content: [
      { type: 'para', text: '本サービスのエンジン・シールド機能は、需給データ・チャートデータを整形し、外部 AI（Claude・Gemini・ChatGPT 等）での分析を補助するためのツールです。' },
      { type: 'list', heading: '免責事項', items: [
        'AI が生成した分析・見解・予測は参考情報であり、投資判断の根拠とはなりません',
        '外部 AI の回答精度・最新性・完全性について当方は保証しません',
        'AI へのデータ送信はユーザー自身の操作によるものであり、各 AI サービスのプライバシーポリシーが適用されます',
        'AI の回答内容によって生じた損害について当方は一切責任を負いません',
      ]},
    ],
  },
  {
    id: 'accuracy', icon: '📊', title: 'データの正確性・完全性',
    content: [
      { type: 'para', text: '掲載するデータの正確性・完全性・最新性について保証しません。市場データは取得遅延・欠損・誤りが生じる場合があります。' },
      { type: 'list', heading: '主なデータ特性', items: [
        'Yahoo Finance 経由のデータは最大数十分の遅延が生じる場合があります',
        '週次データ（信用倍率・投資主体別・先物手口等）は官公庁・取引所の公表スケジュールに依存します',
        'マクロイベント（FOMC・日銀会合等）の日時は変更される場合があります',
        '自動取得に失敗した場合、前回取得時のキャッシュデータを表示することがあります',
      ]},
    ],
  },
  {
    id: 'attribution', icon: '🗄️', title: 'データソースの帰属',
    content: [
      { type: 'para', text: '本サービスで表示するデータは以下のソースから取得しています。各データの著作権・利用規約は当該サービスに帰属します。当方は各サービスの公開 API・公開データを利用規約の範囲内で使用しています。' },
      { type: 'list', heading: 'データソース一覧', items: [
        '日本取引所グループ（JPX）',
        'nikkei225jp.com',
        'Yahoo Finance',
        'TradingView',
        'NHK ニュース RSS',
      ]},
    ],
  },
  {
    id: 'service-changes', icon: '🔄', title: 'サービスの変更・中断・終了',
    content: [
      { type: 'para', text: '本サービスは個人運営のため、予告なく内容の変更・機能の追加削除・サービスの中断または終了を行う場合があります。これによって生じたいかなる損害についても責任を負いません。また、外部データソースの仕様変更・サービス終了によりデータ取得が停止する場合があります。' },
    ],
  },
  {
    id: 'external-links', icon: '🔗', title: '外部リンクについて',
    content: [
      { type: 'para', text: '本サービスからリンクされた外部サイト・サービス（note.com 記事等）の内容および運営について、当方は責任を負いません。外部サービスの利用にあたっては、各サービスの利用規約・プライバシーポリシーをご確認ください。' },
    ],
  },
  {
    id: 'jurisdiction', icon: '⚖️', title: '準拠法・管轄',
    content: [
      { type: 'para', text: '本免責事項は日本法に準拠して解釈されます。本サービスに関して紛争が生じた場合は、日本国内の裁判所を専属的合意管轄裁判所とします。' },
    ],
  },
]

// ── レンダラー ────────────────────────────────────────────
function renderBlock(block: Block, key: number) {
  if (block.type === 'para') {
    return (
      <p key={key} style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.75, color: 'var(--text-sub)' }}>
        {block.text}
      </p>
    )
  }

  return (
    <div key={key} style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
        {block.heading}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {block.items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}>›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── メインコンポーネント（フルページビュー）────────────
export function LegalModal({ theme, isMobile, onClose }: { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }) {
  const [tab, setTab] = useState<Tab>('privacy')
  const sections = tab === 'privacy' ? PRIVACY_SECTIONS : DISCLAIMER_SECTIONS

  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      padding: isMobile ? '20px 16px 40px' : '28px 32px 48px',
      background: theme === 'dark' ? '#0f0f0f' : '#f4f6f9',
    }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ぽいロボ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              プライバシー・免責事項
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              ぽいロボ — 最終更新: 2026年5月18日
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0 }}
              aria-label="閉じる"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* SNS リンク */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <a
            href="https://note.com/pointlab"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-sub)',
              textDecoration: 'none',
              fontSize: 12, fontWeight: 600,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm2 4h4.5c1.4 0 2.5.6 3.1 1.5.4.6.6 1.3.6 2 0 1.9-1.2 3.5-3.2 3.5H9v3H7V7zm2 5.3h2.1c.9 0 1.4-.7 1.4-1.8 0-1-.5-1.7-1.4-1.7H9v3.5z"/>
            </svg>
            note
          </a>
          <a
            href="https://x.com/Aojiru_Hakase"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8,
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-sub)',
              textDecoration: 'none',
              fontSize: 12, fontWeight: 600,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.727-8.84L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X
          </a>
        </div>

        {/* タブ切り替え */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['privacy', 'disclaimer'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                ...(tab === t
                  ? { background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)', border: '1px solid transparent', boxShadow: '0 2px 8px rgba(100,120,200,0.15)' }
                  : { background: 'transparent', color: 'var(--text-sub)', border: '1px solid var(--glass-border)' }),
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
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 14,
                padding: isMobile ? '18px 16px' : '22px 24px',
              }}
            >
              <h2 style={{
                margin: '0 0 12px', fontSize: isMobile ? 15 : 16, fontWeight: 700,
                color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 8,
                letterSpacing: '-0.3px',
              }}>
                <span style={{ fontSize: 17 }}>{section.icon}</span>
                {section.title}
              </h2>
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 14 }}>
                {section.content.map((block, i) => renderBlock(block, i))}
              </div>
            </section>
          ))}
        </div>

      </div>
    </div>
  )
}
