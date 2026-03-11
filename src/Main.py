from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import numpy as np

app = FastAPI()

# Allow React dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HOLDINGS = [
    { "ticker": "CBA.AX", "name": "Commonwealth Bank",   "sector": "Financials",     "color": "#f0a500", "shares": 45,  "avgCost": 108.20 },
    { "ticker": "BHP.AX", "name": "BHP Group",            "sector": "Materials",      "color": "#0095ff", "shares": 120, "avgCost": 43.10  },
    { "ticker": "CSL.AX", "name": "CSL Limited",          "sector": "Healthcare",     "color": "#00c875", "shares": 18,  "avgCost": 285.00 },
    { "ticker": "WES.AX", "name": "Wesfarmers",           "sector": "Consumer Disc.", "color": "#c77dff", "shares": 85,  "avgCost": 65.40  },
    { "ticker": "NAB.AX", "name": "Natl. Australia Bank", "sector": "Financials",     "color": "#ff6b6b", "shares": 95,  "avgCost": 32.80  },
]

@app.get("/api/portfolio")
def get_portfolio():
    result = []
    for h in HOLDINGS:
        ticker = yf.Ticker(h["ticker"])
        info   = ticker.info
        price  = info.get("currentPrice") or info.get("regularMarketPrice") or h["avgCost"]
        beta   = info.get("beta") or 1.0
        div    = info.get("dividendYield") or 0.0

        result.append({
            **h,
            "price":    round(price, 2),
            "beta":     round(beta, 2),
            "divYield": round(div * 100, 2),
        })
    return result


@app.get("/api/history")
def get_history():
    """Returns 1Y daily closing prices for each ticker, used to build equity curve."""
    history = {}
    for h in HOLDINGS:
        df = yf.Ticker(h["ticker"]).history(period="1y")
        history[h["ticker"]] = [
            {
                "date":  str(row.Index.date()),
                "close": round(row.Close, 2),
            }
            for row in df.itertuples()
        ]
    return history