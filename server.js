const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3050;
const TIDE_URL = "https://www.tide-forecast.com/locations/Reykjavik-Iceland/tides/latest";
const NAUTHOLSVIK_URL = "https://nautholsvik.is/nautholsvik-forsida/";

function send(res, status, type, body) {
  res.writeHead(status, {"Content-Type": type + "; charset=utf-8", "Cache-Control": "no-cache"});
  res.end(body);
}
function sendJson(res, obj) { send(res, 200, "application/json", JSON.stringify(obj, null, 2)); }

function timeToMinute(t) { const p=t.split(":").map(Number); return p[0]*60+p[1]; }
function minuteToTime(minute) {
  const m=((minute%1440)+1440)%1440;
  return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
}
function fallbackTides(reason) {
  const events=[
    {type:"low", time:"00:44", height:0.88, minute:44},
    {type:"high", time:"06:43", height:3.22, minute:403},
    {type:"low", time:"12:45", height:0.82, minute:765},
    {type:"high", time:"19:04", height:3.64, minute:1144}
  ];
  return {
    station:"Reykjavík",
    date:"2026-06-30",
    source:"fallback",
    warning:reason||"",
    events,
    calcEvents:[...events,{type:"low",time:"01:20",height:0.81,minute:1520,nextDay:true}]
  };
}
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi," ")
             .replace(/<style[\s\S]*?<\/style>/gi," ")
             .replace(/<[^>]+>/g," ")
             .replace(/&nbsp;/g," ")
             .replace(/&amp;/g,"&")
             .replace(/\s+/g," ")
             .trim();
}
function normalizeTime(time, ampm) {
  let [h,m]=time.split(":").map(Number);
  const s=String(ampm).toUpperCase();
  if(s==="PM"&&h!==12)h+=12;
  if(s==="AM"&&h===12)h=0;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
async function fetchWithTimeout(url, ms=1800) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(url,{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 Sjósund prototype"}})}
  finally{clearTimeout(timer)}
}
async function getTides() {
  try{
    if(typeof fetch!=="function") return fallbackTides("Node fetch vantar");
    const response=await fetchWithTimeout(TIDE_URL,1800);
    if(!response.ok) return fallbackTides("Tide-Forecast svaraði "+response.status);
    const text=stripHtml(await response.text());
    const events=[];
    const re=/(Low Tide|High Tide)\s+(\d{1,2}:\d{2})\s*(AM|PM)[^0-9]+([0-9]+(?:\.[0-9]+)?)\s*m/gi;
    let m;
    while((m=re.exec(text))!==null){
      const time=normalizeTime(m[2],m[3]);
      events.push({type:m[1].toLowerCase().startsWith("high")?"high":"low",time,height:Number(m[4]),minute:timeToMinute(time)});
    }
    if(events.length<4) return fallbackTides("Fann ekki 4 viðburði");
    const today=events.slice(0,4);
    return {station:"Reykjavík",date:new Date().toISOString().slice(0,10),source:"Tide-Forecast",events:today,calcEvents:[...today,{type:"low",time:"01:20",height:0.81,minute:1520,nextDay:true}]};
  }catch(err){ return fallbackTides(err.message); }
}
async function getNautholsvik() {
  try{
    if(typeof fetch!=="function") throw new Error("Node fetch vantar");
    const response=await fetchWithTimeout(NAUTHOLSVIK_URL,1800);
    if(!response.ok) throw new Error("Nauthólsvík svaraði "+response.status);
    const text=stripHtml(await response.text());
    const pick=(label,unit)=>{
      const re=new RegExp("([0-9]+(?:[.,][0-9]+)?)\\s*"+unit+"\\s*"+label,"i");
      return (text.match(re)||[])[1]||null;
    };
    const updated=((text.match(/Síðasta athugun:\s*([0-9./: ]+)/i)||[])[1]||"").trim()||null;
    return {
      seaTemp:pick("Sjávarhiti","°?C")||"11.9",
      airTemp:pick("Lofthiti","°?C")||"11",
      wind:pick("Vindhraði","m\\/s")||"5",
      updated:updated||"30/6/2026 00:00",
      source:"Nauthólsvík"
    };
  }catch(err){
    return {seaTemp:"11.9",airTemp:"11",wind:"5",updated:"30/6/2026 00:00",source:"fallback",warning:err.message};
  }
}
function serveFile(res, file) {
  const full=path.join(__dirname,file);
  if(!fs.existsSync(full)) return send(res,404,"text/plain","Fann ekki skrána.");
  const ext=path.extname(full).toLowerCase();
  const type=ext===".html"?"text/html":ext===".json"?"application/json":ext===".js"?"application/javascript":"text/plain";
  send(res,200,type,fs.readFileSync(full));
}
const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith("/api/tides")) return sendJson(res,await getTides());
  if(req.url.startsWith("/api/nautholsvik")) return sendJson(res,await getNautholsvik());
  if(req.url==="/"||req.url.startsWith("/index.html")) return serveFile(res,"index.html");
  return serveFile(res,req.url.replace(/^\//,""));
});
server.listen(PORT,()=>{
  console.log("");
  console.log("===============================================");
  console.log(" Sjósund Nauthólsvík er ræst");
  console.log(" Opnaðu: Render URL eða http://localhost:3050");
  console.log("===============================================");
  console.log("");
});
