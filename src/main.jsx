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
function tvPick(levels,price,side){
 const eps=price*0.00005;
 const list=side==="sup"
  ?levels.filter(x=>x.price<=price+eps).sort((a,b)=>b.price-a.price)
  :levels.filter(x=>x.price>=price-eps).sort((a,b)=>a.price-b.price);
 return list;
}
function tvLevels(data,suffix,price){
 if(!data||!price)return null;
 const classic=tvRead(data,TV_CLASSIC,suffix);
 const extra=tvRead(data,TV_EXTRA,suffix);
 const all=[...classic,...extra];
 if(!all.length)return null;
 let support=tvPick(classic,price,"sup")[0]||tvPick(extra,price,"sup")[0]||null;
 let resistance=tvPick(classic,price,"res")[0]||tvPick(extra,price,"res")[0]||null;
 if(support&&resistance&&Math.abs(support.price-resistance.price)/price<0.0004){
  resistance=tvPick(classic,price,"res").find(x=>x.price>support.price*1.0004)
   ||tvPick(all,price,"res").find(x=>x.price>support.price*1.0004)
   ||null;
 }
 if(!support&&!resistance)return null;
 const nextSupport=tvPick(all,price,"sup").find(x=>!support||x.price<support.price*0.9996)?.price??null;
 const nextResistance=tvPick(all,price,"res").find(x=>!resistance||x.price>resistance.price*1.0004)?.price??null;
 return {
  support:support?.price??null,
  resistance:resistance?.price??null,
  supportName:support?.name,
  resistanceName:resistance?.name,
  nextSupport,
  nextResistance,
  classic,
  extra
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
function pickSR(tv,bars,price,tf){
 if(!price)return {support:null,resistance:null,source:null,bars,tv};
 const cap=price*tf.maxDist;
 const hug=price*(tf.hug||0.002);
 const minSpan=price*(tf.minSpan||0.01);
 const allowCamarilla=tf.id==="60";
 const rank=name=>{
  const n=(name||"").toLowerCase();
  if(/classic s1$|classic r1$|classic middle/.test(n)) return 5;
  if(n.includes("swing")) return 4;
  if(n.includes("classic")) return 3;
  if(n.includes("fibonacci")||n.includes("woodie")) return 2;
  if(n.includes("range")) return 1;
  if(n.includes("camarilla")) return allowCamarilla?1:0;
  return 2;
 };
 const sups=[],ress=[];
 let atLevel=null;
 const push=(v,source,name)=>{
  if(typeof v!=="number"||!Number.isFinite(v)||v<=0)return;
  if(!allowCamarilla&&/camarilla/i.test(name||""))return;
  if(Math.abs(v-price)<hug){
   if(!atLevel||Math.abs(v-price)<Math.abs(atLevel.price-price)) atLevel={price:v,source,name};
   return;
  }
  if(v<price){
   if(price-v>cap)return;
   sups.push({price:v,source,name,rank:rank(name)});
  }else if(v>price){
   if(v-price>cap)return;
   ress.push({price:v,source,name,rank:rank(name)});
  }
 };
 for(const x of tv?.classic||[]) push(x.price,"TradingView",x.name);
 for(const x of tv?.extra||[]) push(x.price,"TradingView",x.name);
 push(bars?.support,"StandX",`${bars?.supportTouches||1} swing touches`);
 push(bars?.resistance,"StandX",`${bars?.resistanceTouches||1} swing touches`);
 push(bars?.periodLow,"StandX","range low");
 push(bars?.periodHigh,"StandX","range high");
 const collapse=(arr,dir)=>{
  arr.sort((a,b)=>dir==="sup"?b.price-a.price:a.price-b.price);
  const out=[];
  for(const x of arr){
   const near=out.find(y=>Math.abs(y.price-x.price)/price<0.0025);
   if(!near) out.push({...x});
   else if(x.rank>near.rank){
    near.source=x.source; near.name=x.name; near.rank=x.rank;
   }else if(x.source==="TradingView"&&near.source!=="TradingView"&&x.rank>=near.rank){
    near.source="TradingView"; near.name=x.name;
   }
  }
  return out;
 };
 const sList=collapse(sups,"sup");
 const rList=collapse(ress,"res");
 const take=(list,dir)=>{
  if(!list.length)return null;
  const far=list.filter(x=>Math.abs(price-x.price)>=hug);
  const pool=far.length?far:list;
  const primary=pool.filter(x=>x.rank>=3);
  const use=primary.length?primary:pool;
  return [...use].sort((a,b)=>b.rank-a.rank||(dir==="sup"?b.price-a.price:a.price-b.price))[0]||null;
 };
 let support=take(sList,"sup");
 let resistance=take(rList,"res");
 if(support&&resistance){
  for(let i=0;i<6&&resistance.price-support.price<minSpan;i++){
   const dS=price-support.price, dR=resistance.price-price;
   if(dR<=dS){
    const nxt=rList.find(x=>x.price>resistance.price*1.0015);
    if(!nxt)break;
    resistance=nxt;
   }else{
    const nxt=sList.find(x=>x.price<support.price*0.9985);
    if(!nxt)break;
    support=nxt;
   }
  }
 }
 const usedTv=support?.source==="TradingView"||resistance?.source==="TradingView";
 return {
  support:support?.price??null,
  resistance:resistance?.price??null,
  supportName:support?.name,
  resistanceName:resistance?.name,
  supportSource:support?.source||null,
  resistanceSource:resistance?.source||null,
  nextSupport:sList.find(x=>support&&x.price<support.price*0.998)?.price??null,
  nextResistance:rList.find(x=>resistance&&x.price>resistance.price*1.002)?.price??null,
  atLevel,
  source:usedTv?"TradingView":(support||resistance)?"StandX":null,
  bars,
  tv
 };
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

function health(m,d){
 const vol=Math.min(100,Math.log10(Number(m?.volume_quote_24h||m?.volume_24h||0)+1)*16);
 const oi=Math.min(100,Math.log10(Number(m?.open_interest_notional||m?.open_interest||0)+1)*18);
 const mid=Number(d?.mid||m?.last_price||0), spread=Number(d?.spread||0);
 const sp=mid?Math.max(0,100-(spread/mid)*100000):60;
 const fund=Math.max(0,100-Math.abs(Number(m?.funding_rate||0))*100000);
 const liq=d?Math.min(100,Math.log10((d.bidUsd+d.askUsd)+1)*14):55;
 return Math.round(vol*.25+oi*.15+sp*.2+fund*.15+liq*.25);
}
function Metric({name,value}){return <div className="metric"><span>{name}</span><b>{Math.round(value)}</b><div><i style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div></div>}
function App(){
 const [overview,setOverview]=useState(null),[symbol,setSymbol]=useState(""),[detail,setDetail]=useState(null),[loading,setLoading]=useState(true),[err,setErr]=useState(""),[liq,setLiq]=useState(0),[search,setSearch]=useState(""),[share,setShare]=useState(false),[side,setSide]=useState("long"),[leverage,setLeverage]=useState(10),[sizeUsd,setSizeUsd]=useState(1000),[entryInput,setEntryInput]=useState(""),[tf,setTf]=useState("240"),[klines,setKlines]=useState({}),[tvQuote,setTvQuote]=useState(null),[plan,setPlan]=useState(null);
 const symbolRef=useRef("");
 const prevSymbolRef=useRef("");
 const klineAtRef=useRef(0);
 const selectedHold=useRef(null);
 const cacheRef=useRef({klines:{},tv:{},detail:{}});
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
     const [bars,tv]=await Promise.all([loadAllKlines(current,true),getTv(current)]);
     if(!stop&&symbolRef.current===current){
      setKlines(prev=>{
       const merged=mergeKlineState(prev,bars);
       cacheRef.current.klines[current]=merged;
       return merged;
      });
      setKlinesSym(current);
      if(tv){cacheRef.current.tv[current]=tv;setTvQuote(tv);}
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
  return {
   liquidity:d?Math.min(100,Math.log10(d.bidUsd+d.askUsd+1)*14):55,
   volume:Math.min(100,Math.log10(Number(m?.volume_quote_24h||m?.volume_24h||0)+1)*16),
   oi:Math.min(100,Math.log10(Number(m?.open_interest_notional||m?.open_interest||0)+1)*18),
   spread:d&&d.mid?Math.max(0,100-(d.spread/d.mid)*100000):60,
   funding:Math.max(0,100-Math.abs(Number(m?.funding_rate||0))*100000)
  }
 },[selected,liveDetail]);
 const market={...selected,...(liveDetail?.a||{})};
 const book=liveDetail?.b;
 const price=Number(market.mark_price||market.last_price||book?.mid||0);
 const bidWall=clusterWall(book?.bids,price,"bid");
 const askWall=clusterWall(book?.asks,price,"ask");
 const tfMeta=TFS.find(t=>t.id===tf)||TFS[1];
 const tvOk=tvQuote&&TV_MAP[symbol]===tvQuote.ticker;
 const klinesOk=klinesSym===symbol;
 const tfMap=useMemo(()=>{
  const out={};
  for(const t of TFS){
   const fromTv=tvOk?tvLevels(tvQuote?.data,TV_TF[t.id],price):null;
   const fromBars=klinesOk?structureLevels(klines[t.id],price,t.tol):null;
   out[t.id]=pickSR(fromTv,fromBars,price,t);
  }
  return out;
 },[klines,klinesOk,price,tvQuote,tvOk]);
 const structured=tfMap[tf];
 const dayLow=Number(market.low_price_24h||0), dayHigh=Number(market.high_price_24h||0);
 const support=structured?.support||(bidWall?.price<price?bidWall.price:null)||(dayLow&&dayLow<price?dayLow:null)||null;
 const resistanceLevel=structured?.resistance||(askWall?.price>price?askWall.price:null)||(dayHigh&&dayHigh>price?dayHigh:null)||null;
 const low=structured?.bars?.periodLow||dayLow;
 const high=structured?.bars?.periodHigh||dayHigh;
 const bookConfirmsSupport=alignWall(support,bidWall,price);
 const bookConfirmsRes=alignWall(resistanceLevel,askWall,price);
 const srSource=structured?.source;
 const srSupportNote=structured?.supportSource
  ?`StandX ${structured.supportName||"pivot"}`
  :"Waiting for levels";
 const srResNote=structured?.resistanceSource
  ?`StandX ${structured.resistanceName||"pivot"}`
  :"Waiting for levels";
 const typed=Number(entryInput);
 const draftEntry=typed>0?typed:price;
 const usedLive=!(typed>0);
 const formKey=`${side}|${leverage}|${sizeUsd}|${usedLive?"live":draftEntry||""}`;
 function calculateTrade(){
  if(!draftEntry)return;
  const fill=draftEntry;
  const liq=liqPrice(fill,leverage,side);
  const path=book?depthUsd(side==="long"?book.bids:book.asks,fill,liq||fill):0;
  const chance=liquidationOdds({
   entry:fill,liq,high,low,changePct:market.price_change_pct,side,
   bidUsd:book?.bidUsd||0,askUsd:book?.askUsd||0,sizeUsd,pathUsd:path
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
   key:formKey,symbol,side,leverage,sizeUsd,entry:fill,usedLive,mark:price,
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
 const h1=tfMap["60"], h4=tfMap["240"];
 const vs1h=plan?liqVsLevels({side:plan.side,liq:plan.liq,support:h1?.support,resistance:h1?.resistance,supportName:h1?.supportName,resistanceName:h1?.resistanceName,tfLabel:"1H"}):null;
 const vs4h=plan?liqVsLevels({side:plan.side,liq:plan.liq,support:h4?.support,resistance:h4?.resistance,supportName:h4?.supportName,resistanceName:h4?.resistanceName,tfLabel:"4H"}):null;
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
       {[["1H",h1,vs1h],["4H",h4,vs4h]].map(([lab,lv,cmp])=><div key={lab}>
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
            <p>Enter the trade, then calculate. Liquidation is for that fill, not live mark drift. StandX 1H / 4H / daily / weekly support and resistance. {DISCLAIMER}.</p>
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
              <input type="number" min="0" step="any" value={entryInput} placeholder={price?String(price):"Fill price"} onChange={e=>setEntryInput(e.target.value)}/>
              <button type="button" className="liveBtn" onClick={()=>setEntryInput(price?String(price):"")}>LIVE</button>
            </span>
          </label>
          <label>Size USD
            <input type="number" min="50" step="50" value={sizeUsd} onChange={e=>setSizeUsd(Math.max(50,+e.target.value||50))}/>
          </label>
          <button type="button" className="calcBtn" onClick={calculateTrade}>CALCULATE</button>
        </div>
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
          {TFS.map(t=><button type="button" key={t.id} className={tf===t.id?"on":""} onClick={()=>setTf(t.id)}>{t.label}</button>)}
        </div>
        {structured?.atLevel&&<p className="atLevel">Price is testing {srTitle(structured.atLevel.name,"sup")} at {px(structured.atLevel.price)} — that is mark, not support.</p>}
        <div className={`levels ${klinesOk?"":"pending"}`}>
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
          {TFS.map(t=>{
           const lv=tfMap[t.id];
           return <button type="button" key={t.id} className={tf===t.id?"on":""} onClick={()=>setTf(t.id)}>
             <span>{t.label} · StandX</span>
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
