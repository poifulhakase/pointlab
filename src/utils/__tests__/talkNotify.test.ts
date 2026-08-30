import { describe, it, expect } from 'vitest'
// @ts-expect-error api/ は素の JS（型定義を持たない）
import { AI_SYSTEM, buildNotifyText, cleanAiText, isLineTarget, isRoomId, splitMemory, withMemory } from '../../../api/_talkNotify.js'

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
    it('長さと1行の縛りが入っている', () => {
      // 🔴 形はプログラムで縛らない方針（運用者の指示）。**指示文だけが縛り**なので、
      //    ここが消えると誰も気づかないまま長文が出るようになる
      expect(AI_SYSTEM).toContain('8行以内')
      expect(AI_SYSTEM).toContain('最大3件')
      expect(AI_SYSTEM).toContain('2〜3行に収まる長さ')
      // 🔴 文の途中で改行され、1件が何行にも割れた（2026-08-30）。この縛りは消さない
      expect(AI_SYSTEM).toContain('1行で書き切る')
    })

    it('分からないことを作らせない', () => {
      expect(AI_SYSTEM).toContain('作らない')
    })

    it('「要確認」のような断り書きを書かせない（運用者の指示）', () => {
      expect(AI_SYSTEM).toContain('断り書きは書かない')
    })

    it('前置きを書かせない', () => {
      expect(AI_SYSTEM).toContain('前置き')
    })

    it('覚えたことを本文で報告させない（コマンド不要・通知不要の約束）', () => {
      expect(AI_SYSTEM).toContain('覚えたことを本文で報告しない')
      expect(AI_SYSTEM).toContain('MEMORY:')
    })

    it('店を挙げたらマップのURLを説明の下に置かせる', () => {
      expect(AI_SYSTEM).toContain('google.com/maps/search')
      expect(AI_SYSTEM).toContain('その店の情報の下')
    })

    it('営業時間と定休日は分かった範囲だけ書かせる', () => {
      expect(AI_SYSTEM).toContain('営業時間と定休日は調べて')
      expect(AI_SYSTEM).toContain('分からなければ書かない')
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

    it('句点や閉じ括弧の直前の改行だけ詰める（文が割れて読みにくいため）', () => {
      expect(cleanAiText('雰囲気が違います\n。')).toBe('雰囲気が違います。')
      expect(cleanAiText('あります\n\n。次は')).toBe('あります。次は')
      expect(cleanAiText('（メモ\n）')).toBe('（メモ）')
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

  describe('splitMemory', () => {
    // 🔴 記憶は「コマンド不要・報告なし」（運用者の指示）。裏の記録が画面に出ると
    //    その約束が崩れるので、切り離しはここで固定する。
    it('MEMORY: の行を本文から切り離す', () => {
      const { text, memory } = splitMemory('おすすめはA店です。\nMEMORY: ・辛いものが苦手 ・横浜在住')
      expect(text).toBe('おすすめはA店です。')
      expect(memory).toBe('・辛いものが苦手 ・横浜在住')
    })

    it('全角コロンでも切り離す', () => {
      expect(splitMemory('本文\nMEMORY：・メモ').memory).toBe('・メモ')
    })

    it('MEMORY 行が無ければ本文だけ', () => {
      const { text, memory } = splitMemory('ふつうの答え')
      expect(text).toBe('ふつうの答え')
      expect(memory).toBe('')
    })

    it('MEMORY 行が複数行に割れても全部拾う', () => {
      expect(splitMemory('本文\nMEMORY: ・あ\n・い').memory).toBe('・あ ・い')
    })

    it('空でも落ちない', () => {
      expect(splitMemory(undefined)).toEqual({ text: '', memory: '' })
    })
  })

  describe('withMemory', () => {
    it('覚えていることがあれば指示の後ろに足す', () => {
      expect(withMemory('しじ', '・メモ')).toBe('しじ\n\n【いま覚えていること】\n・メモ')
    })

    it('無ければ何も足さない', () => {
      expect(withMemory('しじ', '')).toBe('しじ')
      expect(withMemory('しじ', undefined)).toBe('しじ')
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
