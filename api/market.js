export default async function handler(req,res){
  const symbol=req.query.symbol;
  const path=symbol?`/api/query_symbol_market?symbol=${encodeURIComponent(symbol)}`:"/api/query_market_overview";
  try{
    const r=await fetch(`https://perps.standx.com${path}`,{headers:{accept:"application/json"}});
    const text=await r.text();
    res.status(r.status).setHeader("content-type","application/json").send(text);
  }catch(e){res.status(502).json({error:"StandX API proxy failed",detail:e.message});}
}