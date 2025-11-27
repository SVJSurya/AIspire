import math
import sys
import os
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from deep_translator import GoogleTranslator

# -------------------- GEMINI IMPORTS --------------------
try:
    from google import genai
except ImportError:
    genai = None
    print("⚠️ Gemini SDK not installed. Install via 'pip install google-genai' if you plan to use reranking.")
# -------------------------------------------------------

# Assuming model_embedder is in the same directory (backend)
try:
    from model_embedder import load_data_and_model, search_jobs
except ImportError:
    print("Error: Could not import 'model_embedder'. Make sure it's in the same directory as app.py.")
    sys.exit(1)

# Flask setup
app = Flask(__name__)
CORS(app)

# -------------------- FILE PATHS --------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "nco_full_data.json")
AUDIT_FILE = os.path.join(BASE_DIR, "audit_log.json")
CAREER_PATHS_FILE = os.path.join(BASE_DIR, "data", "career_paths.json")
# ---------------------------------------------------

# -------------------- GEMINI SETUP --------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY and genai:
    client = genai.Client(api_key=GEMINI_API_KEY)
    print("✅ Gemini Flash reranker ready.")
else:
    client = None
    print("⚠️ GEMINI_API_KEY not found or SDK missing — reranking will be skipped.")
# -------------------------------------------------------

# -------------------- LOAD MODEL --------------------
try:
    print("Loading model and data for main app...")
    model, job_data, job_embeddings = load_data_and_model()
    print("Model and data loaded successfully.")
except FileNotFoundError as e:
    print(f"ERROR loading model/data: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Unexpected error loading model/data: {e}")
    sys.exit(1)
# ---------------------------------------------------

# Ensure audit log file exists
if not os.path.exists(AUDIT_FILE):
    try:
        os.makedirs(os.path.dirname(AUDIT_FILE), exist_ok=True)
        with open(AUDIT_FILE, "w") as f:
            json.dump([], f)
    except Exception as e:
        print(f"Warning: Could not create audit file {AUDIT_FILE}: {e}")

# -------------------- GEMINI RERANK FUNCTION --------------------
def rerank_with_gemini(query, results):
    """
    Uses Gemini Flash 2.5 to rerank search results by semantic relevance.
    Falls back gracefully if API fails.
    """
    if not client:
        return results  # Skip if Gemini not configured

    prompt = f"""
    You are an AI career matching expert.
    Query: "{query}"

    Rank the following job entries from most to least relevant to the query.
    Each job includes 'code', 'title', and 'description'.

    Jobs:
    {json.dumps(results, indent=2)}

    Return ONLY valid JSON array with:
    - code
    - title
    - score (0–100 relevance)
    - reasoning (short explanation)
    """

    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",  # Use gemini-2.0-flash if available
            contents=prompt
        )
        text = response.text.strip()
        reranked = json.loads(text)
        reranked_sorted = sorted(reranked, key=lambda x: x.get('score', 0), reverse=True)
        print(f"✅ Gemini reranked {len(results)} results successfully.")
        return reranked_sorted
    except Exception as e:
        print(f"⚠️ Gemini reranking failed: {e}")
        return results  # fallback
# ---------------------------------------------------------------


@app.route("/log_audit", methods=["POST"])
def log_audit():
    data = request.json
    log_entry = {
        "device": data.get("device", "Unknown"),
        "action": data.get("action", "Unknown"),
        "details": data.get("details", {}),
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    try:
        with open(AUDIT_FILE, "r") as f:
            logs = json.load(f)
        logs.append(log_entry)
        with open(AUDIT_FILE, "w") as f:
            json.dump(logs, f, indent=2)
        return jsonify({"status": "success", "message": "Audit logged"})
    except Exception as e:
        print(f"Error logging audit: {e}")
        return jsonify({"status": "error", "message": "Failed to log audit"}), 500


@app.route("/get_audit_logs", methods=["GET"])
def get_audit_logs():
    try:
        with open(AUDIT_FILE, "r", encoding="utf-8") as f:
            logs = json.load(f)
        return jsonify(logs)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def calculate_confidence_score(job, total_jobs):
    match_score = float(job.get('raw_score', 0))
    job_frequency = int(job.get('frequency', 1))
    rarity_factor = math.log10((total_jobs + 1) / (job_frequency + 1))
    relativity = match_score * rarity_factor
    score_percent = relativity * 100
    return round(min(max(score_percent, 0), 100), 2)


# -------------------- SEARCH ROUTE --------------------
@app.route('/search')
def search():
    query = request.args.get('query', '')
    lang = request.args.get('lang', 'en')
    request_start_time = time.time()
    print(f"\n--- Received search query: '{query}' (lang: {lang}) ---")

    if not query.strip():
        return jsonify({'error': 'Empty query'}), 400

    # --- Step 1: SBERT Search ---
    try:
        search_start = time.time()
        results = search_jobs(query, model, job_data, job_embeddings, top_k=20)
        print(f"  Semantic search done in {time.time() - search_start:.3f}s.")
    except Exception as e:
        print(f"Error during semantic search: {e}")
        return jsonify({"error": "Search failed"}), 500

    # --- Step 2: Scoring + Deduplication ---
    seen_titles = set()
    unique_results = []
    total_jobs = len(job_data)
    for r in results:
        title = r.get('title')
        if title and title not in seen_titles:
            seen_titles.add(title)
            if 'raw_score' not in r:
                r['raw_score'] = 0.0
            score = calculate_confidence_score(r, total_jobs)
            r['confidence_score'] = score
            r['confidence'] = score
            unique_results.append(r)

    unique_results.sort(key=lambda x: x.get('confidence_score', 0), reverse=True)
    unique_results = unique_results[:10]

    # --- Step 3: Gemini Reranking (optional) ---
    try:
        print("Running Gemini reranker...")
        unique_results = rerank_with_gemini(query, unique_results)
    except Exception as e:
        print(f"Gemini reranking skipped: {e}")

    # --- Step 4: Translation (if needed) ---
    if lang != "en":
        try:
            translator = GoogleTranslator(source='en', target=lang)
            for job in unique_results:
                if job.get("title"):
                    job["title"] = translator.translate(job["title"])
                if job.get("description"):
                    job["description"] = translator.translate(job["description"])
        except Exception as e:
            print(f"Translation failed: {e}")

    print(f"--- Search request finished in {time.time() - request_start_time:.3f}s ---")
    return jsonify(unique_results)
# ------------------------------------------------------


@app.route('/api/careers', methods=['GET'])
def get_careers():
    try:
        with open(CAREER_PATHS_FILE, 'r', encoding='utf-8') as f:
            paths = json.load(f)
        titles = [{"title": title} for title in paths.keys()]
        return jsonify(titles)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/career-path', methods=['GET'])
def get_career_path():
    title = request.args.get('title', '')
    try:
        with open(CAREER_PATHS_FILE, 'r', encoding='utf-8') as f:
            paths = json.load(f)
        if title in paths:
            return jsonify(paths[title])
        else:
            return jsonify({"error": "Career not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/update-json', methods=['POST'])
def update_json():
    try:
        data = request.get_json()
        if not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list."}), 400
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get_embeddings", methods=["GET"])
def get_embeddings():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            jobs = json.load(f)
        return jsonify(jobs)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/update_embeddings", methods=["POST"])
def update_embeddings():
    try:
        payload = request.get_json()
        if not payload or "data" not in payload:
            return jsonify({"status": "error", "message": "Invalid request format"}), 400
        jobs = payload["data"]
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(jobs, f, indent=2, ensure_ascii=False)
        print("WARNING: Embeddings updated in JSON only — model reload not triggered.")
        return jsonify({"status": "success", "message": "Jobs updated successfully (JSON only)"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    print("Starting Main Flask server (AIspire) on port 5000...")
    app.run(port=5000, debug=False)
