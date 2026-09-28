import httpx
from .settings import settings
async def maybe_alert(data):
    if not settings.telegram_bot_token or not settings.telegram_chat_id or data["risk_score"]<settings.alert_threshold:return
    text=f"Solana Risk Scanner\nMint: {data['mint']}\nRisk: {data['risk_score']} ({data['risk_level']})"
    url=f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as c: await c.post(url,json={"chat_id":settings.telegram_chat_id,"text":text})
