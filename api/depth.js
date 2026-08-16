export default async function handler(req,res){
  const symbol=req.query.symbol;
  if(!symbol)return res.status(400).json({error:"symbol is required"});
  try{
    const r=await fetch(`https://perps.standx.com/api/query_depth_book?symbol=${encodeURIComponent(symbol)}`,{headers:{accept:"application/json"}});
    const text=await r.text();
    res.status(r.status).setHeader("content-type","application/json").send(text);
  }catch(e){res.status(502).json({error:"StandX API proxy failed",detail:e.message});}
}