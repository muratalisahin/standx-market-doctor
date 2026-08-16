export default async function handler(req,res){
  const symbol=req.query.symbol, fields=req.query.fields;
  if(!symbol||!fields)return res.status(400).json({error:"symbol and fields are required"});
  try{
    const r=await fetch(`https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(symbol)}&fields=${encodeURIComponent(fields)}`,{
      headers:{accept:"application/json","user-agent":"Mozilla/5.0"}
    });
    const text=await r.text();
    res.status(r.status).setHeader("content-type","application/json").setHeader("cache-control","no-store").send(text);
  }catch(e){res.status(502).json({error:"TradingView proxy failed",detail:e.message});}
}
