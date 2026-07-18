# Churn Intelligence — European Retail Banking

Interactive customer segmentation & churn analytics dashboard for a 10,000-record
European retail banking dataset (France, Spain, Germany).

## Project structure

```
project/
├── app.py                       Flask app — serves the page and the data API
├── requirements.txt             Python dependencies
├── templates/
│   └── index.html               Page markup (Jinja2 template)
└── static/
    ├── css/
    │   └── style.css            All styling (dark "risk console" theme)
    ├── js/
    │   ├── chart.umd.js         Chart.js library (bundled locally, no CDN dependency)
    │   └── main.js              Dashboard logic: filtering, KPIs, charts, explorer table
    └── data/
        └── customers.json       The dataset (from European_Bank.csv), compact array format
```

## Data format

`customers.json` is an array of rows, each row an array in this fixed column order:

```
[CreditScore, Geography, Gender, Age, Tenure, Balance, NumOfProducts, HasCrCard, IsActiveMember, EstimatedSalary, Exited]
```

`Geography` is coded `"FR" | "ES" | "DE"`, `Gender` is `"F" | "M"`, and `Exited` is `1` (churned) or `0` (retained).
This mapping is defined once, at the top of `static/js/main.js`, as `COLS`.

## Running it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000**.

## How the pieces fit together

1. `app.py` runs a Flask server with two routes:
   - `/` renders `templates/index.html`.
   - `/api/customers` returns the same dataset as JSON — a ready-made hook if you
     later want to swap the static file for a live database query.
2. `templates/index.html` loads `static/css/style.css`, then `static/js/chart.umd.js`,
   then `static/js/main.js`.
3. On page load, `main.js` calls `loadData()`, which `fetch()`es
   `/static/data/customers.json`, then calls `render()` to build every KPI, chart,
   and table from that data.
4. All filtering (geography, age band, tenure, balance segment, gender) happens
   client-side in `main.js` — no server round-trip needed once the data has loaded.

## Swapping in your own data

Replace `static/data/customers.json` with a new array in the same column order, or
point `main.js`'s `fetch()` call at `/api/customers` and have `app.py` pull from a
real database instead of the JSON file.
