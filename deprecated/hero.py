



from google import genai
from google.genai import types
import base64
import os

def generate():
  client = genai.Client(
      vertexai=True,
      project="439974099982",
      location="us-east4",
  )


  model = "gemini-2.5-flash-lite"
  contents = [
    types.Content(
      role="user",
      parts=[
        types.Part.from_text(text="""whats my name ?""")
      ]
    ),
  ]
  tools = [
    types.Tool(
      retrieval=types.Retrieval(
        vertex_rag_store=types.VertexRagStore(
          rag_resources=[
            types.VertexRagStoreRagResource(
              rag_corpus="projects/439974099982/locations/us-east4/ragCorpora/6838716034162098176"
            )
          ],
          rag_retrieval_config=types.RagRetrievalConfig(
            filter=types.RagRetrievalConfigFilter(
              # Restrict retrieval to chunks/files tagged with this user's id
              metadata_filter=f"user_id == \"{os.getenv('APP_USER_ID','demo_user')}\""
            ),
            top_k=8,
          ),
        )
      )
    )
  ]

  generate_content_config = types.GenerateContentConfig(
    temperature = 1,
    top_p = 0.95,
    max_output_tokens = 65535,
    safety_settings = [types.SafetySetting(
      category="HARM_CATEGORY_HATE_SPEECH",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_HARASSMENT",
      threshold="OFF"
    )],
    tools = tools,
    thinking_config=types.ThinkingConfig(
      thinking_budget=0,
    ),
  )

  for chunk in client.models.generate_content_stream(
    model = model,
    contents = contents,
    config = generate_content_config,
    ):
    if not chunk.candidates or not chunk.candidates[0].content or not chunk.candidates[0].content.parts:
        continue
    print(chunk.text, end="")

generate()