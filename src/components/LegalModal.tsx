
type Tab = 'privacy' | 'disclaimer' | 'terms'

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
      { type: 'para', text: '本サービスが提供する株価・需給データ・経済指標・マーケットカレンダー等の情報は、すべて一般的な情報提供および教育を目的としたものです。特定の有価証券・ETF・ETN・先物・デリバティブ等の売買を推奨・勧誘・配信するものではありません。' },
      { type: 'para', text: '当方は金融商品取引業者（投資助言・代理業を含む）の登録を受けていません。本サービスは、特定の銘柄等についての投資判断（売買の別・時期・数量・価格等）の助言を行うものではなく、客観的なデータ・指標・過去の検証結果の提示と、その分析を補助するツール・教育コンテンツの提供を目的としています。' },
      { type: 'para', text: 'エンジン・シールド・戦略プレイブック等が示す指標・傾向・手法・スコア・判定等は、過去データにもとづく一般的・客観的な情報および教育であり、特定の売買のシグナル配信や推奨ではありません。投資の最終判断は、必要に応じて外部 AI 等の分析を参考にしつつ、利用者ご自身の責任で行ってください。' },
    ],
  },
  {
    id: 'investment', icon: '⚠️', title: '投資判断についての注意',
    content: [
      { type: 'para', text: '本サービスの情報を参考にした投資・売買判断はすべてご自身の責任において行ってください。本サービスは、本情報の利用によって生じた投資損失・機会損失・その他いかなる損害についても一切責任を負いません。' },
      { type: 'list', heading: '特にご注意ください', items: [
        '戦略プレイブック等で示す過去のバックテスト・統計・年率/勝率等は、特定期間の過去データにもとづくものであり、将来の運用成果・利益を保証するものではありません',
        'レバレッジ型・インバース型 ETF・ETN は長期保有による減価リスクがあります',
        '信用取引（株式担保信用を含む）は、相場急変時に追証・強制決済が生じ、担保とした資産を含めて損失が拡大する可能性があります',
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
    id: 'paid', icon: '💳', title: '有料サービスについて',
    content: [
      { type: 'para', text: '本サービスの有料会員費は、ツールの利用・情報の閲覧・教育コンテンツおよびコミュニティへのアクセスに対する対価であり、投資助言の対価ではありません。会員・非会員にかかわらず、特定の銘柄等についての投資判断の助言や売買シグナルの配信は行いません。' },
    ],
  },
  {
    id: 'connect', icon: '🤝', title: 'ぽいロボ コネクトについて',
    content: [
      { type: 'para', text: 'ぽいロボ コネクト（通話）は、本サービスの使い方の案内・一般的な情報提供・教育を目的としています。特定の銘柄・売買のタイミング・数量・価格等についての個別の投資助言は行いません。' },
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

const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'intro', icon: '📋', title: 'はじめに',
    content: [
      { type: 'para', text: '本利用規約（以下「本規約」）は、ぽいんとらぼ（以下「運営者」）が提供する Web サービス「ぽいロボ」（以下「本サービス」）の利用条件を定めるものです。利用者（以下「ユーザー」）は、本サービスを利用することにより本規約に同意したものとみなします。' },
      { type: 'para', text: '制定日・最終改定日：2026年6月5日' },
    ],
  },
  {
    id: 'def', icon: '📖', title: '第1条（定義）',
    content: [
      { type: 'list', heading: '用語の定義', items: [
        '「本サービス」とは、運営者が提供する株式市場のカレンダー管理・需給データ可視化・教育コンテンツ・コミュニティ・関連機能の総称をいいます。',
        '「コンテンツ」とは、本サービス上で提供される文章・データ・指標・チャート・バックテスト結果・プレイブック・その他一切の情報をいいます。',
        '「会員」とは、所定の手続を経て本サービスの限定機能を利用できる地位を取得したユーザーをいいます。',
        '「有料会員」とは、所定の会員費を支払う会員をいいます。',
      ]},
    ],
  },
  {
    id: 'nature', icon: '⚖️', title: '第2条（本サービスの性質・投資助言を行わないこと）',
    content: [
      { type: 'list', heading: '本サービスの性質', items: [
        '本サービスは、株式市場に関する客観的なデータ・指標・過去の検証結果の提示および、その分析を補助するツール・教育コンテンツ・コミュニティの提供を目的とします。',
        '運営者は、金融商品取引業（投資助言・代理業を含む）の登録を受けていません。',
        '本サービスは、特定の有価証券・ETF・ETN・先物・デリバティブその他の金融商品について、投資判断（売買の別・時期・数量・価格等）の助言、投資勧誘、または売買シグナルの配信を行うものではありません。',
        'エンジン・シールド・戦略プレイブックその他が示す指標・傾向・手法・スコア・判定等は、過去データにもとづく一般的・客観的な情報および教育であり、特定の売買の推奨ではありません。',
        '投資の最終判断は、ユーザー自身の責任において行うものとします。運営者は、コンテンツを利用したユーザーの投資判断およびその結果について一切の責任を負いません。',
      ]},
    ],
  },
  {
    id: 'account', icon: '👤', title: '第3条（アカウント登録）',
    content: [
      { type: 'list', heading: 'アカウントの管理', items: [
        'ユーザーは、Google アカウントによるログイン等、運営者が定める方法で本サービスを利用できます。',
        'ユーザーは、登録情報を自己の責任で管理するものとし、第三者への貸与・共有・譲渡をしてはなりません。',
        'アカウントの管理不十分・第三者の使用等により生じた損害について、運営者は責任を負いません。',
      ]},
    ],
  },
  {
    id: 'member', icon: '🎫', title: '第4条（会員・有料会員）',
    content: [
      { type: 'list', heading: '会員・課金', items: [
        '会員資格の取得・更新・喪失の条件は、運営者が別途定めるところによります。',
        '有料の課金は、運営者が指定する外部プラットフォーム（note 等）を通じて行われます。料金・支払方法・提供時期・解約・返金等の条件は、当該プラットフォームの定めおよび表示によります。',
        '外部プラットフォームで所定の課金を行ったユーザーは、運営者の手続により会員（メンバー）として本サービスの限定機能へのアクセスが付与されます。',
        '有料の対価は、ツールの利用・情報の閲覧・教育コンテンツおよびコミュニティへのアクセスに対する対価であり、投資助言の対価ではありません。',
        '運営者は、本規約に違反したユーザーの会員資格を、事前の通知なく停止または取り消すことができます。',
      ]},
    ],
  },
  {
    id: 'fee', icon: '💳', title: '第5条（料金・支払い）',
    content: [
      { type: 'list', heading: '料金', items: [
        '有料の課金は外部プラットフォームを通じて行われ、料金・支払時期・支払方法・解約・返金は当該プラットフォームの定めによります。',
        'ユーザーが支払う費用に関する税金・手数料は、ユーザーの負担とします。',
        '外部プラットフォームでの返金等の取扱いは、当該プラットフォームの規定によります。',
      ]},
    ],
  },
  {
    id: 'prohibited', icon: '🚫', title: '第6条（禁止事項）',
    content: [
      { type: 'para', text: 'ユーザーは、本サービスの利用にあたり、次の行為をしてはなりません。' },
      { type: 'list', heading: '禁止行為', items: [
        '法令または公序良俗に違反する行為',
        '運営者または第三者の知的財産権・プライバシー・名誉その他の権利を侵害する行為',
        'コンテンツの無断複製・転載・再配布・販売・改変・二次利用（第8条に定める範囲を超えるもの）',
        '本サービスを、第三者への投資助言・投資勧誘・売買シグナル配信その他の事業に利用する行為',
        '本サービスの運営を妨害する行為、不正アクセス、過度な負荷をかける行為',
        '虚偽の情報の登録、他者へのなりすまし',
        '反社会的勢力に該当し、または反社会的勢力と関与する行為（第11条）',
        'その他、運営者が不適切と合理的に判断する行為',
      ]},
    ],
  },
  {
    id: 'accuracy', icon: '📊', title: '第7条（コンテンツの正確性・データソース）',
    content: [
      { type: 'list', heading: 'データについて', items: [
        '運営者は、コンテンツの正確性・完全性・最新性・有用性について保証しません。',
        '市場データは、外部サービス（Yahoo Finance・JPX・nikkei225jp.com・TradingView 等）から取得しており、取得遅延・欠損・誤りが生じる場合があります。',
        '外部データソースの仕様変更・サービス終了等により、コンテンツの提供が停止・変更される場合があります。',
      ]},
    ],
  },
  {
    id: 'ip', icon: '©️', title: '第8条（知的財産権）',
    content: [
      { type: 'list', heading: '権利の帰属', items: [
        '本サービスおよびコンテンツに関する著作権その他の知的財産権は、運営者または正当な権利者に帰属します。',
        'ユーザーは、私的利用の範囲を超えてコンテンツを複製・転載・再配布・販売してはなりません。',
        'ユーザーが本サービス上で作成・保存したメモ等のデータの権利はユーザーに帰属します。運営者は、サービス提供に必要な範囲でこれを保存・処理します。',
      ]},
    ],
  },
  {
    id: 'liability', icon: '🛡️', title: '第9条（免責）',
    content: [
      { type: 'list', heading: '免責', items: [
        '運営者は、本サービスの利用または利用不能によりユーザーに生じた損害（投資損失・機会損失・データ消失・間接損害・特別損害を含む）について、一切責任を負いません。',
        '前項にかかわらず、運営者の故意または重過失による場合はこの限りではありません。消費者契約法その他の強行法規が適用される場合、運営者の責任は当該法令の認める範囲に限定されます。',
        '本サービスの詳細な免責事項は、別途定める免責事項（本画面の「免責事項」タブ）によります。',
      ]},
    ],
  },
  {
    id: 'service', icon: '🔄', title: '第10条（サービスの変更・中断・終了）',
    content: [
      { type: 'para', text: '本サービスは個人運営であり、運営者は、予告なく本サービスの内容変更・機能の追加削除・中断・終了を行うことができます。これによりユーザーに生じた損害について、運営者は責任を負いません。' },
    ],
  },
  {
    id: 'antisocial', icon: '⛔', title: '第11条（反社会的勢力の排除）',
    content: [
      { type: 'list', heading: '表明・保証', items: [
        'ユーザーは、自己が暴力団・暴力団員・その他の反社会的勢力（以下「反社会的勢力」）に該当しないこと、および反社会的勢力と関与していないことを表明し、保証します。',
        'ユーザーが前項に違反した場合、運営者は、何らの催告なく本サービスの利用および会員資格を停止・取り消すことができます。',
      ]},
    ],
  },
  {
    id: 'amend', icon: '📝', title: '第12条（本規約の変更）',
    content: [
      { type: 'para', text: '運営者は、必要と判断した場合、ユーザーへの個別の通知なく本規約を変更できます。変更後の本規約は、本サービス上に掲載した時点から効力を生じます。重要な変更については、合理的な方法で周知します。' },
    ],
  },
  {
    id: 'law', icon: '🏛️', title: '第13条（準拠法・管轄）',
    content: [
      { type: 'para', text: '本規約は日本法に準拠して解釈されます。本サービスに関して紛争が生じた場合、運営者の住所地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。' },
    ],
  },
]

// ── レンダラー ────────────────────────────────────────────
function renderBlock(block: Block, key: number, textClr: string, subClr: string) {
  if (block.type === 'para') {
    return (
      <p key={key} style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.75, color: subClr }}>
        {block.text}
      </p>
    )
  }

  return (
    <div key={key} style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: textClr }}>
        {block.heading}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {block.items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: subClr, lineHeight: 1.6 }}>
            <span style={{ color: subClr, flexShrink: 0, marginTop: 2 }}>›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── メインコンポーネント（フルページビュー）────────────
export function LegalModal({ theme, isMobile, onClose, legalTab = 'privacy' }: { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void; legalTab?: Tab; onLegalTabChange?: (t: Tab) => void }) {
  const sections = legalTab === 'privacy' ? PRIVACY_SECTIONS : legalTab === 'disclaimer' ? DISCLAIMER_SECTIONS : TERMS_SECTIONS
  const headerLabel = legalTab === 'privacy' ? 'プライバシーポリシー' : legalTab === 'disclaimer' ? '免責事項' : '利用規約'

  const D = theme === 'dark'
  const mono = "'Courier New', Courier, monospace" as const
  const c = {
    bg:        D ? 'rgba(3,10,24,0.92)'        : 'rgba(218,236,255,0.92)',
    hdrBg:     D ? 'rgba(3,9,22,0.97)'         : 'rgba(228,242,255,0.97)',
    scan:      D ? 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)' : 'none',
    accent:    D ? '#00e5ff'                   : '#0369a1',
    dim:       D ? 'rgba(0,229,255,0.42)'      : 'rgba(3,105,161,0.62)',
    text:      D ? 'rgba(220,240,255,0.90)'    : 'rgba(8,28,75,0.90)',
    sub:       D ? 'rgba(140,188,228,0.68)'    : 'rgba(30,65,135,0.62)',
    rule:      D ? 'rgba(0,200,255,0.10)'      : 'rgba(3,105,161,0.12)',
    cardBg:    D ? 'rgba(0,229,255,0.05)'      : 'var(--glass-bg)',
    cardBdr:   D ? 'rgba(0,229,255,0.18)'      : 'var(--glass-border)',
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: c.bg, backgroundImage: c.scan }}>
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 1 }}>

        {/* Sticky header — ManualView スタイル */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '11px 16px' : '12px 28px',
          background: c.hdrBg,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${c.rule}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.accent, boxShadow: D ? `0 0 7px ${c.accent}` : 'none', flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            color: c.dim, fontFamily: mono, whiteSpace: 'nowrap',
            textShadow: D ? '0 0 10px rgba(0,229,255,0.28)' : 'none',
          }}>
            ぽいロボ ▸ {headerLabel}
          </span>
          {onClose && (
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 7,
              border: D ? '1px solid rgba(0,200,255,0.20)' : '1px solid rgba(0,100,180,0.25)',
              background: D ? 'rgba(0,200,255,0.06)' : 'rgba(0,100,180,0.08)',
              color: D ? 'rgba(0,200,255,0.65)' : 'rgba(0,80,160,0.70)',
              cursor: 'pointer', flexShrink: 0,
            }} aria-label="閉じる">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '28px 32px 48px' }}>
        {/* セクション一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map(section => (
            <section
              key={section.id}
              style={{
                background: c.cardBg,
                border: `1px solid ${c.cardBdr}`,
                borderRadius: 14,
                padding: isMobile ? '18px 16px' : '22px 24px',
              }}
            >
              <h2 style={{
                margin: '0 0 12px', fontSize: isMobile ? 15 : 16, fontWeight: 700,
                color: c.text,
                display: 'flex', alignItems: 'center', gap: 8,
                letterSpacing: '-0.3px',
              }}>
                <span style={{ fontSize: 17 }}>{section.icon}</span>
                {section.title}
              </h2>
              <div style={{ borderTop: `1px solid ${c.rule}`, paddingTop: 14 }}>
                {section.content.map((block, i) => renderBlock(block, i, c.text, c.sub))}
              </div>
            </section>
          ))}
        </div>

        </div>{/* /maxWidth */}
      </div>{/* /scroll */}
    </div>
  )
}
