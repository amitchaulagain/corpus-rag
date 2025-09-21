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
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/drive.readonly"
  ])
  credentials.refresh(Request())
  return {"Authorization": f"Bearer {credentials.token}"}


def list_drive_files(folder_id: str) -> Tuple[bool, Dict[str, Any]]:
  """List files in a Google Drive folder."""
  try:
    headers = _get_auth_header()

    # Extract folder ID from URL if full URL is provided
    if "drive.google.com" in folder_id:
      folder_id = folder_id.split("/")[-1].split("?")[0]

    url = f"https://www.googleapis.com/drive/v3/files"
    params = {
      "q": f"'{folder_id}' in parents and trashed=false",
      "fields": "files(id,name,mimeType,size,modifiedTime)",
      "pageSize": 100
    }

    resp = requests.get(url, headers=headers, params=params, timeout=30)

    if resp.status_code == 200:
      data = resp.json()
      files = data.get("files", [])
      return True, {"files": files}
    else:
      return False, {"error": f"Drive API error: {resp.status_code} - {resp.text}"}

  except Exception as e:
    return False, {"error": str(e)}


def create_user_folder(user_id: str, parent_folder_id: str = None) -> Tuple[bool, Dict[str, Any]]:
  """Create a folder for a user in Google Drive."""
  try:
    headers = _get_auth_header()
    headers["Content-Type"] = "application/json"

    # Use provided parent folder or default to root
    if parent_folder_id and "drive.google.com" in parent_folder_id:
      parent_folder_id = parent_folder_id.split("/")[-1].split("?")[0]

    url = "https://www.googleapis.com/drive/v3/files"

    body = {
      "name": f"RAG_User_{user_id}",
      "mimeType": "application/vnd.google-apps.folder"
    }

    if parent_folder_id:
      body["parents"] = [parent_folder_id]

    resp = requests.post(url, headers=headers, data=json.dumps(body), timeout=30)

    if resp.status_code == 200:
      folder = resp.json()
      return True, {"folder": folder}
    else:
      return False, {"error": f"Drive API error: {resp.status_code} - {resp.text}"}

  except Exception as e:
    return False, {"error": str(e)}


def upload_file_to_drive(file_content: bytes, filename: str, folder_id: str, mime_type: str = "application/octet-stream") -> Tuple[bool, Dict[str, Any]]:
  """Upload a file to Google Drive."""
  try:
    headers = _get_auth_header()

    # Extract folder ID from URL if full URL is provided
    if folder_id and "drive.google.com" in folder_id:
      folder_id = folder_id.split("/")[-1].split("?")[0]

    # Metadata for the file
    metadata = {
      "name": filename,
      "parents": [folder_id] if folder_id else []
    }

    # Upload using multipart
    url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

    body = f"""------WebKitFormBoundary7MA4YWxkTrZu0gW\r
Content-Type: application/json; charset=UTF-8\r
\r
{json.dumps(metadata)}\r
------WebKitFormBoundary7MA4YWxkTrZu0gW\r
Content-Type: {mime_type}\r
\r
""".encode() + file_content + b"\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--"

    headers["Content-Type"] = f"multipart/related; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW"

    resp = requests.post(url, headers=headers, data=body, timeout=60)

    if resp.status_code == 200:
      file_info = resp.json()
      return True, {"file": file_info}
    else:
      return False, {"error": f"Drive API error: {resp.status_code} - {resp.text}"}

  except Exception as e:
    return False, {"error": str(e)}


def import_from_drive(user_id: str, drive_file_ids: List[str]) -> Tuple[bool, Dict[str, Any]]:
  """Import Google Drive files into the shared RAG corpus with user_id metadata.

  MOCK IMPLEMENTATION: Returns success for demo purposes.
  In production, this would call Vertex AI RAG API.
  """
  # Mock implementation - in production would call Vertex AI RAG API
  print(f"Mock: Would import {len(drive_file_ids)} files for user {user_id}")
  print(f"Mock: File IDs: {drive_file_ids}")

  # Simulate successful import
  return True, {
    "status": "ok",
    "message": f"Successfully imported {len(drive_file_ids)} files for user {user_id}",
    "files_imported": len(drive_file_ids),
    "user_id": user_id
  }


def query_with_user_context(user_id: str, question: str) -> Tuple[bool, Dict[str, Any]]:
  """Query the RAG system with user context using your working implementation."""
  try:
    client = genai.Client(
        vertexai=True,
        project=PROJECT,
        location=LOCATION,
    )

    contents = [
      types.Content(
        role="user",
        parts=[
          types.Part.from_text(text=question)
        ]
      ),
    ]

    tools = [
      types.Tool(
        retrieval=types.Retrieval(
          vertex_rag_store=types.VertexRagStore(
            rag_resources=[
              types.VertexRagStoreRagResource(
                rag_corpus=RAG_CORPUS
              )
            ],
          )
        )
      )
    ]

    generate_content_config = types.GenerateContentConfig(
      temperature=0.4,
      top_p=0.95,
      max_output_tokens=2048,
      safety_settings=[
        types.SafetySetting(
          category="HARM_CATEGORY_HATE_SPEECH",
          threshold="OFF"
        ),
        types.SafetySetting(
          category="HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold="OFF"
        ),
        types.SafetySetting(
          category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold="OFF"
        ),
        types.SafetySetting(
          category="HARM_CATEGORY_HARASSMENT",
          threshold="OFF"
        )
      ],
      tools=tools,
    )

    text = ""
    for chunk in client.models.generate_content_stream(
      model="gemini-2.5-flash-lite",
      contents=contents,
      config=generate_content_config,
    ):
      if not chunk.candidates or not chunk.candidates[0].content or not chunk.candidates[0].content.parts:
          continue
      text += chunk.text

    return True, {"answer": text}
  except Exception as e:
    return False, {"error": str(e)}


