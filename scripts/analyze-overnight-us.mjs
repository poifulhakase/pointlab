#!/usr/bin/env node
// 前夜の海外市場が翌日の日経をどれだけ説明するか（R&D・2026-08-11）
//
// 🔴 きっかけ＝需給12項目を全部足しても方向の的中率が 52.8%（何もしないと 52.2%）しかなく、
//    「なぜ当たらないのか」を追ったところ、需給の大半が**週次で最大10日遅れ**だと分かった。
//    では 08:30 の判断時点で**遅れゼロ**の材料は何か、を測ったのがこれ。
//
// 🔴 結果（21年・5,131営業日）:
//      前夜S&P500 → 翌日の寄り     相関 0.650 / 方向一致 74.7%
//      前夜S&P500 → 翌日の終値まで 相関 0.493 / 方向一致 65.1%
//      前夜S&P500 → 寄り→引け     相関 0.209 / 方向一致 49.8%   ← コインの裏表
//    つまり**米国の材料は寄り付きで織り込まれて終わる**。
//    我々は寄りで執行するので、この 74.7% は**取りに行けない**。
//    方向の材料ではなく、「今日は飛んで始まる」を事前に知る＝執行の材料として使う。
//
// 使い方: node scripts/analyze-overnight-us.mjs

const UA={'User-Agent':'Mozilla/5.0'}
const P2=Math.floor(Date.now()/1000), P1=P2-21*365*24*3600
const get=async(sym)=>{
  const r=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+sym+'?period1='+P1+'&period2='+P2+'&interval=1d',{headers:UA,signal:AbortSignal.timeout(30000)})
  const x=(await r.json()).chart.result[0], q=x.indicators.quote[0], m=new Map()
  x.timestamp.forEach((t,i)=>{if(q.close[i]!=null)m.set(new Date(t*1000).toISOString().slice(0,10),{o:q.open[i],c:q.close[i]})})
  return m
}
const [nk,spx,ndx,fx]=await Promise.all([get('%5EN225'),get('%5EGSPC'),get('%5EIXIC'),get('JPY=X')])
const nkd=[...nk.keys()].sort()
const prevRet=(m,d)=>{ // d(JST営業日)より前で最も新しい米国終値の前日比
  const ks=[...m.keys()].filter(k=>k<d).sort()
  if(ks.length<2)return null
  const a=m.get(ks[ks.length-1]).c, b=m.get(ks[ks.length-2]).c
  return a/b-1
}
const rows=[]
for(let i=1;i<nkd.length;i++){
  const d=nkd[i], pd=nkd[i-1]
  const s=prevRet(spx,d), n=prevRet(ndx,d), f=prevRet(fx,d)
  if(s==null)continue
  rows.push({d, s, n, f,
    gap:nk.get(d).o/nk.get(pd).c-1,
    c2c:nk.get(d).c/nk.get(pd).c-1,
    o2c:nk.get(d).c/nk.get(d).o-1})
}
const mean=a=>a.reduce((x,v)=>x+v,0)/a.length
const corr=(x,y)=>{const mx=mean(x),my=mean(y);let n=0,dx=0,dy=0
  for(let i=0;i<x.length;i++){n+=(x[i]-mx)*(y[i]-my);dx+=(x[i]-mx)**2;dy+=(y[i]-my)**2}
  return n/Math.sqrt(dx*dy)}
console.log('n='+rows.length+'  ('+rows[0].d+' 〜 '+rows[rows.length-1].d+')\n')
console.log('■ 相関')
for(const [lbl,k] of [['前夜S&P500','s'],['前夜NASDAQ','n'],['前夜ドル円','f']]){
  const v=rows.filter(r=>r[k]!=null)
  console.log('  '+lbl+' → 翌日の寄り(窓)   '+corr(v.map(r=>r[k]),v.map(r=>r.gap)).toFixed(3)
    +'   → 終値まで '+corr(v.map(r=>r[k]),v.map(r=>r.c2c)).toFixed(3)
    +'   → 寄り→引け '+corr(v.map(r=>r[k]),v.map(r=>r.o2c)).toFixed(3))
}
console.log('\n■ 方向の一致率（前夜S&P500がプラスなら日経もプラスか）')
for(const [lbl,k] of [['寄り(窓)','gap'],['終値まで','c2c'],['寄り→引け','o2c']]){
  const hit=rows.filter(r=>(r.s>0)===(r[k]>0)).length
  console.log('  '+lbl.padEnd(10)+' '+(hit/rows.length*100).toFixed(1)+'%')
}
const base=rows.filter(r=>r.c2c>0).length/rows.length
console.log('\n  （参考）日経が上がる素の確率 '+(base*100).toFixed(1)+'%')
