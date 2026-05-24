# カレンダー年次日程更新 メンテナンスプロンプト

> 🔴 **毎年必須** — 更新しないと翌年のNYSE休場日・マクロイベントがカレンダーに表示されなくなります。

---

## あなた（ユーザー）が送る指示文

新しい会話を開始したら、以下をそのままコピーして送信してください：

```
ぽいロボのカレンダー年次日程をメンテナンスしてください。
手順書は C:\Project\PointLab\stock-calendar\docs\maintenance\calendar-dates-check.md にあります。
手順書を読んで、Web検索で翌年のNYSE休場日・各マクロイベント日程を調べ、
該当ファイルに追記してビルド・コミット・プッシュ・デプロイまで行ってください。
```

**実施タイミング:** 毎年 **12月上旬**（翌年のFOMCスケジュール等が公表される頃）

---

## 更新対象ファイルと現在のカバレッジ

| ファイル | 更新箇所 | 現在のカバレッジ |
|---|---|---|
| `src/utils/marketHolidays.ts` | `NYSE_HOLIDAYS` 配列 | 〜2026年末 |
| `src/utils/macroCalendar.ts` | `FOMC_DATES` / `BOJ_DATES` / `NFP_DATES` / `CPI_DATES` / `PCE_DATES` / `GDP_DATES` / `TANKAN_DATES` | 〜2026年末 |

> **注意:** SQ算出日・配当権利日は計算式で自動判定されるため更新不要。

---

## ステップ1: 各日程をWeb検索で確認

### NYSE休場日
- 検索: `NYSE holidays 2027` または `nyse.com market holidays`
- 公式: https://www.nyse.com/markets/hours-calendars
- 形式: `[年, 月(0始まり), 日]` の配列（平日のみ。土日は不要）
- 追加場所: `marketHolidays.ts` の `NYSE_HOLIDAYS` 配列末尾

### FOMC声明発表日（年8回・会合2日目）
- 検索: `FOMC meeting dates schedule 2027`
- 公式: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- 形式: `[年, 月(0始まり), 日]`

### 日銀金融政策決定会合（年8回・会合最終日）
- 検索: `日銀 金融政策決定会合 日程 2027`
- 公式: https://www.boj.or.jp/mopo/mpmsche_mpi/index.htm
- 形式: `[年, 月(0始まり), 日]`

### 米雇用統計（NFP）発表日（原則：毎月第1金曜日）
- 検索: `BLS employment situation release dates 2027`
- 公式: https://www.bls.gov/schedule/news_release/empsit.htm
- 第1金曜が祝日の場合はずれることがあるため公式確認推奨

### 米CPI発表日（毎月）
- 検索: `BLS CPI release schedule 2027`
- 公式: https://www.bls.gov/schedule/news_release/cpi.htm

### 米PCE発表日（毎月・月末付近）
- 検索: `BEA personal income PCE release dates 2027`
- 公式: https://www.bea.gov/news/schedule

### 米GDP速報値（四半期・年4回）
- 検索: `BEA GDP advance estimate release dates 2027`
- 公式: https://www.bea.gov/news/schedule

### 日銀短観（四半期・年4回）
- 検索: `日銀短観 発表日 2027`
- 公式: https://www.boj.or.jp/statistics/tk/yotei.htm

---

## ステップ2: ファイルに追記

### marketHolidays.ts への追記例

```typescript
// 2027
[2027, 0,  1], // New Year's Day
[2027, 0, 18], // MLK Day
// ... 以下続く
```

追記場所: `NYSE_HOLIDAYS` 配列の末尾（`// 2026` ブロックの後ろ）

### macroCalendar.ts への追記例

各 `*_DATES` 配列の末尾に `// 2027` ブロックを追加：

```typescript
// 2027
[2027, 0, 27], [2027, 2, 17], ...
```

---

## ステップ3: ビルド確認 & デプロイ

```bash
npm run build
git add src/utils/marketHolidays.ts src/utils/macroCalendar.ts
git commit -m "chore: カレンダー年次日程更新 2027年分追加"
git push
npx vercel --prod
```

---

## 更新履歴

| 更新日 | 追加年分 | 担当 |
|---|---|---|
| 2026-05-24 | 2026年分まで記載済み | 初期実装時 |

> 次回更新: **2026年12月頃**（2027年分を追加）
