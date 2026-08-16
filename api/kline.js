export default async function handler(req,res){
  const symbol=req.query.symbol, resolution=req.query.resolution, from=req.query.from, to=req.query.to;
  if(!symbol||!resolution||!from||!to)return res.status(400).json({error:"symbol, resolution, from and to are required"});
  const path=`/api/kline/history?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  try{
    const r=await fetch(`https://perps.standx.com${path}`,{headers:{accept:"application/json"}});
    const text=await r.text();
    res.status(r.status).setHeader("content-type","application/json").send(text);
  }catch(e){res.status(502).json({error:"StandX kline proxy failed",detail:e.message});}
}
