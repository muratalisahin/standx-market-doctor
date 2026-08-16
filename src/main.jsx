import React,{useEffect,useMemo,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{toPng}from"html-to-image";
import"./style.css";
const DISCLAIMER="Not investment advice";
const marketUrl=(s="") => import.meta.env.DEV
  ? (s
      ? `/standx-api/api/query_symbol_market?symbol=${encodeURIComponent(s)}`
      : `/standx-api/api/query_market_overview`)
  : `/api/market${s ? `?symbol=${encodeURIComponent(s)}` : ""}`;
const depthUrl=(s) => import.meta.env.DEV
  ? `/standx-api/api/query_depth_book?symbol=${encodeURIComponent(s)}`
  : `/api/depth?symbol=${encodeURIComponent(s)}`;
const klineUrl=(s,res,from,to)=>import.meta.env.DEV
  ? `/standx-api/api/kline/history?symbol=${encodeURIComponent(s)}&resolution=${encodeURIComponent(res)}&from=${from}&to=${to}`
  : `/api/kline?symbol=${encodeURIComponent(s)}&resolution=${encodeURIComponent(res)}&from=${from}&to=${to}`;
const TFS=[
 {id:"60",label:"1H",period:3600,pages:16,tol:0.0012,maxDist:0.045,hug:0.002,minSpan:0.008},
 {id:"240",label:"4H",period:14400,pages:12,tol:0.0018,maxDist:0.08,hug:0.0035,minSpan:0.018},
 {id:"1D",label:"1D",period:86400,pages:12,tol:0.0026,maxDist:0.14,hug:0.006,minSpan:0.028},
 {id:"1W",label:"1W",period:86400*7,pages:8,tol:0.004,maxDist:0.25,hug:0.012,minSpan:0.05}
];
const TV_MAP={
 "BTC-USD":"BINANCE:BTCUSDT",
 "ETH-USD":"BINANCE:ETHUSDT",
 "SOL-USD":"BINANCE:SOLUSDT",
 "BNB-USD":"BINANCE:BNBUSDT",
 "HYPE-USD":"MEXC:HYPEUSDT",
 "XAU-USD":"TVC:GOLD",
 "XAG-USD":"COMEX:SI1!",
 "TSLA-USD":"NASDAQ:TSLA",
 "CL-USD":"NYMEX:CL1!",
 "MU-USD":"NASDAQ:MU",
 "SPCX-USD":"NASDAQ:SPCX"
};
const PIVOT_TFS=[
 {id:"1H",label:"1H",hint:"1H swing",kind:"swing",binance:"1h",mexc:"60m",yahoo:"1h",limit:72,hug:0.005,minSpan:0.016},
 {id:"4H",label:"4H",hint:"4H swing",kind:"swing",binance:"4h",mexc:"4h",yahoo:"1h",limit:72,hug:0.008,minSpan:0.028},
 {id:"1D",label:"Daily",hint:"Traditional",kind:"pivot",binance:"1d",mexc:"1d",yahoo:"1d",limit:4,hug:0.01,minSpan:0.035},
 {id:"1W",label:"Weekly",hint:"Traditional",kind:"pivot",binance:"1w",mexc:"1W",yahoo:"1wk",limit:4,hug:0.015,minSpan:0.055}
];
function ohlcSource(s){
 const tv=TV_MAP[s]||"";
 const [ex,sym]=tv.split(":");
 if(ex==="BINANCE") return {kind:"binance",symbol:sym};
 if(ex==="MEXC") return {kind:"mexc",symbol:sym};
 if(ex==="NASDAQ") return {kind:"yahoo",symbol:sym};
 if(s==="XAU-USD") return {kind:"yahoo",symbol:"GC=F"};
 if(s==="XAG-USD") return {kind:"yahoo",symbol:"SI=F"};
 if(s==="CL-USD") return {kind:"yahoo",symbol:"CL=F"};
 return null;
}
function ohlcUrl(kind,symbol,interval,limit=4){
 if(import.meta.env.DEV){
  if(kind==="binance") return `/binance-api/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  if(kind==="mexc") return `/mexc-api/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  if(kind==="yahoo") return `/yahoo-api/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=3mo`;
 }
 return `/api/ohlc?source=${encodeURIComponent(kind)}&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
}
function parseBars(j){
 if(Array.isArray(j)){
  return j.map(r=>({t:+r[0],h:+r[2],l:+r[3],c:+r[4],closeT:+r[6]})).filter(x=>x.h>0&&x.l>0);
 }
 const r=j?.chart?.result?.[0];
 const q=r?.indicators?.quote?.[0];
 const ts=r?.timestamp||[];
 if(!q?.close?.length)return [];
 return ts.map((t,i)=>({t:t*1000,h:+q.high[i],l:+q.low[i],c:+q.close[i],closeT:(t+1)*1000})).filter(x=>x.h>0&&x.l>0);
}
function closedBars(rows){
 if(!rows?.length)return [];
 const last=rows[rows.length-1];
 return last.closeT&&last.closeT>Date.now()?rows.slice(0,-1):rows;
}
function parsePrevOhlc(j){
 const closed=closedBars(parseBars(j));
 const prev=closed[closed.length-1];
 return prev?{h:prev.h,l:prev.l,c:prev.c}:null;
}
function traditionalPivots(h,l,c){
 const p=(h+l+c)/3, range=h-l;
 return [
  {name:"R3",price:p*2+(h-2*l)},
  {name:"R2",price:p+range},
  {name:"R1",price:p*2-l},
  {name:"P",price:p},
  {name:"S1",price:p*2-h},
  {name:"S2",price:p-range},
  {name:"S3",price:p*2-(2*h-l)}
 ].filter(x=>Number.isFinite(x.price)&&x.price>0);
}
const TV_TF={"60":"|60","240":"|240","1D":"","1W":"|1W"};
const TV_CLASSIC=["Pivot.M.Classic.S3","Pivot.M.Classic.S2","Pivot.M.Classic.S1","Pivot.M.Classic.Middle","Pivot.M.Classic.R1","Pivot.M.Classic.R2","Pivot.M.Classic.R3"];
const TV_EXTRA=[
 "Pivot.M.Camarilla.S3","Pivot.M.Camarilla.S2","Pivot.M.Camarilla.S1","Pivot.M.Camarilla.R1","Pivot.M.Camarilla.R2","Pivot.M.Camarilla.R3",
 "Pivot.M.Fibonacci.S3","Pivot.M.Fibonacci.S2","Pivot.M.Fibonacci.S1","Pivot.M.Fibonacci.R1","Pivot.M.Fibonacci.R2","Pivot.M.Fibonacci.R3",
 "Pivot.M.Woodie.S3","Pivot.M.Woodie.S2","Pivot.M.Woodie.S1","Pivot.M.Woodie.R1","Pivot.M.Woodie.R2","Pivot.M.Woodie.R3"
];
const TV_PIVOTS=[...TV_CLASSIC,...TV_EXTRA];
function tvFields(){
 const f=["close"];
 for(const s of ["","|60","|240","|1W"]) for(const p of TV_PIVOTS) f.push(p+s);
 return f;
}
function tvUrl(ticker){
 const q=`symbol=${encodeURIComponent(ticker)}&fields=${encodeURIComponent(tvFields().join(","))}`;
 return import.meta.env.DEV?`/tv-scan/symbol?${q}`:`/api/tv?${q}`;
}
function tvRead(data,keys,suffix){
 const out=[];
 for(const p of keys){
  const v=data[p+suffix];
  if(typeof v==="number"&&Number.isFinite(v)&&v>0) out.push({name:p.replace("Pivot.M.","").replace(/\./g," "),price:v});
 }
 return out;
}
function tvNear(levels,price,side,hug){
 const list=side==="sup"
  ?levels.filter(x=>x.price<price-hug).sort((a,b)=>b.price-a.price)
  :levels.filter(x=>x.price>price+hug).sort((a,b)=>a.price-b.price);
 return list;
}
function tvAtLevel(levels,price,hug){
 let hit=null;
 for(const x of levels){
  if(Math.abs(x.price-price)<hug&&(!hit||Math.abs(x.price-price)<Math.abs(hit.price-price))) hit=x;
 }
 return hit;
}
function tvLevels(data,suffix,price){
 if(!data||!price)return null;
 const classic=tvRead(data,TV_CLASSIC,suffix);
 const extra=tvRead(data,TV_EXTRA,suffix);
 const all=[...classic,...extra];
 if(!all.length)return null;
 const hug=price*0.0012;
 const atLevel=tvAtLevel(classic.length?classic:all,price,hug);
 const sups=tvNear(classic,price,"sup",hug);
 const ress=tvNear(classic,price,"res",hug);
 const support=sups[0]||tvNear(extra,price,"sup",hug)[0]||null;
 const resistance=ress[0]||tvNear(extra,price,"res",hug)[0]||null;
 if(!support&&!resistance&&!atLevel)return null;
 return {
  support:support?.price??null,
  resistance:resistance?.price??null,
  supportName:support?.name,
  resistanceName:resistance?.name,
  nextSupport:sups[1]?.price??tvNear(all,price,"sup",hug).find(x=>!support||x.price<support.price*0.999)?.price??null,
  nextResistance:ress[1]?.price??tvNear(all,price,"res",hug).find(x=>!resistance||x.price>resistance.price*1.001)?.price??null,
  atLevel:atLevel?{price:atLevel.price,name:atLevel.name,source:"TradingView"}:null,
  supportSource:support?"TradingView":null,
  resistanceSource:resistance?"TradingView":null,
  source:"TradingView",
  classic,
  extra
 };
}
function tvSame(a,b,price){
 if(!a||!b||!price)return false;
 const s=a.support&&b.support&&Math.abs(a.support-b.support)/price<0.00025;
 const r=a.resistance&&b.resistance&&Math.abs(a.resistance-b.resistance)/price<0.00025;
 return !!(s&&r);
}
function uniqueLevels(rows,price){
 const out=[];
 for(const x of rows||[]){
  if(!x||!Number.isFinite(x.price))continue;
  if(out.some(y=>Math.abs(y.price-x.price)/price<0.0018))continue;
  out.push(x);
 }
 return out;
}
function widenPair(sups,ress,price,hug,minSpan){
 const sCands=uniqueLevels(sups.filter(x=>price-x.price>=hug),price);
 const rCands=uniqueLevels(ress.filter(x=>x.price-price>=hug),price);
 let best=null;
 for(const s of sCands){
  for(const r of rCands){
   const span=r.price-s.price;
   if(span<minSpan)continue;
   if(!best||span<best.span) best={s,r,span};
  }
 }
 if(best) return best;
 return {s:sCands[sCands.length-1]||sCands[0]||null,r:rCands[rCands.length-1]||rCands[0]||null};
}
function pivotLevels(ohlc,price,tf){
 if(!ohlc||!price)return null;
 const all=traditionalPivots(ohlc.h,ohlc.l,ohlc.c);
 if(!all.length)return null;
 const hug=price*(tf?.hug||0.008);
 const minSpan=price*(tf?.minSpan||0.028);
 const atLevel=tvAtLevel(all,price,hug);
 const sups=all.filter(x=>x.price<price).sort((a,b)=>b.price-a.price);
 const ress=all.filter(x=>x.price>price).sort((a,b)=>a.price-b.price);
 const {s:support,r:resistance}=widenPair(sups,ress,price,hug,minSpan);
 if(!support&&!resistance&&!atLevel)return null;
 return {
  support:support?.price??null,
  resistance:resistance?.price??null,
  supportName:support?.name,
  resistanceName:resistance?.name,
  nextSupport:sups.find(x=>support&&x.price<support.price*0.997)?.price??null,
  nextResistance:ress.find(x=>resistance&&x.price>resistance.price*1.002)?.price??null,
  atLevel:atLevel?{price:atLevel.price,name:atLevel.name,source:"TradingView"}:null,
  supportSource:support?"TradingView":null,
  resistanceSource:resistance?"TradingView":null,
  source:"TradingView"
 };
}
function swingLevels(bars,price,tf){
 if(!bars?.length||!price)return null;
 const label=tf?.label||"Swing";
 const hug=price*(tf?.hug||0.007);
 const minSpan=price*(tf?.minSpan||0.024);
 const w=bars.length<16?1:2;
 const last=bars.length-1;
 const lows=[],highs=[];
 for(let i=w;i<=last-w;i++){
  let isL=true,isH=true;
  for(let k=1;k<=w;k++){
   if(bars[i].l>bars[i-k].l||bars[i].l>=bars[i+k].l)isL=false;
   if(bars[i].h<bars[i-k].h||bars[i].h<=bars[i+k].h)isH=false;
  }
  if(isL) lows.push({name:`${label} swing`,price:bars[i].l,t:bars[i].t});
  if(isH) highs.push({name:`${label} swing`,price:bars[i].h,t:bars[i].t});
 }
 const rangeLow={name:`${label} low`,price:Math.min(...bars.map(x=>x.l))};
 const rangeHigh={name:`${label} high`,price:Math.max(...bars.map(x=>x.h))};
 const sups=[...lows,rangeLow].filter(x=>x.price<price).sort((a,b)=>b.price-a.price);
 const ress=[...highs,rangeHigh].filter(x=>x.price>price).sort((a,b)=>a.price-b.price);
 const {s:support,r:resistance}=widenPair(sups,ress,price,hug,minSpan);
 if(!support&&!resistance)return null;
 return {
  support:support?.price??null,
  resistance:resistance?.price??null,
  supportName:support?.name,
  resistanceName:resistance?.name,
  nextSupport:sups.find(x=>support&&x.price<support.price*0.997)?.price??null,
  nextResistance:ress.find(x=>resistance&&x.price>resistance.price*1.002)?.price??null,
  supportSource:"TradingView",
  resistanceSource:"TradingView",
  source:"TradingView"
 };
}
const MARK="/assets/standx-mark.png";
const LOGO="/assets/standx-logo.png";
const STANDER={
 front:"/assets/stander.png",
 angle:"/assets/stander-34.png",
 think:"/assets/stander-think.png",
 focus:"/assets/stander-focus.png",
 formal:"/assets/stander-formal.png"
};
const n=(v,d=2)=>v==null||v===""?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:d});
const money=v=>v==null?"—":Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
const pct=v=>v==null?"—":`${Number(v).toFixed(2)}%`;
const px=v=>{
 if(v==null||v==="")return "—";
 const x=Number(v);
 return x.toLocaleString(undefined,{maximumFractionDigits:x>=1000?2:x>=10?3:4});
};
function Stander({pose="front",className=""}){
 return <img className={`stander ${className}`} src={STANDER[pose]||STANDER.front} alt="Stander, the StandX mascot"/>;
}
function TradeLink({symbol}){
 if(!symbol)return null;
 return <a className="tradeBtn" href={`https://standx.com/perps?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer">TRADE ON STANDX</a>;
}
function parseKlines(j){
 if(!j||j.s!=="ok"||!Array.isArray(j.t))return [];
 return j.t.map((t,i)=>({t,o:+j.o[i],h:+j.h[i],l:+j.l[i],c:+j.c[i],v:+(j.v?.[i]||0)})).filter(c=>c.h>0&&c.l>0);
}
function clusterPrices(points,price,tol){
 const sorted=[...points].sort((a,b)=>a.price-b.price);
 const groups=[];
 for(const p of sorted){
  const g=groups.find(x=>Math.abs(x.price-p.price)/price<=tol);
  if(g){
   const n=g.touches+1;
   g.price=(g.price*g.touches+p.price)/n;
   g.vol+=p.vol;
   g.touches=n;
  }else groups.push({price:p.price,vol:p.vol,touches:1});
 }
 return groups;
}
function structureLevels(candles,price,tol=0.002){
 if(!candles?.length||!price)return null;
 const highs=candles.map(c=>c.h), lows=candles.map(c=>c.l), vols=candles.map(c=>c.v||1);
 const periodHigh=Math.max(...highs), periodLow=Math.min(...lows);
 const w=candles.length<14?1:2;
 const swings=[];
 const last=candles.length-1;
 for(let i=w;i<=last-w;i++){
  let isH=true,isL=true;
  for(let k=1;k<=w;k++){
   if(highs[i]<highs[i-k]||highs[i]<=highs[i+k])isH=false;
   if(lows[i]>lows[i-k]||lows[i]>=lows[i+k])isL=false;
  }
  if(isH)swings.push({price:highs[i],kind:"res",vol:vols[i]});
  if(isL)swings.push({price:lows[i],kind:"sup",vol:vols[i]});
 }
 const pick=(kind,bound)=>{
  const groups=clusterPrices(swings.filter(s=>s.kind===kind),price,tol)
   .filter(g=>kind==="sup"?g.price<price*0.9995:g.price>price*1.0005)
   .map(g=>{
    const dist=Math.abs(price-g.price)/price;
    return {...g,dist,score:(g.touches>=2?1.35:1)/(dist+0.0006)+Math.log10(g.vol+1)*0.2};
   })
   .sort((a,b)=>b.score-a.score);
  if(groups[0])return groups[0];
  if(kind==="sup"?bound<price*0.9995:bound>price*1.0005) return {price:bound,touches:1,dist:Math.abs(price-bound)/price,score:1};
  return null;
 };
 const support=pick("sup",periodLow);
 const resistance=pick("res",periodHigh);
 return {
  support:support?.price??null,
  resistance:resistance?.price??null,
  periodLow,
  periodHigh,
  supportTouches:support?.touches||0,
  resistanceTouches:resistance?.touches||0
 };
}
function srTitle(name,side){
 if(name&&/^[SRP]\d*$/i.test(name)) return name;
 if(name&&/classic|camarilla|fibonacci|woodie|demark/i.test(name)) return name.replace(/^next\s+/i,"");
 if(/swing/i.test(name||"")) return side==="sup"?"Swing support":"Swing resistance";
 if(/range low/i.test(name||"")) return "Range low";
 if(/range high/i.test(name||"")) return "Range high";
 return side==="sup"?"Support":"Resistance";
}
function uniqBars(rows){
 const byT=new Map();
 for(const c of rows) if(c?.t) byT.set(c.t,c);
 return [...byT.values()].sort((a,b)=>a.t-b.t);
}
function mergeKlineState(prev,next){
 const out={...prev};
 for(const id of Object.keys(next||{})) out[id]=uniqBars([...(prev[id]||[]),...(next[id]||[])]);
 return out;
}
function alignWall(level,wall,price){
 if(!level||!wall?.price||!price)return false;
 return Math.abs(level-wall.price)/price<=0.0035;
}
function clusterWall(levels,mid,dir){
 if(!levels?.length||!mid)return null;
 const width=mid*0.0012, buckets=new Map();
 for(const [p,q] of levels){
  if(!p||!q)continue;
  if(dir==="bid"&&p>=mid)continue;
  if(dir==="ask"&&p<=mid)continue;
  const key=Math.round(p/width)*width;
  buckets.set(key,(buckets.get(key)||0)+p*q);
 }
 let best=null,usd=0;
 for(const [price,notional] of buckets){ if(notional>usd){usd=notional;best=price;} }
 return best?{price:best,usd}:null;
}
function liqPrice(entry,leverage,side){
 const mm=0.005, im=1/Math.max(1,leverage);
 return side==="long"?Math.max(0,entry*(1-im+mm)):entry*(1+im-mm);
}
function liqVsLevels({side,liq,support,resistance,supportName,resistanceName,tfLabel}){
 if(!liq)return null;
 const sup=srTitle(supportName,"sup");
 const res=srTitle(resistanceName,"res");
 const tf=tfLabel||"";
 if(side==="long"){
  if(!(support>0)) return {status:"WAIT",headline:"No support to compare",detail:"Wait for a support print, then calculate again."};
  const gap=(support-liq)/support*100;
  if(liq<support){
   const tight=gap<0.8;
   return {
    status:tight?"TIGHT":"CLEAR",
    headline:tight?`Liq is only ${gap.toFixed(1)}% under ${tf} ${sup}`:`Liq is below ${tf} ${sup}`,
    detail:tight
     ?`${px(liq)} is under support ${px(support)}, but the buffer is thin. A wick through ${sup} can still take the long out.`
     :`${px(liq)} sits ${gap.toFixed(1)}% under ${px(support)}. A test of ${sup} should not liquidate this long.`
   };
  }
  return {
   status:"DANGER",
   headline:`Liq sits above ${tf} ${sup}`,
   detail:`${px(liq)} is above support ${px(support)}. A dip into ${sup} can liquidate the long before the idea is invalid.`
  };
 }
 if(!(resistance>0)) return {status:"WAIT",headline:"No resistance to compare",detail:"Wait for a resistance print, then calculate again."};
 const gap=(liq-resistance)/resistance*100;
 if(liq>resistance){
  const tight=gap<0.8;
  return {
   status:tight?"TIGHT":"CLEAR",
   headline:tight?`Liq is only ${gap.toFixed(1)}% over ${tf} ${res}`:`Liq is above ${tf} ${res}`,
   detail:tight
    ?`${px(liq)} is over resistance ${px(resistance)}, but the buffer is thin. A squeeze through ${res} can still take the short out.`
    :`${px(liq)} sits ${gap.toFixed(1)}% over ${px(resistance)}. A test of ${res} should not liquidate this short.`
  };
 }
 return {
  status:"DANGER",
  headline:`Liq sits below ${tf} ${res}`,
  detail:`${px(liq)} is below resistance ${px(resistance)}. A squeeze into ${res} can liquidate the short before the idea is invalid.`
 };
}
function depthUsd(levels,from,to){
 if(!levels?.length)return 0;
 const lo=Math.min(from,to), hi=Math.max(from,to);
 return levels.reduce((s,[p,q])=>p>=lo&&p<=hi?s+p*q:s,0);
}
function liquidationOdds({entry,liq,high,low,changePct,side,bidUsd,askUsd,sizeUsd,pathUsd}){
 const dist=Math.abs(entry-liq)/Math.max(entry,1e-9);
 const range=high&&low?(high-low)/entry:0;
 const dayMove=Math.abs(Number(changePct)||0)/100;
 const vol=Math.max(range,dayMove,0.004);
 let p=Math.exp(-Math.pow(dist/vol,1.35));
 const imb=(bidUsd-askUsd)/(bidUsd+askUsd+1);
 if(side==="long"&&imb<-0.12)p+=0.08;
 if(side==="short"&&imb>0.12)p+=0.08;
 if(sizeUsd&&pathUsd&&sizeUsd>pathUsd*0.25)p+=0.12;
 if(dist<0.02)p+=0.15;
 return Math.round(Math.min(92,Math.max(4,p*100)));
}
function doctorTake({side,leverage,odds,price,support,resistance,funding,changePct,score,vsStatus,pnlPct}){
 const toSup=support?(price-support)/price:1;
 const toRes=resistance?(resistance-price)/price:1;
 const fund=Number(funding)||0;
 const inProfit=Number(pnlPct)>0.4;
 let risk,sit,action,idea;
 if(odds>=55||leverage>=20||vsStatus==="DANGER"){
  risk="HIGH";
  action="CLOSE";
  sit="This is too tight. Close it or cut leverage so liq is outside the range.";
  idea=vsStatus==="DANGER"
   ?(side==="long"
     ?"Liq is sitting above support. A normal dip can wipe the long before the level even breaks. Close it, or add margin now."
     :"Liq is sitting below resistance. A squeeze can wipe the short before the level even breaks. Close it, or add margin now.")
   :"Liq is too close. I would not hold this. Close it, or cut the size hard.";
 }else if(toRes<0.004){
  if(side==="long"){
   risk="ELEVATED";
   action="TAKE PROFIT";
   sit="Price is at resistance. Take some off. Don't ride a full long into the level.";
   idea=inProfit
    ?"You're into resistance and this long is working. Take profit. Wait for a rejection, or a break and a retest."
    :"Price is kissing resistance. Holding the full long here is late. Trim it or get out, then wait.";
  }else{
   risk="MANAGEABLE";
   action="HOLD";
   sit="Let the short test resistance. Get out if the level breaks.";
   idea="Resistance is right here. Hold the short, don't add. If it breaks, cover.";
  }
 }else if(toSup<0.004){
  if(side==="long"){
   risk="MANAGEABLE";
   action="HOLD";
   sit="Hold at support. Invalidation is a break under the level.";
   idea="Price is on support. Hold the long, stop under the level. Don't add until it actually holds.";
  }else{
   risk="ELEVATED";
   action="TAKE PROFIT";
   sit="Support is here. Cover some. Don't sit a full short into the bounce.";
   idea=inProfit
    ?"The short worked and you're on support. Take profit and wait."
    :"Price is sitting on support. A full short here is late. Cover some, or get out.";
  }
 }else if(side==="long"&&changePct>1.5&&toRes<0.012){
  risk="ELEVATED";
  action="TAKE PROFIT";
  sit="This is a chase into resistance. Take some off.";
  idea="This long is chasing into resistance. Take profit. Don't hold out for more from here.";
 }else if(vsStatus==="TIGHT"){
  risk="ELEVATED";
  action="CUT SIZE";
  sit="The gap to liq is thin. Smaller size, or more margin.";
  idea="You can hold a smaller size. This one is too close to the level — cut it, or add margin.";
 }else if(odds>=30){
  risk="ELEVATED";
  action="CUT SIZE";
  sit=side==="long"
   ?"Keep it small. Add margin or lower leverage before the next swing."
   :"Keep it small. A squeeze into resistance can take this short out.";
  idea="This leverage is a bit much for the next swing. Cut size. You can still hold, just not this big.";
 }else if(fund>0.0002&&side==="long"){
  risk="ELEVATED";
  action="CUT SIZE";
  sit="Funding is paying shorts. Don't sit an oversized long.";
  idea="Funding is paying shorts. Don't sit a big long just because the day is green. Cut it down to planned size.";
 }else if(fund<-0.0002&&side==="short"){
  risk="ELEVATED";
  action="CUT SIZE";
  sit="Funding is paying longs. Don't sit an oversized short.";
  idea="Funding is paying longs. Don't sit a big short into that grind. Cut it down to planned size.";
 }else if(score>=80&&odds<30){
  risk="MANAGEABLE";
  action="HOLD";
  sit="You can hold the planned size. Don't scale up.";
  idea="You can hold this. Keep the size you planned — don't add. The book looks fine; the risk is still the leverage.";
 }else{
  risk="MANAGEABLE";
  action="WAIT";
  sit=side==="long"
   ?"Only hold if the stop is already under support. Otherwise wait."
   :"Only hold if the stop is already above resistance. Otherwise wait.";
  idea="Nothing to chase. Price is between levels. If you don't already have a stop, stay flat. If you do, hold and wait for a test.";
 }
 return {risk,sit,action,idea};
}

function logFit(v,p50,p90){
 const x=Math.log10(Math.max(Number(v)||0,1));
 const a=Math.log10(p50), b=Math.log10(p90);
 return Math.max(0,Math.min(100,50+(x-a)/(b-a)*40));
}
function health(m,d){
 const vol=logFit(m?.volume_quote_24h||m?.volume_24h,15e6,400e6);
 const oi=logFit(m?.open_interest_notional||m?.open_interest,8e6,250e6);
 const mid=Number(d?.mid||m?.last_price||0);
 const bps=mid&&d?.spread!=null?Number(d.spread)/mid*10000:2;
 const sp=Math.max(0,Math.min(100,100-bps*10));
 const fund=Math.max(0,Math.min(100,100-Math.abs(Number(m?.funding_rate||0))*10000*8));
 const book=d?logFit(d.bidUsd+d.askUsd,5e4,2e6):50;
 return Math.round(vol*.25+oi*.15+sp*.2+fund*.15+book*.25);
}
function Metric({name,value}){return <div className="metric"><span>{name}</span><b>{Math.round(value)}</b><div><i style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div></div>}
function App(){
 const [overview,setOverview]=useState(null),[symbol,setSymbol]=useState(""),[detail,setDetail]=useState(null),[loading,setLoading]=useState(true),[err,setErr]=useState(""),[liq,setLiq]=useState(0),[search,setSearch]=useState(""),[share,setShare]=useState(false),[side,setSide]=useState("long"),[leverage,setLeverage]=useState(10),[sizeInput,setSizeInput]=useState("1000"),[entryInput,setEntryInput]=useState(""),[tf,setTf]=useState("4H"),[klines,setKlines]=useState({}),[tvQuote,setTvQuote]=useState(null),[pivotOhlc,setPivotOhlc]=useState({}),[plan,setPlan]=useState(null);
 const symbolRef=useRef("");
 const prevSymbolRef=useRef("");
 const klineAtRef=useRef(0);
 const selectedHold=useRef(null);
 const cacheRef=useRef({klines:{},tv:{},detail:{},pivots:{}});
 const reqRef=useRef(0);
 const [klinesSym,setKlinesSym]=useState("");
 async function getOverview(){
  const r=await fetch(marketUrl(),{cache:"no-store"}); if(!r.ok)throw Error(); return r.json();
 }
 async function getTv(s){
  const ticker=TV_MAP[s];
  if(!ticker)return null;
  const r=await fetch(tvUrl(ticker),{cache:"no-store"});
  if(!r.ok)return null;
  const data=await r.json();
  if(!data||data.code||typeof data.close!=="number")return null;
  return {ticker,data};
 }
 async function getPivots(s){
  const src=ohlcSource(s);
  if(!src)return {};
  const pairs=await Promise.all(PIVOT_TFS.map(async t=>{
   const interval=src.kind==="yahoo"?t.yahoo:src.kind==="mexc"?t.mexc:t.binance;
   try{
    const r=await fetch(ohlcUrl(src.kind,src.symbol,interval,t.limit),{cache:"no-store"});
    if(!r.ok)return [t.id,null];
    const j=await r.json();
    if(t.kind==="swing") return [t.id,{bars:closedBars(parseBars(j))}];
    return [t.id,parsePrevOhlc(j)];
   }catch{return [t.id,null];}
  }));
  return Object.fromEntries(pairs);
 }
 async function getKlines(s,tf,pages){
  const to=Math.floor(Date.now()/1000);
  const period=tf.period;
  const n=Math.max(1,pages??tf.pages);
  const chunks=await Promise.all(Array.from({length:n},async(_,i)=>{
   const end=to-i*5*period;
   const start=end-6*period;
   try{
    const r=await fetch(klineUrl(s,tf.id,start,end),{cache:"no-store"});
    if(!r.ok)return [];
    return parseKlines(await r.json());
   }catch{return [];}
  }));
  return uniqBars(chunks.flat());
 }
 async function loadAllKlines(s,recentOnly){
  const pairs=await Promise.all(TFS.map(async t=>{
   try{return [t.id,await getKlines(s,t,recentOnly?1:t.pages)];}
   catch{return [t.id,[]];}
  }));
  return Object.fromEntries(pairs);
 }
 async function getDetail(s){
  const [a,b]=await Promise.all([
   fetch(marketUrl(s),{cache:"no-store"}).then(r=>r.json()),
   fetch(depthUrl(s),{cache:"no-store"}).then(r=>r.json())
  ]);
  const bids=(b.bids||[]).map(x=>[+x[0],+x[1]]).sort((a,c)=>c[0]-a[0]);
  const asks=(b.asks||[]).map(x=>[+x[0],+x[1]]).sort((a,c)=>a[0]-c[0]);
  const bidUsd=bids.slice(0,20).reduce((s,x)=>s+x[0]*x[1],0),askUsd=asks.slice(0,20).reduce((s,x)=>s+x[0]*x[1],0);
  const mid=+a.mid_price||+a.last_price||0, spread=Math.abs((+a.spread?.[1]||mid)-(+a.spread?.[0]||mid));
  return {a,b:{bidUsd,askUsd,mid,spread,bids,asks}};
 }
 useEffect(()=>{symbolRef.current=symbol},[symbol]);
 useEffect(()=>{
  let stop=false,busy=false;
  async function boot(){
   try{
    const o=await getOverview();
    if(stop)return;
    if(!o?.symbols?.length)throw Error();
    setOverview(o);
    setErr("");
    const s=o.symbols[0]?.symbol||"";
    if(s&&!symbolRef.current){symbolRef.current=s;setSymbol(s);}
   }catch{
    if(!stop)setErr("StandX market data could not be loaded.");
   }finally{
    if(!stop)setLoading(false);
   }
  }
  async function tick(){
   if(stop||busy||document.hidden)return;
   busy=true;
   const current=symbolRef.current;
   try{
    const [o,d]=await Promise.all([
     getOverview(),
     current?getDetail(current):null
    ]);
    if(stop)return;
    if(o?.symbols?.length){
     setOverview(o);
     setErr("");
    }
    if(d&&current===symbolRef.current){
     cacheRef.current.detail[current]=d;
     setDetail(d);
    }
    if(current&&Date.now()-klineAtRef.current>20000){
     klineAtRef.current=Date.now();
     const [bars,tv,piv]=await Promise.all([loadAllKlines(current,true),getTv(current),getPivots(current)]);
     if(!stop&&symbolRef.current===current){
      setKlines(prev=>{
       const merged=mergeKlineState(prev,bars);
       cacheRef.current.klines[current]=merged;
       return merged;
      });
      setKlinesSym(current);
      if(tv){cacheRef.current.tv[current]=tv;setTvQuote(tv);}
      if(piv){cacheRef.current.pivots[current]=piv;setPivotOhlc(piv);}
     }
    }
   }catch{}
   finally{busy=false;}
  }
  boot();
  const id=setInterval(tick,8000);
  const onVis=()=>{if(!document.hidden)tick();};
  document.addEventListener("visibilitychange",onVis);
  return()=>{stop=true;clearInterval(id);document.removeEventListener("visibilitychange",onVis);}
 },[]);
 useEffect(()=>{
  if(!symbol)return;
  const switched=!!(prevSymbolRef.current&&prevSymbolRef.current!==symbol);
  prevSymbolRef.current=symbol;
  const cache=cacheRef.current;
  if(switched){
   setEntryInput("");
   setPlan(null);
   if(cache.klines[symbol]){setKlines(cache.klines[symbol]);setKlinesSym(symbol);}
   else setKlinesSym("");
   if(cache.tv[symbol])setTvQuote(cache.tv[symbol]);
   if(cache.detail[symbol])setDetail(cache.detail[symbol]);
   if(cache.pivots[symbol])setPivotOhlc(cache.pivots[symbol]);
  }
  const req=++reqRef.current;
  let stop=false;
  getDetail(symbol).then(d=>{
   if(stop||req!==reqRef.current)return;
   cache.detail[symbol]=d;
   setDetail(d);
  }).catch(()=>{});
  (async()=>{
   try{
    const recent=await loadAllKlines(symbol,true);
    if(stop||req!==reqRef.current)return;
    setKlines(prev=>{
     const merged=cache.klines[symbol]?mergeKlineState(cache.klines[symbol],recent):recent;
     cache.klines[symbol]=merged;
     return merged;
    });
    setKlinesSym(symbol);
    klineAtRef.current=Date.now();
    const full=await loadAllKlines(symbol,false);
    if(stop||req!==reqRef.current)return;
    cache.klines[symbol]=full;
    setKlines(full);
    setKlinesSym(symbol);
   }catch{}
  })();
  getTv(symbol).then(tv=>{
   if(stop||req!==reqRef.current||!tv)return;
   cache.tv[symbol]=tv;
   setTvQuote(tv);
  }).catch(()=>{});
  getPivots(symbol).then(piv=>{
   if(stop||req!==reqRef.current||!piv)return;
   cache.pivots[symbol]=piv;
   setPivotOhlc(piv);
  }).catch(()=>{});
  return()=>{stop=true};
 },[symbol]);
 const liveDetail=detail?.a?.symbol===symbol?detail:null;
 const selectedNow=overview?.symbols?.find(x=>x.symbol===symbol)||liveDetail?.a;
 if(selectedNow)selectedHold.current=selectedNow;
 const selected=selectedNow||selectedHold.current;
 const score=health(selected,liveDetail?.b),sim=Math.max(0,Math.min(100,Math.round(score+liq*.18)));
 const status=score>=80?"HEALTHY":score>=60?"WATCH":"NEEDS ATTENTION";
 const filtered=(overview?.symbols||[]).filter(x=>x.symbol.toLowerCase().includes(search.toLowerCase())||x.base?.toLowerCase().includes(search.toLowerCase()));
 const signals=useMemo(()=>{
  const m=selected,d=liveDetail?.b;
  const mid=Number(d?.mid||m?.last_price||0);
  const bps=mid&&d?.spread!=null?Number(d.spread)/mid*10000:2;
  return {
   liquidity:d?logFit(d.bidUsd+d.askUsd,5e4,2e6):50,
   volume:logFit(m?.volume_quote_24h||m?.volume_24h,15e6,400e6),
   oi:logFit(m?.open_interest_notional||m?.open_interest,8e6,250e6),
   spread:Math.max(0,Math.min(100,100-bps*10)),
   funding:Math.max(0,Math.min(100,100-Math.abs(Number(m?.funding_rate||0))*10000*8))
  }
 },[selected,liveDetail]);
 const market={...selected,...(liveDetail?.a||{})};
 const book=liveDetail?.b;
 const price=Number(market.mark_price||market.last_price||book?.mid||0);
 const bidWall=clusterWall(book?.bids,price,"bid");
 const askWall=clusterWall(book?.asks,price,"ask");
 const tfMeta=PIVOT_TFS.find(t=>t.id===tf)||PIVOT_TFS[1];
 const tfMap=useMemo(()=>{
  const empty={support:null,resistance:null,source:null};
  const out={};
  for(const t of PIVOT_TFS){
   const raw=pivotOhlc?.[t.id];
   out[t.id]=t.kind==="swing"?swingLevels(raw?.bars,price,t)||empty:pivotLevels(raw,price,t)||empty;
  }
  return out;
 },[price,pivotOhlc]);
 const structured=tfMap[tf];
 const dayLow=Number(market.low_price_24h||0), dayHigh=Number(market.high_price_24h||0);
 const support=structured?.support||null;
 const resistanceLevel=structured?.resistance||null;
 const low=dayLow;
 const high=dayHigh;
 const bookConfirmsSupport=alignWall(support,bidWall,price);
 const bookConfirmsRes=alignWall(resistanceLevel,askWall,price);
 const srSupportNote=structured?.supportName
  ?srTitle(structured.supportName,"sup")
  :"Waiting for levels";
 const srResNote=structured?.resistanceName
  ?srTitle(structured.resistanceName,"res")
  :"Waiting for levels";
 const typed=Number(entryInput);
 const draftEntry=typed>0?typed:price;
 const usedLive=!(typed>0);
 const sizeUsd=Number(sizeInput);
 const draftSize=sizeUsd>0?sizeUsd:0;
 const formKey=`${side}|${leverage}|${draftSize||""}|${usedLive?"live":draftEntry||""}`;
 function calculateTrade(){
  if(!draftEntry)return;
  const fill=draftEntry;
  const size=draftSize||0;
  const liq=liqPrice(fill,leverage,side);
  const path=book?depthUsd(side==="long"?book.bids:book.asks,fill,liq||fill):0;
  const chance=liquidationOdds({
   entry:fill,liq,high,low,changePct:market.price_change_pct,side,
   bidUsd:book?.bidUsd||0,askUsd:book?.askUsd||0,sizeUsd:size,pathUsd:path
  });
  const note=doctorTake({
   side,leverage,odds:chance||0,price,support,resistance:resistanceLevel,
   funding:market.funding_rate,changePct:Number(market.price_change_pct||0),score,
   vsStatus:liqVsLevels({
    side,liq,support,resistance:resistanceLevel,
    supportName:structured?.supportName,resistanceName:structured?.resistanceName,tfLabel:tfMeta.label
   })?.status,
   pnlPct:price?(side==="long"?(price-fill)/fill:(fill-price)/fill)*100:null
  });
  setPlan({
   key:formKey,symbol,side,leverage,sizeUsd:size,entry:fill,usedLive,mark:price,
   liq,odds:chance,distPct:Math.abs(fill-liq)/fill*100,take:note
  });
 }
 const entry=plan?.entry||draftEntry;
 const liqPx=plan?.liq??null;
 const odds=plan?.odds??null;
 const distPct=plan?.distPct??null;
 const pnlPct=plan&&price?(plan.side==="long"?(price-plan.entry)/plan.entry:(plan.entry-price)/plan.entry)*100:null;
 const stale=!!(plan&&plan.key!==formKey);
 const vs=plan?liqVsLevels({
  side:plan.side,liq:plan.liq,support,resistance:resistanceLevel,
  supportName:structured?.supportName,resistanceName:structured?.resistanceName,tfLabel:tfMeta.label
 }):null;
 const take=plan?doctorTake({
  side:plan.side,leverage:plan.leverage,odds:plan.odds||0,price,support,resistance:resistanceLevel,
  funding:market.funding_rate,changePct:Number(market.price_change_pct||0),score,
  vsStatus:vs?.status,pnlPct
 }):null;
 const vs1h=plan?liqVsLevels({side:plan.side,liq:plan.liq,support:tfMap["1H"]?.support,resistance:tfMap["1H"]?.resistance,supportName:tfMap["1H"]?.supportName,resistanceName:tfMap["1H"]?.resistanceName,tfLabel:"1H"}):null;
 const vs4h=plan?liqVsLevels({side:plan.side,liq:plan.liq,support:tfMap["4H"]?.support,resistance:tfMap["4H"]?.resistance,supportName:tfMap["4H"]?.supportName,resistanceName:tfMap["4H"]?.resistanceName,tfLabel:"4H"}):null;
 const mascotPose=status==="HEALTHY"?"formal":"think";
 const span=resistanceLevel&&support?resistanceLevel-support:0;
 const pricePos=span?Math.max(4,Math.min(96,(price-support)/span*100)):50;
 const entryPos=span&&plan?.entry?Math.max(4,Math.min(96,(plan.entry-support)/span*100)):null;
 const tickPos=entryPos??pricePos;
 const liqPos=span&&plan?.liq!=null?Math.max(-8,Math.min(108,(plan.liq-support)/span*100)):null;
 function ShareCard({m,score,status,signals,onClose}){
 const shotRef=useRef(null);
 const [saving,setSaving]=useState(false);
 const note=score>=80?"Market conditions look healthy.":score>=60?"Some signals need monitoring.":"Several signals need attention.";
 const copy=async()=>{try{await navigator.clipboard.writeText(`StandX Market Doctor — ${m.symbol} ${score}/100 ${status}`);alert("Report summary copied.");}catch{}};
 const download=async()=>{
  if(!shotRef.current||saving)return;
  setSaving(true);
  try{
   const dataUrl=await toPng(shotRef.current,{
    cacheBust:true,
    pixelRatio:2,
    backgroundColor:"#ffffff",
    skipFonts:true
   });
   const a=document.createElement("a");
   a.download=`standx-market-doctor-${m.symbol}-${score}.png`;
   a.href=dataUrl;
   a.click();
  }catch{
   alert("PNG download failed. Try again.");
  }
  setSaving(false);
 };
 return <div className="overlay" onClick={onClose}><div className="shareCard" onClick={e=>e.stopPropagation()}>
   <div className="shareShot" ref={shotRef}>
     <div className="shareTop"><img src={LOGO} alt="StandX"/><div>MARKET DOCTOR</div></div>
     <div className="shareHero"><div><span>STANDX MARKET REPORT</span><h2>{m.symbol}</h2><p>{side.toUpperCase()} · {leverage}x · entry {px(entry)}{usedLive?" (live)":""}</p></div><Stander pose={score>=80?"formal":"front"} className="standerShare"/></div>
     <div className="shareScore"><strong>{score}</strong><span>/100</span><b>{status}</b></div>
     <div className="shareSignals">{[["Liquidity",signals.liquidity],["Volume",signals.volume],["Open Interest",signals.oi],["Spread",signals.spread],["Funding",signals.funding]].map(([x,v])=><div key={x}><span>{x}</span><b>{Math.round(v)}</b></div>)}</div>
     <div className="shareLevels"><div><span>MARK</span><b>{px(price)}</b></div><div><span>ENTRY</span><b>{px(entry)}</b></div><div><span>LIQ PRICE</span><b>{plan?px(liqPx):"—"}</b></div><div><span>LIQ CHANCE</span><b>{odds??"—"}%</b></div></div>
     <div className="shareTf">
       {[["1H",tfMap["1H"],vs1h],["4H",tfMap["4H"],vs4h]].map(([lab,lv,cmp])=><div key={lab}>
         <span>{lab} STATUS</span>
         {lv?.atLevel&&<small>Testing {srTitle(lv.atLevel.name,"sup")} · {px(lv.atLevel.price)}</small>}
         <b>{srTitle(lv?.supportName,"sup")} {px(lv?.support)}</b>
         <b>{srTitle(lv?.resistanceName,"res")} {px(lv?.resistance)}</b>
         <em className={cmp?.status||""}>{cmp?.headline||"Calculate to compare liq"}</em>
       </div>)}
     </div>
     <div className="shareNote"><div className="takeHead"><img src={LOGO} alt="StandX"/><small>STANDX DOCTOR DIAGNOSIS · {DISCLAIMER}</small></div><p><b>{take?.action||"WAIT"}</b> — {take?.idea||note}</p><p className="standerLine">Stander: “Please manage your risk.”</p></div>
   </div>
   <div className="shareFoot">
     <span>StandX Market Doctor</span>
     <div className="shareActions">
       <button type="button" className="shareGhost" onClick={copy}>COPY</button>
       <button type="button" onClick={download}>{saving?"SAVING PNG...":"DOWNLOAD PNG"}</button>
     </div>
   </div>
 </div></div>}
return <main>
  <header>
    <div className="brand">
      <img src={MARK} alt="StandX" className="brandMark"/>
      <div>StandX <b>Market Doctor</b></div>
    </div>
    <div className="live"><i/> LIVE · ALL MARKETS · 8s</div>
  </header>
  <section className="hero">
   <div><p className="eyebrow">MARKET INTELLIGENCE</p><h1>Diagnose every market.<br/><em>Understand the risk.</em></h1><p className="sub">Live StandX market overview with health signals, liquidity, activity, funding and open interest.</p></div>
   <div className="heroArt">
    <div className="heroMascot"><Stander pose="angle" className="standerHero"/><small>Stander · on call</small></div>
    <div className="summary"><span>SUPPORTED MARKETS</span><strong>{overview?.summary?.symbol_count??overview?.symbols?.length??"—"}</strong><small>24H VOLUME · ${money(overview?.summary?.volume_quote_24h)}</small></div>
   </div>
  </section>
  <div className="layout">
   <aside className="markets card"><div className="asideHead"><div><div className="label">ALL MARKETS</div><small>{overview?.symbols?.length||0} markets</small></div><input placeholder="Search" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <div className="marketList">{filtered.map(x=><button className={x.symbol===symbol?"active":""} key={x.symbol} onClick={()=>setSymbol(x.symbol)}><span><b>{x.base}</b><small>{x.symbol}</small></span><strong>{money(x.last_price)}</strong><em className={Number(x.price_change_pct)>=0?"up":"down"}>{x.price_change_pct==null?"—":pct(x.price_change_pct)}</em></button>)}</div></aside>
   <section className="content">
    {err&&<div className="error">{err}</div>}
    {loading&&!selected?<div className="loading"><Stander pose="think" className="standerLoading"/><span>Scanning all StandX markets...</span></div>:selected&&<><div className="topline"><div><span className="eyebrow">SELECTED MARKET</span><h2>{selected.symbol}</h2></div><div className="priceBox"><b>{money(selected.last_price)}</b><span className={Number(selected.price_change_pct)>=0?"up":"down"}>{pct(selected.price_change_pct)} 24H</span></div></div>
    <div className="cards">
      <div className="card health"><div className="healthTop"><div><div className="label">MARKET HEALTH</div><div className="score">{score}<small>/100</small></div></div><Stander pose={mascotPose} className="standerHealth"/></div><strong className="pill">{status}</strong><div className="bar"><i style={{width:`${score}%`}}/></div><p>Composite score from liquidity, volume, open interest, spread and funding.</p></div>
      <div className="card diagnosis"><div className="diagnosisTop"><div className="label">MARKET DIAGNOSIS</div><Stander pose="focus" className="standerFocus"/></div><h3>{status==="HEALTHY"?"Conditions look healthy.":status==="WATCH"?"Conditions need monitoring.":"Conditions need attention."}</h3><p>{score>=80?"Strong activity and market depth are supporting current conditions.":score>=60?"Several signals are mixed. Watch liquidity and positioning.":"Multiple signals are weak. Execution conditions may be less resilient."}</p><div className="facts"><span>24H VOL <b>${money(selected.volume_quote_24h)}</b></span><span>OPEN INTEREST <b>${money(selected.open_interest_notional)}</b></span></div><button className="shareBtn" onClick={()=>setShare(true)}>GENERATE DOCTOR REPORT</button></div>
      <div className="card signals"><div className="label">DIAGNOSTIC SIGNALS</div><Metric name="Liquidity" value={signals.liquidity}/><Metric name="Volume" value={signals.volume}/><Metric name="Open Interest" value={signals.oi}/><Metric name="Spread" value={signals.spread}/><Metric name="Funding" value={signals.funding}/></div>
      <div className="card whatif"><div className="label">WHAT IF?</div><h3>Liquidity shock simulator</h3><p>Explore how a change in liquidity would move the health score.</p><input type="range" min="-50" max="50" value={liq} onChange={e=>setLiq(+e.target.value)}/><div className="range"><span>-50%</span><b>{liq>0?"+":""}{liq}%</b><span>+50%</span></div><div className="sim"><span>SIMULATED HEALTH</span><strong>{sim}</strong></div></div>
      <div className="card prescription"><div className="label">MARKET PRESCRIPTION</div>{[["Liquidity",signals.liquidity],["Volume",signals.volume],["Open Interest",signals.oi],["Spread",signals.spread],["Funding",signals.funding]].map(([x,v])=><div className="row" key={x}><span>{x}</span><b>{v>=75?"Healthy":v>=55?"Monitor":"Attention"}</b></div>)}<p className="note">Educational visualization only. {DISCLAIMER}.</p></div>
      <div className="card desk">
        <div className="deskHead">
          <div>
            <div className="label">OPEN TRADE DESK</div>
            <h3>If you open this now</h3>
            <p>Enter the trade, then calculate. Liquidation is for that fill, not live mark drift. 1H/4H use chart swings; Daily/Weekly use TradingView Traditional pivots. {DISCLAIMER}.</p>
          </div>
          <Stander pose={odds>=45?"think":"focus"} className="standerDesk"/>
        </div>
        <div className="deskControls">
          <div className="sideToggle">
            <button type="button" className={side==="long"?"on":""} onClick={()=>setSide("long")}>LONG</button>
            <button type="button" className={side==="short"?"on short":""} onClick={()=>setSide("short")}>SHORT</button>
          </div>
          <label>Leverage <b>{leverage}x</b>
            <input type="range" min="2" max="25" value={leverage} onChange={e=>setLeverage(+e.target.value)}/>
          </label>
          <label>Entry price <b>{usedLive?"LIVE MARK":"YOUR FILL"}</b>
            <span className="entryWrap">
              <input type="number" min="0" step="any" inputMode="decimal" value={entryInput} placeholder={price?String(price):"Fill price"} onChange={e=>setEntryInput(e.target.value)}/>
              <button type="button" className="liveBtn" onClick={()=>setEntryInput(price?String(price):"")}>LIVE</button>
            </span>
          </label>
          <label>Size USD <b>{draftSize>0?"YOUR SIZE":"TYPE SIZE"}</b>
            <input type="number" min="0" step="any" inputMode="decimal" value={sizeInput} placeholder="e.g. 250" onChange={e=>setSizeInput(e.target.value)}/>
          </label>
          <button type="button" className="calcBtn" onClick={calculateTrade}>CALCULATE</button>
        </div>
        <TradeLink symbol={symbol||selected.symbol}/>
        {plan?<div className={`calcResult ${stale?"stale":""}`}>
          <div className="takeHead"><img src={LOGO} alt="StandX"/><span>STANDX DOCTOR DIAGNOSIS · {DISCLAIMER}</span></div>
          <p>For your <b>{plan.side.toUpperCase()} {plan.leverage}x</b> at <b>{px(plan.entry)}</b>{plan.usedLive?" (live mark)":""} · ${money(plan.sizeUsd)}, isolated liquidation is <b>{px(plan.liq)}</b>.{stale?" Recalculate to update.":""}</p>
          <p><b>{take?.action||"READ"}</b> — {take?.idea}</p>
          <p className="standerLine">Stander: “Please manage your risk.”</p>
        </div>:<p className="calcHint">Calculate to get the StandX doctor's diagnosis for the trade you entered.</p>}
        <div className="deskGrid">
          <div className={`deskStat ${odds>=55?"hot":odds>=30?"warm":"cool"}`}>
            <span>LIQUIDATION CHANCE</span>
            <strong>{odds??"—"}%</strong>
            <small>{plan?`${plan.leverage}x isolated · ${distPct==null?"—":`${distPct.toFixed(1)}% away`}`:"Calculate the trade first"}</small>
          </div>
          <div className="deskStat">
            <span>LIQUIDATION PRICE</span>
            <strong>{plan?px(liqPx):"—"}</strong>
            <small>{plan?`For your ${plan.side.toUpperCase()} at ${px(plan.entry)}${pnlPct==null?"":` · ${pnlPct>=0?"+":""}${pnlPct.toFixed(2)}% vs mark`}`:"Liq for the fill you entered"}</small>
          </div>
          <div className={`deskStat risk-${take?.risk||"MANAGEABLE"}`}>
            <span>YOUR RISK</span>
            <strong>{take?.risk||"—"}</strong>
            <small>{take?.sit}</small>
          </div>
        </div>
        {vs&&<div className={`liqVs ${vs.status.toLowerCase()}`}>
          <span>LIQ VS {tfMeta.label}</span>
          <strong>{vs.headline}</strong>
          <small>{vs.detail}</small>
        </div>}
        <div className="tfRow">
          {PIVOT_TFS.map(t=><button type="button" key={t.id} className={tf===t.id?"on":""} onClick={()=>setTf(t.id)}>{t.label}</button>)}
        </div>
        {structured?.atLevel&&<p className="atLevel">Price is testing {srTitle(structured.atLevel.name,"sup")} at {px(structured.atLevel.price)} — that is mark, not support.</p>}
        <div className={`levels ${support||resistanceLevel?"":"pending"}`}>
          <div>
            <span>{tfMeta.label} · {srTitle(structured?.supportName,"sup").toUpperCase()}</span>
            <b>{px(support)}</b>
            <small>
              {srSupportNote}
              {structured?.nextSupport?` · next ${px(structured.nextSupport)}`:""}
              {bookConfirmsSupport?" · bid wall confirms":""}
            </small>
          </div>
          <div>
            <span>{tfMeta.label} · {srTitle(structured?.resistanceName,"res").toUpperCase()}</span>
            <b>{px(resistanceLevel)}</b>
            <small>
              {srResNote}
              {structured?.nextResistance?` · next ${px(structured.nextResistance)}`:""}
              {bookConfirmsRes?" · ask wall confirms":""}
            </small>
          </div>
        </div>
        <div className="tfGrid">
          {PIVOT_TFS.map(t=>{
           const lv=tfMap[t.id];
           return <button type="button" key={t.id} className={tf===t.id?"on":""} onClick={()=>setTf(t.id)}>
             <span>{t.label} · {t.hint}</span>
             <b><i>{srTitle(lv?.supportName,"sup")}</i> {px(lv?.support)}</b>
             <b><i>{srTitle(lv?.resistanceName,"res")}</i> {px(lv?.resistance)}</b>
           </button>;
          })}
        </div>
        <div className="srBar" aria-hidden="true">
          <i className="srFill" style={{width:`${pricePos}%`}}/>
          <em className={plan?"srEntry":""} style={{left:`${tickPos}%`}}/>
          {liqPos!=null&&<u className="srLiq" style={{left:`${liqPos}%`}}/>}
          <span className="srL">Support</span>
          <span className="srM" style={{left:`${Math.max(16,Math.min(84,tickPos))}%`}}>{plan?"Giriş fiyatınız bu":"Price"}</span>
          <span className="srR">Resistance</span>
          {liqPos!=null&&<span className="srLiqLab" style={{left:`${Math.max(8,Math.min(92,liqPos))}%`}}>Liq</span>}
        </div>
        <div className="take">
          <div className="takeHead"><img src={LOGO} alt="StandX"/><small>STANDX DOCTOR DIAGNOSIS · {DISCLAIMER}</small></div>
          {plan?<>
            <p><b>{take?.action}</b> — {take?.idea}</p>
            <div className="standerSay"><Stander pose={take?.action==="CLOSE"||take?.action==="TAKE PROFIT"?"think":"focus"} className="standerTalk"/><q>Please manage your risk.</q></div>
          </>:<p>Calculate the trade to see the StandX doctor's diagnosis.</p>}
        </div>
      </div>
    </div></>}
   </section>
  </div>
  {share&&selected&&<ShareCard m={selected} score={score} status={status} signals={signals} onClose={()=>setShare(false)}/>}<footer><Stander pose="front" className="standerFoot"/>Built for the StandX community · Public market data · Auto-refresh 8s</footer>
 </main>
}
createRoot(document.getElementById("root")).render(<App/>);
