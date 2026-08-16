export default async function handler(req,res){
  const source=req.query.source, symbol=req.query.symbol, interval=req.query.interval;
  if(!source||!symbol||!interval)return res.status(400).json({error:"source, symbol and interval are required"});
  let url="";
  if(source==="binance") url=`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=4`;
  else if(source==="mexc") url=`https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=4`;
  else if(source==="yahoo") url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=6mo`;
  else return res.status(400).json({error:"bad source"});
  try{
    const r=await fetch(url,{headers:{accept:"application/json","user-agent":"Mozilla/5.0"}});
    const text=await r.text();
    res.status(r.status).setHeader("content-type","application/json").setHeader("cache-control","no-store").send(text);
  }catch(e){res.status(502).json({error:"OHLC proxy failed",detail:e.message});}
}
