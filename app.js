const cfg = window.APP_CONFIG || {};
const API = (cfg.API_BASE_URL || "").replace(/\/+$/, "");
const RPC = "https://solana-rpc.publicnode.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const $ = id => document.getElementById(id);
$("scanBtn").addEventListener("click", scan);
$("mint").addEventListener("keydown", e => { if(e.key === "Enter") scan(); });

function b58decode(s){
  let n = 0n;
  for(const ch of s){
    const i = ALPHABET.indexOf(ch);
    if(i < 0) throw new Error("Base58 non valido");
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if(hex.length % 2) hex = "0" + hex;
  const bytes = [];
  for(let i=0;i<hex.length;i+=2) bytes.push(parseInt(hex.slice(i,i+2),16));
  let zeros=0;
  for(const ch of s){ if(ch==="1") zeros++; else break; }
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes]);
}
function validMint(s){
  try{return b58decode(s).length===32}catch{return false}
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function setStatus(s, cls=""){ $("status").className="status "+cls; $("status").textContent=s; }
async function rpc(method, params=[]){
  const r=await fetch(RPC,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  const j=await r.json();
  if(j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}
function u64LE(bytes, start){
  let n=0n; for(let i=0;i<8;i++) n += BigInt(bytes[start+i]) << BigInt(8*i); return n;
}
function pubkeyFrom32(bytes){
  let n=0n; for(const b of bytes)n=n*256n+BigInt(b);
  let out=""; let x=n;
  while(x){let r=Number(x%58n);out=ALPHABET[r]+out;x/=58n}
  while(out.length<44)out="1"+out;
  return out;
}
function parseMint(data){
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  const authOpt = bytes[0];
  const mintAuth = authOpt ? pubkeyFrom32(bytes.slice(4,36)) : null;
  const supply=u64LE(bytes,36);
  const decimals=bytes[44];
  const freezeOpt=bytes[46];
  const freezeAuth=freezeOpt ? pubkeyFrom32(bytes.slice(50,82)) : null;
  return {mintAuth,freezeAuth,supply,decimals};
}
async function getMint(mint){
  const r=await rpc("getAccountInfo",[mint,{encoding:"base64",commitment:"confirmed"}]);
  if(!r.value) throw new Error("Mint non trovato sulla Solana mainnet.");
  return parseMint(r.value.data[0]);
}
async function getAccounts(mint){
  return await rpc("getProgramAccounts",[TOKEN_PROGRAM,{
    encoding:"jsonParsed",commitment:"confirmed",
    filters:[{dataSize:165},{memcmp:{offset:0,bytes:mint}}]
  }]);
}
function pct(n,d){return d===0n?0:Number((n*10000n)/d)/100}
function fmtAmount(raw,decimals){return (Number(raw)/10**decimals).toLocaleString("it-IT",{maximumFractionDigits:Math.min(decimals,6)})}

async function scan(){
  const mint=$("mint").value.trim();
  $("result").classList.add("hidden");
  if(!validMint(mint)){setStatus("Mint address non valido: deve essere una public key Solana base58 di 32 byte.","danger");return}
  $("scanBtn").disabled=true; setStatus("Analisi on-chain in corso…");
  try{
    // If a backend URL is configured, use the complete FastAPI scanner.
    if(API){
      const r=await fetch(API+"/api/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mint})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.detail || "Errore backend");
      render(j); setStatus("Analisi completata.","ok"); return;
    }

    // Zero-setup GitHub Pages mode: read-only direct RPC scan.
    const [mi, accts]=await Promise.all([getMint(mint),getAccounts(mint)]);
    const rows=[];
    let total=0n;
    for(const a of accts){
      const p=a.account?.data?.parsed?.info;
      if(!p) continue;
      const amount=BigInt(p.tokenAmount?.amount || "0");
      total+=amount;
      rows.push({owner:p.owner || "sconosciuto",amount});
    }
    rows.sort((a,b)=>a.amount>b.amount?-1:a.amount<b.amount?1:0);
    const top1=rows.length?pct(rows[0].amount,total):0;
    const top5=rows.slice(0,5).reduce((s,x)=>s+x.amount,0n);
    const top10=rows.slice(0,10).reduce((s,x)=>s+x.amount,0n);
    let score=0,reasons=[];
    if(mi.mintAuth){score+=15;reasons.push("Mint authority ancora attiva (+15).")}
    if(mi.freezeAuth){score+=15;reasons.push("Freeze authority ancora attiva (+15).")}
    const p10=pct(top10,total),p1=top1;
    if(p10>=80){score+=25;reasons.push(`Top 10 holder concentrano ${p10.toFixed(2)}% (+25).`)}
    else if(p10>=60){score+=18;reasons.push(`Top 10 holder concentrano ${p10.toFixed(2)}% (+18).`)}
    else if(p10>=40){score+=10;reasons.push(`Top 10 holder concentrano ${p10.toFixed(2)}% (+10).`)}
    if(p1>=30){score+=10;reasons.push(`Top holder controlla ${p1.toFixed(2)}% (+10).`)}
    else if(p1>=15){score+=5;reasons.push(`Top holder controlla ${p1.toFixed(2)}% (+5).`)}
    if(!reasons.length) reasons.push("Nessun indicatore di rischio incluso nel punteggio ha superato le soglie.");
    render({
      risk_score:score,
      risk_level:score>=75?"HIGH":score>=45?"MEDIUM":"LOW",
      mint,
      authorities:{mint_authority:mi.mintAuth,freeze_authority:mi.freezeAuth},
      token:{supply_raw:mi.supply.toString(),decimals:mi.decimals,supply_display:fmtAmount(mi.supply,mi.decimals)},
      holders:{count:rows.length,top1_pct:p1,top5_pct:pct(top5,total),top10_pct:p10,top10:rows.slice(0,10).map(x=>({owner:x.owner,amount:x.amount.toString(),percentage:pct(x.amount,total)}))},
      reasons,
      modules:{liquidity:"NOT_INDEXED",wash_trading:"NOT_INDEXED",source:"Solana RPC"}
    });
    setStatus("Analisi completata direttamente dalla Solana mainnet.","ok");
  }catch(e){setStatus("Errore: "+e.message,"danger")}
  finally{$("scanBtn").disabled=false}
}
function render(d){
  $("result").classList.remove("hidden");
  const score=Number(d.risk_score||0), level=d.risk_level||"LOW";
  $("score").textContent=score;
  $("level").textContent=level;
  $("level").className=level==="HIGH"?"high":level==="MEDIUM"?"medium":"low";
  const a=d.authorities||{};
  $("authority").innerHTML=`<div class="kv"><span>Mint authority</span><span class="${a.mint_authority?"danger":"ok"}">${a.mint_authority?"ATTIVA":"REVOCATA"}</span></div><div class="kv"><span>Freeze authority</span><span class="${a.freeze_authority?"danger":"ok"}">${a.freeze_authority?"ATTIVA":"REVOCATA"}</span></div>`;
  const t=d.token||{};
  $("tokenInfo").innerHTML=`<div class="kv"><span>Decimals</span><span>${esc(t.decimals??"—")}</span></div><div class="kv"><span>Supply</span><span>${esc(t.supply_display??t.supply_raw??"—")}</span></div>`;
  $("reasons").innerHTML=(d.reasons||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  const h=d.holders||{};
  $("holders").innerHTML=`<div class="kv"><span>Token accounts</span><span>${esc(h.count??"—")}</span></div><div class="kv"><span>Top 1</span><span>${Number(h.top1_pct||0).toFixed(2)}%</span></div><div class="kv"><span>Top 5</span><span>${Number(h.top5_pct||0).toFixed(2)}%</span></div><div class="kv"><span>Top 10</span><span>${Number(h.top10_pct||0).toFixed(2)}%</span></div>`;
  const m=d.modules||{};
  $("modules").innerHTML=`<div class="module">Liquidity/DEX: <b>${esc(m.liquidity||"NOT_INDEXED")}</b></div><div class="module">Wash trading: <b>${esc(m.wash_trading||"NOT_INDEXED")}</b></div><div class="module">Fonte: <b>${esc(m.source||"FastAPI")}</b></div>`;
}
