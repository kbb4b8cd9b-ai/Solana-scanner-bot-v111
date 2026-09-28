import base64
from base58 import b58decode, b58encode
from .solana import get_mint,get_token_accounts

def u64(b,o):
    return int.from_bytes(b[o:o+8],"little")

def parse_mint(value):
    raw=base64.b64decode(value["data"][0])
    if len(raw)<82: raise ValueError("Account mint non valida")
    ma=b58encode(raw[4:36]).decode() if raw[0] else None
    fa=b58encode(raw[50:82]).decode() if raw[46] else None
    return {"mint_authority":ma,"freeze_authority":fa,"supply":u64(raw,36),"decimals":raw[44]}

async def scan(rpc_url,mint):
    if len(b58decode(mint))!=32: raise ValueError("Mint address non valido")
    mi=parse_mint(await get_mint(rpc_url,mint))
    accounts=await get_token_accounts(rpc_url,mint)
    rows=[]; total=0
    for a in accounts:
        try:
            p=a["account"]["data"]["parsed"]["info"]
            amt=int(p["tokenAmount"]["amount"])
            rows.append({"owner":p.get("owner","unknown"),"amount":amt})
            total+=amt
        except Exception: pass
    rows.sort(key=lambda x:x["amount"],reverse=True)
    def pct(n): return round(n*100/total,2) if total else 0
    top1=pct(rows[0]["amount"]) if rows else 0
    top5=pct(sum(x["amount"] for x in rows[:5]))
    top10=pct(sum(x["amount"] for x in rows[:10]))
    score=0; reasons=[]
    if mi["mint_authority"]: score+=15; reasons.append("Mint authority ancora attiva (+15).")
    if mi["freeze_authority"]: score+=15; reasons.append("Freeze authority ancora attiva (+15).")
    if top10>=80: score+=25; reasons.append(f"Top 10 holder concentrano {top10:.2f}% (+25).")
    elif top10>=60: score+=18; reasons.append(f"Top 10 holder concentrano {top10:.2f}% (+18).")
    elif top10>=40: score+=10; reasons.append(f"Top 10 holder concentrano {top10:.2f}% (+10).")
    if top1>=30: score+=10; reasons.append(f"Top holder controlla {top1:.2f}% (+10).")
    elif top1>=15: score+=5; reasons.append(f"Top holder controlla {top1:.2f}% (+5).")
    if not reasons: reasons=["Nessun indicatore incluso nel punteggio ha superato le soglie."]
    return {"mint":mint,"risk_score":score,"risk_level":"HIGH" if score>=75 else "MEDIUM" if score>=45 else "LOW","authorities":mi,"token":{"supply_raw":str(mi["supply"]),"decimals":mi["decimals"],"supply_display":str(mi["supply"]/10**mi["decimals"])}, "holders":{"count":len(rows),"top1_pct":top1,"top5_pct":top5,"top10_pct":top10,"top10":rows[:10]},"reasons":reasons,"modules":{"liquidity":"NOT_INDEXED","wash_trading":"NOT_INDEXED","source":"FastAPI + Solana RPC"}}
