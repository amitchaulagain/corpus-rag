## RAG App (Gemini on Vertex AI)

Minimal example that streams a response from Gemini with Vertex AI Retrieval-Augmented Generation (RAG) using a specific Vertex RAG Corpus.

### Prerequisites
- **Python 3.9+** (Python 3.12 recommended)
- **gcloud CLI** installed and logged in
- Access to Google Cloud project `439974099982` with Vertex AI API enabled
- IAM: your user needs at least `roles/aiplatform.user` on the project

### Setup
```bash
cd /Users/admin/extratech/ragapp

# (optional) create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# install dependency
pip install --upgrade pip
pip install google-genai
```

### Authenticate (ADC)
```bash
gcloud auth application-default login --project=439974099982
```

### Run
```bash
python3 hero.py
```

### What it does
- Uses `google-genai` with `vertexai=True`, `project=439974099982`, `location=us-east4`.
- Queries a RAG Corpus at:
  - `projects/439974099982/locations/us-east4/ragCorpora/6838716034162098176`

### Troubleshooting
- **403 PERMISSION_DENIED (aiplatform.ragCorpora.query)**
  - Grant role to your caller:
    ```bash
    gcloud projects add-iam-policy-binding 439974099982 \
      --member="user:YOUR_EMAIL" \
      --role="roles/aiplatform.user" --quiet
    ```
  - Ensure region is `us-east4` and the corpus ID exists in that project/region.

- **ADC not found / credentials error**
  - Run:
    ```bash
    gcloud auth application-default login --project=439974099982
    ```

- **`python` not found**
  - Use `python3` instead:
    ```bash
    python3 hero.py
    ```

- **urllib3 OpenSSL warning on macOS**
  - Optional: upgrade to Python 3.12 or ignore; it does not block execution.

### Notes
- The corpus ID is hardcoded in `hero.py`. Update it if you use a different corpus or region.

## Run the HTTP app

```bash
cd /Users/admin/extratech/ragapp
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# ADC for Vertex
gcloud auth application-default login --project=439974099982

# Environment
export VERTEX_PROJECT=439974099982
export VERTEX_LOCATION=us-east4
export VERTEX_RAG_CORPUS="projects/439974099982/locations/us-east4/ragCorpora/6838716034162098176"

# Start server
python3 app.py
```

### Ingest Google Drive files with user metadata
- Requires the files to be accessible by your ADC principal (or shared to the service account).
- Body: user_id and a list of Drive file IDs.

```bash
curl -sS -X POST http://localhost:8000/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "alice",
    "drive_file_ids": ["1AbC...", "2XyZ..."]
  }' | jq .
```

### Query with per-user filtering
```bash
curl -sS -X POST http://localhost:8000/query \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "alice",
    "question": "What does the proposal say about pricing?"
  }' | jq .
```

Notes:
- The ingestion endpoint uses a best-effort REST call to the Vertex RAG import API. If the API surface changes, update `vertex_rag.py` accordingly.
- Ensure your corpus contains documents tagged with `user_id` metadata, or queries will return no user-specific context.

