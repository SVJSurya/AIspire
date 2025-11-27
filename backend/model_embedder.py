# backend/model_embedder.py

from sentence_transformers import SentenceTransformer, util
import json
import os

def load_data_and_model():
    # ✅ Load pre-trained Sentence-BERT model
    model = SentenceTransformer('all-MiniLM-L6-v2')

    # ✅ Use absolute path relative to this file to avoid cwd problems
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(BASE_DIR, 'data', 'nco_full_data.json')

    if not os.path.exists(data_path):
        raise FileNotFoundError(f"nco_full_data.json not found at: {data_path}")

    # ✅ Load career/job data from JSON
    with open(data_path, 'r', encoding='utf-8') as f:
        job_data = json.load(f)

    # ✅ Create combined text for better semantic context
    combined_texts = [
        f"{job.get('title', '')}. {job.get('description', '')}" for job in job_data
    ]
    
    # ✅ Precompute embeddings
    embeddings = model.encode(combined_texts, convert_to_tensor=True)

    return model, job_data, embeddings

def search_jobs(query, model, job_data, job_embeddings, top_k=10, return_raw_score=False):
    if not query.strip():
        return []

    query_embedding = model.encode(query, convert_to_tensor=True)
    similarities = util.cos_sim(query_embedding, job_embeddings)[0]
    top_results = similarities.topk(k=top_k)

    results = []
    for score, idx in zip(top_results.values, top_results.indices):
        job = job_data[idx]
        job_entry = {
            "code": job.get("code", ""),
            "title": job.get("title", ""),
            "description": job.get("description", ""),
            "confidence_score": round(float(score) * 100, 2),
            "raw_score": float(score)  # ✅ added
        }
        results.append(job_entry)

    return results

