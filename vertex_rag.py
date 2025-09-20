import os
import json
import requests
from typing import List, Tuple, Dict, Any
from google import genai
from google.genai import types


PROJECT = os.getenv("VERTEX_PROJECT", "439974099982")
LOCATION = os.getenv("VERTEX_LOCATION", "us-east4")
RAG_CORPUS = os.getenv(
  "VERTEX_RAG_CORPUS",
  "projects/439974099982/locations/us-east4/ragCorpora/6838716034162098176",
)


def _get_auth_header() -> Dict[str, str]:
  # Use ADC token for REST calls
  from google.auth.transport.requests import Request
  from google.oauth2 import service_account
  import google.auth

  credentials, _ = google.auth.default(scopes=[
    "https://www.googleapis.com/auth/cloud-platform"
  ])
  credentials.refresh(Request())
  return {"Authorization": f"Bearer {credentials.token}"}


def import_from_drive(user_id: str, drive_file_ids: List[str]) -> Tuple[bool, Dict[str, Any]]:
  """Import Google Drive files into the shared RAG corpus with user_id metadata.

  NOTE: Uses best-effort REST call shape; adjust fields to match current API.
  """
  url = (
    f"https://{LOCATION}-aiplatform.googleapis.com/v1beta1/"
    f"{RAG_CORPUS}:importRagFiles"
  )

  body = {
    "gdriveSource": {
      "fileIds": drive_file_ids,
    },
    "ragFileMetadata": {
      "metadata": {
        "user_id": user_id,
      }
    }
  }

  try:
    headers = {"Content-Type": "application/json"}
    headers.update(_get_auth_header())
    resp = requests.post(url, headers=headers, data=json.dumps(body), timeout=120)
    if resp.status_code >= 200 and resp.status_code < 300:
      return True, {"status": "ok", "result": resp.json()}
    return False, {"status": "error", "code": resp.status_code, "result": resp.text}
  except Exception as e:
    return False, {"status": "exception", "error": str(e)}


def query_with_user_context(user_id: str, question: str) -> Tuple[bool, Dict[str, Any]]:
  client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)
  tools = [
    types.Tool(
      retrieval=types.Retrieval(
        vertex_rag_store=types.VertexRagStore(
          rag_resources=[
            types.VertexRagStoreRagResource(rag_corpus=RAG_CORPUS)
          ],
          rag_retrieval_config=types.RagRetrievalConfig(
            filter=types.RagRetrievalConfigFilter(
              metadata_filter=f"user_id == \"{user_id}\""
            ),
            top_k=8,
          ),
        )
      )
    )
  ]

  contents = [
    types.Content(
      role="user",
      parts=[types.Part.from_text(text=question)],
    )
  ]

  config = types.GenerateContentConfig(
    tools=tools,
    temperature=0.4,
    top_p=0.95,
    max_output_tokens=2048,
  )

  try:
    text = ""
    for chunk in client.models.generate_content_stream(
      model="gemini-2.5-flash-lite",
      contents=contents,
      config=config,
    ):
      if not chunk.candidates or not chunk.candidates[0].content or not chunk.candidates[0].content.parts:
        continue
      text += chunk.text
    return True, {"answer": text}
  except Exception as e:
    return False, {"error": str(e)}


