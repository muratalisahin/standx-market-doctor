const HDR={accept:"application/json","user-agent":"Mozilla/5.0"};

function mexcInterval(interval){
  if(interval==="1h") return "60m";
  if(interval==="1w") return "1W";
  return interval;
}

function urls(source,symbol,interval,limit){
  const q=`symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const mq=`symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(mexcInterval(interval))}&limit=${limit}`;
  if(source==="binance") return [
    `https://data-api.binance.vision/api/v3/klines?${q}`,
    `https://api1.binance.com/api/v3/klines?${q}`,
    `https://api.binance.com/api/v3/klines?${q}`,
    `https://api.mexc.com/api/v3/klines?${mq}`
  ];
  if(source==="mexc") return [`https://api.mexc.com/api/v3/klines?${mq}`];
  if(source==="yahoo"){
    const range=limit>=80?"1y":"3mo";
    return [`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${range}`];
  }
  return [];
}

function good(status,text){
  if(status<200||status>=300) return false;
  try{
    const j=JSON.parse(text);
    if(Array.isArray(j)&&j.length) return true;
    if(j?.chart?.result?.[0]?.timestamp?.length) return true;
  }catch{}
  return false;
}

export default async function handler(req,res){
  const source=req.query.source, symbol=req.query.symbol, interval=req.query.interval;
  const limit=Math.min(200,Math.max(4,Number(req.query.limit)||4));
  if(!source||!symbol||!interval) return res.status(400).json({error:"source, symbol and interval are required"});
  const list=urls(source,symbol,interval,limit);
  if(!list.length) return res.status(400).json({error:"bad source"});
  let last={status:502,text:'{"error":"OHLC proxy failed"}'};
  for(const url of list){
    try{
      const r=await fetch(url,{headers:HDR});
      const text=await r.text();
      if(good(r.status,text)){
        res.status(200).setHeader("content-type","application/json").setHeader("cache-control","no-store").send(text);
        return;
      }
      last={status:r.status,text};
    }catch(e){
      last={status:502,text:JSON.stringify({error:"OHLC proxy failed",detail:e.message})};
    }
  }
  res.status(last.status>=400?last.status:502).setHeader("content-type","application/json").setHeader("cache-control","no-store").send(last.text);
}
