from flask import Flask, request, jsonify
from vertex_rag import import_from_drive, query_with_user_context

app = Flask(__name__)


@app.post("/ingest")
def ingest():
  payload = request.get_json(force=True, silent=True) or {}
  user_id = payload.get("user_id")
  drive_file_ids = payload.get("drive_file_ids")
  if not user_id or not isinstance(drive_file_ids, list) or not drive_file_ids:
    return jsonify({
      "error": "Provide user_id and non-empty drive_file_ids list"
    }), 400

  ok, data = import_from_drive(user_id=user_id, drive_file_ids=drive_file_ids)
  status = 200 if ok else 502
  return jsonify(data), status


@app.post("/query")
def query():
  payload = request.get_json(force=True, silent=True) or {}
  user_id = payload.get("user_id")
  question = payload.get("question")
  if not user_id or not question:
    return jsonify({"error": "Provide user_id and question"}), 400

  ok, data = query_with_user_context(user_id=user_id, question=question)
  status = 200 if ok else 502
  return jsonify(data), status


if __name__ == "__main__":
  # Default dev server
  app.run(host="0.0.0.0", port=8000, debug=True)


