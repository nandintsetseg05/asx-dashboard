# ASX Portfolio Risk & Analytics Dashboard

An interactive Bloomberg-style analytics terminal for ASX investors.
Build a custom portfolio and instantly generate risk metrics, 
stress-test scenarios, and performance attribution reports.

---

## 📊 What It Does

- Ingests **live ASX data** via Yahoo Finance API (yfinance)
- Calculates **Sharpe Ratio**, **Value at Risk (VaR)**, and **sector allocation**
- Runs **portfolio stress-tests** across 3 market scenarios
- Generates **exportable PDF reports** aligned to CFA-style performance attribution
- **Automated weekly refresh pipeline** — zero manual reporting time

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Data ingestion | Python, yfinance |
| Data processing | pandas, numpy |
| Visualisation | Power BI |
| Automation | Python scheduled tasks |
| Export | PDF generation |

---

## 📸 Screenshots

<!-- Add screenshots here -->

---

## 🚀 How to Run
```bash
# Clone the repo
git clone https://github.com/nandintsetseg05/asx-dashboard

# Install dependencies
pip install -r requirements.txt

# Run data pipeline
python data_pipeline.py

# Open dashboard
# Import asx_dashboard.pbix into Power BI Desktop
```

---

## 📈 Key Features

**Risk Metrics**
- Sharpe Ratio (risk-adjusted return)
- Value at Risk (VaR) at 95% confidence
- Max drawdown analysis

**Portfolio Analysis**
- Sector allocation breakdown
- Correlation matrix
- Benchmark comparison

**Automation**
- Scheduled weekly data refresh
- Auto-generated PDF summary reports

---

## 👤 Author

Nana Nandintsetseg Bayarsaikhan  
[nana-nandintsetseg.com](https://www.nana-nandintsetseg.com) 
| [LinkedIn](https://www.linkedin.com/in/nana-nandintsetseg/)
