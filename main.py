from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .settings import settings
from .scanner import scan
from .db import init_db,save_scan
from .alerts import maybe_alert

app=FastAPI(title="Solana Risk Scanner API",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=settings.frontend_origins,allow_credentials=False,allow_methods=["*"],allow_headers=["*"])

@app.on_event("startup")
def startup(): init_db()

class ScanRequest(BaseModel): mint:str

@app.get("/")
def root(): return {"name":"Solana Risk Scanner API","status":"ok"}
@app.get("/api/health")
def health(): return {"status":"ok"}
@app.post("/api/scan")
async def api_scan(req:ScanRequest):
    try:
        data=await scan(settings.rpc_url,req.mint)
        save_scan(data)
        await maybe_alert(data)
        return data
    except ValueError as e: raise HTTPException(400,str(e))
    except Exception as e: raise HTTPException(502,f"Scanner error: {e}")
