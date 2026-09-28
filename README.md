# Solana Risk Scanner — Ready

## GitHub Pages
Il frontend funziona anche senza backend: usa direttamente il Solana RPC in sola lettura.

GitHub Pages può pubblicare il contenuto tramite GitHub Actions. Il workflow è già incluso in `.github/workflows/pages.yml`.

## Backend FastAPI
Il backend è in `backend/` ed è deployabile su Render.

Build:
`pip install -r requirements.txt`

Start:
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Dopo il deploy, inserire l'URL HTTPS del backend in `config.js`:
`API_BASE_URL: "https://TUO-BACKEND.onrender.com"`

## Sicurezza
Il progetto è read-only: non invia ordini e non firma transazioni.
Liquidity/DEX e wash-trading sono lasciati `NOT_INDEXED` finché non viene aggiunta un'indicizzazione dedicata.
