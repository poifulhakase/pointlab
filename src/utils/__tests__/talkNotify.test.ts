import { describe, it, expect } from 'vitest'
// @ts-expect-error api/ は素の JS（型定義を持たない）
import { AI_OUTPUT_SCHEMA, AI_SYSTEM, buildNotifyText, cleanAiText, isLineTarget, isRoomId, joinAiAnswer } from '../../../api/_talkNotify.js'

/**
 * 一時トークルームの新着通知（LINE）と、トークの中のAIの、通信しない部分。
 * 🔴 ここが緩むと「通知に本文が出ない設定なのに本文が出る」事故になるので、
 *    本文を出す／出さないの分岐は必ず固定しておく。
 */
describe('talk-notify', () => {
  describe('buildNotifyText', () => {
    const base = { name: 'なみ', text: '', hasImage: false, showBody: true }

    it('本文を載せる設定なら「名前：本文」', () => {
      expect(buildNotifyText({ ...base, text: 'いま駅ついた' })).toBe('なみ：いま駅ついた')
    })

    it('長い本文は切って「…」を付ける', () => {
      const long = 'あ'.repeat(80)
      expect(buildNotifyText({ ...base, text: long })).toBe(`なみ：${'あ'.repeat(60)}…`)
    })

    it('改行は1行に詰める（通知は1行しか読まれない）', () => {
      expect(buildNotifyText({ ...base, text: 'あ\nい' })).toBe('なみ：あ い')
    })

    it('写真だけなら写真と分かる文にする', () => {
      expect(buildNotifyText({ ...base, hasImage: true })).toBe('なみ から写真が届きました')
    })

    it('本文を載せない設定なら、中身は一切出さない', () => {
      const out = buildNotifyText({ ...base, text: '秘密の話', hasImage: true, showBody: false })
      expect(out).toBe('なみ から新着があります')
      expect(out).not.toContain('秘密')
    })

    it('名前が空でも文章として成立させる', () => {
      expect(buildNotifyText({ ...base, name: '  ', text: 'やあ' })).toBe('だれか：やあ')
    })
  })

  describe('AI_SYSTEM', () => {
    // 🔴 「だらだら書かない」は運用者の明示の指示。ここが緩むと画面が読めなくなるので、
    //    短く答えさせる縛りが**消えていないこと**をテストで固定する。
    it('長さの縛りが入っている', () => {
      // 件数は形（AI_OUTPUT_SCHEMA の maxItems）でも縛っているが、
      // 指示側からも消えていないことを見る
      expect(AI_SYSTEM).toContain('最大3件')
      expect(AI_SYSTEM).toContain('2〜3行に収まる長さ')
    })

    it('分からないことを作らせない・変わる情報は断定させない', () => {
      expect(AI_SYSTEM).toContain('要確認')
      expect(AI_SYSTEM).toContain('作らない')
    })

    it('前置きを書かせない', () => {
      expect(AI_SYSTEM).toContain('前置き')
    })

    it('地名を似た別の場所に置き換えさせない（実際に出た事故の再発防止）', () => {
      // 「横浜のみなとみらい」に対して茨城の「みらい平」の店を返してきた（2026-08-30）
      expect(AI_SYSTEM).toContain('似た名前の別の場所に置き換えない')
      expect(AI_SYSTEM).toContain('都道府県')
    })
  })

  describe('cleanAiText', () => {
    // 🔴 これも実際に出た事故。モデルが改行のつもりで「バックスラッシュ＋n」を
    //    文字として書いてきて、吹き出しにそれが並んだ（2026-08-30）。
    //    プロンプトでも止めているが、表示側でも必ず直す。
    it('文字としての改行表記を本物の改行に直す', () => {
      expect(cleanAiText(String.raw`A\nB\nC`)).toBe('A\nB\nC')
      expect(cleanAiText(String.raw`A\r\nB`)).toBe('A\nB')
    })

    it('本物の改行はそのまま残す', () => {
      expect(cleanAiText('A\nB')).toBe('A\nB')
    })

    it('空行が続きすぎるのを詰める', () => {
      expect(cleanAiText('x\n\n\n\ny')).toBe('x\n\ny')
    })

    it('前後の空白と行末の空白を落とす', () => {
      expect(cleanAiText('  あ  \nい  ')).toBe('あ\nい')
    })

    it('空でも落ちない', () => {
      expect(cleanAiText(undefined)).toBe('')
    })
  })

  describe('AI_OUTPUT_SCHEMA', () => {
    it('候補は3件までに形で縛る', () => {
      expect(AI_OUTPUT_SCHEMA.properties.lines.maxItems).toBe(3)
      expect(AI_OUTPUT_SCHEMA.required).toContain('lines')
    })
  })

  describe('joinAiAnswer', () => {
    // 🔴 「1件1行」を機械で守るための部分。文章のままモデルに書かせると
    //    文の途中で改行され、候補1件が3行に割れた（2026-08-30）。
    it('候補と一言を1行ずつ繋ぐ', () => {
      const out = joinAiAnswer({ lines: ['A店／渋谷｜静か', 'B店／恵比寿｜安い'], note: '要確認' })
      expect(out).toBe('A店／渋谷｜静か\nB店／恵比寿｜安い\n要確認')
    })

    it('1件の中の改行は潰す（行が割れないように）', () => {
      expect(joinAiAnswer({ lines: ['途中で\n割れた行'] })).toBe('途中で 割れた行')
    })

    it('空の行や一言は落とす', () => {
      expect(joinAiAnswer({ lines: ['A', '', '  '], note: '' })).toBe('A')
    })

    it('壊れた入力でも落ちない', () => {
      expect(joinAiAnswer(null)).toBe('')
      expect(joinAiAnswer({})).toBe('')
    })
  })

  describe('isRoomId', () => {
    it('32桁の16進だけ通す', () => {
      expect(isRoomId('0123456789abcdef0123456789abcdef')).toBe(true)
      expect(isRoomId('0123456789ABCDEF0123456789ABCDEF')).toBe(false)
      expect(isRoomId('0123456789abcdef')).toBe(false)
      expect(isRoomId('')).toBe(false)
      expect(isRoomId(undefined)).toBe(false)
    })
  })

  describe('isLineTarget', () => {
    it('U/C/R で始まる33文字を通す', () => {
      expect(isLineTarget(`C${'0'.repeat(32)}`)).toBe(true)
      expect(isLineTarget(`U${'a'.repeat(32)}`)).toBe(true)
      expect(isLineTarget(`X${'0'.repeat(32)}`)).toBe(false)
      expect(isLineTarget('C123')).toBe(false)
    })
  })
})
