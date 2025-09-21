from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from vertex_rag import import_from_drive, query_with_user_context, list_drive_files, create_user_folder, upload_file_to_drive

app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
  return render_template("index.html")


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


@app.post("/list-files")
def list_files():
  payload = request.get_json(force=True, silent=True) or {}
  folder_id = payload.get("folder_id")
  if not folder_id:
    return jsonify({"error": "Provide folder_id"}), 400

  ok, data = list_drive_files(folder_id=folder_id)
  status = 200 if ok else 502
  return jsonify(data), status


if __name__ == "__main__":
  # Default dev server
  app.run(host="0.0.0.0", port=8000, debug=False)


