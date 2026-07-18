"""
Churn Intelligence — European Retail Banking
Flask application entry point.

Run locally:
    pip install -r requirements.txt
    python app.py

Then open http://127.0.0.1:5000 in your browser.
"""

from flask import Flask, render_template, jsonify, send_from_directory
import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "static", "data", "customers.json")

app = Flask(__name__)


@app.route("/")
def index():
    """Render the dashboard shell. Data itself is fetched client-side from /static/data/customers.json."""
    return render_template("index.html")


@app.route("/api/customers")
def api_customers():
    """
    Optional JSON API for the same dataset the dashboard reads from disk.
    Useful if you want to swap the static JSON file for a live database later —
    point static/js/main.js's fetch() at this route instead.
    """
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/healthz")
def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
