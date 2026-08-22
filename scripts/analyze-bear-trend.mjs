#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// 「200日線の下ではベアを取る」は成り立つか（2026-08-22・運用者の提案）
//
// 🔴 結論＝**条件を厳しくするほど悪くなる**。深く下げているほどショートは負ける。
//    日経の下落はV字で戻すため、「下だからショート」は反発を食らい続ける。
//    唯一プラスだったのは**戻り売り**（下降トレンド中の25日線からの上方乖離）だが、
//    出番3.7%・年0.7%程度で単体では戦略にならない。
//
// 🔴 現実のベアETF（1357ダブルインバース）は日次リバランスのボラ減衰があるので、
//    ここの数字より確実に悪くなる（この検証は指数のショートで、減衰を含まない）。
//
// 使い方: node scripts/analyze-bear-trend.mjs
// ──────────────────────────────────────────────────────────────────────────
const UA={'User-Agent':'Mozilla/5.0 (compatible; stock-calendar/1.0)'}
const P2=Math.floor(Date.now()/1000), P1=P2-Math.round(24*366*86400)
const x=(await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?interval=1d&period1=${P1}&period2=${P2}`,{headers:UA})).json()).chart.result[0]
if(x.meta.dataGranularity!=='1d') throw new Error('日足でない')
const q=x.indicators.quote[0], rows=[]
x.timestamp.forEach((t,i)=>{ if(q.close[i]!=null) rows.push({d:new Date(t*1000).toISOString().slice(0,10),c:q.close[i]}) })
const c=rows.map(r=>r.c)
const sma=(n,i)=>i+1<n?null:c.slice(i+1-n,i+1).reduce((s,v)=>s+v,0)/n
const D=[]
for(let i=200;i<rows.length-1;i++){
  const ma200=sma(200,i), ma25=sma(25,i), ma200p=sma(200,i-20)
  const hi=Math.max(...c.slice(Math.max(0,i-251),i+1))
  D.push({d:rows[i].d,c:c[i],ma200,ma25,slope200:ma200-ma200p,fromHigh:(c[i]/hi-1)*100,
    dev25:(c[i]/ma25-1)*100, next:(c[i+1]/c[i]-1)*100})
}
const r2=v=>v==null?null:Math.round(v*100)/100
const RULES=[
 ['200日線の下ならショート', r=>r.c<r.ma200],
 ['200日線の下 かつ 200日線が下向き', r=>r.c<r.ma200&&r.slope200<0],
 ['上記 かつ 25日線も下', r=>r.c<r.ma200&&r.slope200<0&&r.c<r.ma25],
 ['上記 かつ 1年高値から-10%以上', r=>r.c<r.ma200&&r.slope200<0&&r.c<r.ma25&&r.fromHigh<=-10],
 ['200日線の下 かつ 25日線から+3%以上（戻り売り）', r=>r.c<r.ma200&&r.dev25>=3],
 ['200日線の下 かつ 1年高値から-20%以上', r=>r.c<r.ma200&&r.fromHigh<=-20],
]
console.log(`期間 ${D[0].d} 〜 ${D[D.length-1].d}（${D.length}営業日）`)
console.log('ショート条件                                          出番   勝率    累計    最大DD  平均')
console.log('────────────────────────────────────────────────────────────────────────────────')
for(const [label,f] of RULES){
  let n=0,w=0,sum=0,eq=1,peak=1,dd=0
  for(const r of D){ const on=f(r); const ret=on?-r.next:0; if(on){n++;if(ret>0)w++;sum+=ret}
    eq*=1+ret/100; peak=Math.max(peak,eq); dd=Math.min(dd,eq/peak-1) }
  console.log(label.slice(0,38).padEnd(40,'　').slice(0,40)+
    (r2(n/D.length*100)+'%').padStart(7)+(r2(n?w/n*100:null)+'%').padStart(8)+
    (r2((eq-1)*100)+'%').padStart(10)+(r2(dd*100)+'%').padStart(9)+(r2(n?sum/n:null)+'%').padStart(8))
}
