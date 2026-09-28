import httpx
from base58 import b58decode

TOKEN_PROGRAM="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

async def rpc(url, method, params):
    async with httpx.AsyncClient(timeout=40) as c:
        r=await c.post(url,json={"jsonrpc":"2.0","id":1,"method":method,"params":params})
        r.raise_for_status()
        j=r.json()
        if j.get("error"): raise RuntimeError(j["error"].get("message","RPC error"))
        return j["result"]

async def get_mint(url,mint):
    raw=b58decode(mint)
    if len(raw)!=32: raise ValueError("Mint address non valido")
    r=await rpc(url,"getAccountInfo",[mint,{"encoding":"base64","commitment":"confirmed"}])
    if not r.get("value"): raise ValueError("Mint non trovato")
    return r["value"]

async def get_token_accounts(url,mint):
    return await rpc(url,"getProgramAccounts",[TOKEN_PROGRAM,{"encoding":"jsonParsed","commitment":"confirmed","filters":[{"dataSize":165},{"memcmp":{"offset":0,"bytes":mint}}]}])
