<script>
  import { onMount } from 'svelte';

  let user = null;

  onMount(() => {
    const storedUser = localStorage.getItem('google_user');
    if (storedUser) {
      user = JSON.parse(storedUser);
    }
  });
</script>

<main class="container mx-auto max-w-5xl p-6">
  <div class="mb-8">
    <h1 class="text-4xl font-bold mb-4 text-primary">📚 App Help & Documentation</h1>
    <p class="text-base-content/70">Understanding how this RAG-powered job application assistant works</p>
  </div>

  <div class="space-y-8">
    <!-- Overview Section -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">🎯 What is this app?</h2>
        <div class="space-y-3 text-base-content/80">
          <p>
            This is a <strong>Retrieval-Augmented Generation (RAG)</strong> application that helps you apply to jobs more effectively.
            It uses Google Cloud's Vertex AI to analyze your resume and generate personalized application materials.
          </p>
          <p>
            <strong>How it works:</strong> You upload your resume and job descriptions. The app stores them in a RAG corpus and uses AI
            to generate tailored cover letters, answer employer questions, and analyze job fit - all based on YOUR actual experience.
          </p>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">✨ Features</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex items-start gap-3">
            <span class="text-2xl">🗄️</span>
            <div>
              <h3 class="font-bold">Files</h3>
              <p class="text-sm text-base-content/70">Upload resumes and manage your documents in the cloud</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">🔍</span>
            <div>
              <h3 class="font-bold">Search</h3>
              <p class="text-sm text-base-content/70">Query your resume using natural language AI</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">✍️</span>
            <div>
              <h3 class="font-bold">Cover Letters</h3>
              <p class="text-sm text-base-content/70">Generate human-like cover letters for each job</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">❓</span>
            <div>
              <h3 class="font-bold">Q&A</h3>
              <p class="text-sm text-base-content/70">Get AI recommendations for employer screening questions</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">🎯</span>
            <div>
              <h3 class="font-bold">Job Analysis</h3>
              <p class="text-sm text-base-content/70">Analyze how well you match a job posting</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">✨</span>
            <div>
              <h3 class="font-bold">Resume Enhancement</h3>
              <p class="text-sm text-base-content/70">Optimize your resume for ATS and specific jobs</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- API & Rate Limiting Section -->
    <div class="card bg-base-100 shadow-xl border-2 border-warning">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">⚡ Rate Limiting & API Usage</h2>

        <div class="alert alert-info mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <div>
            <h3 class="font-bold">Rate limits apply only to AI-powered features</h3>
            <div class="text-sm">You have <strong>100 AI requests per hour</strong>. Browsing jobs and editing prompts don't count against this limit.</div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <h3 class="text-lg font-bold mb-2 flex items-center gap-2">
              <span class="badge badge-success">No Rate Limit</span>
              Internal UI Operations
            </h3>
            <p class="text-sm text-base-content/70 mb-2">These actions are unlimited because they just read local files:</p>
            <ul class="list-disc list-inside space-y-1 text-sm ml-4">
              <li><code class="bg-base-200 px-2 py-1 rounded">/api/jobs</code> - Browse your job listings</li>
              <li><code class="bg-base-200 px-2 py-1 rounded">/api/jobs/[filename]</code> - View job details</li>
              <li><code class="bg-base-200 px-2 py-1 rounded">/api/prompts/*</code> - Edit AI prompts</li>
            </ul>
          </div>

          <div class="divider"></div>

          <div>
            <h3 class="text-lg font-bold mb-2 flex items-center gap-2">
              <span class="badge badge-warning">Rate Limited</span>
              AI-Powered Features (100/hour)
            </h3>
            <p class="text-sm text-base-content/70 mb-2">These features call Google Vertex AI RAG and count against your limit:</p>

            <div class="space-y-3 ml-4">
              <div>
                <h4 class="font-semibold text-sm mb-1">🤖 RAG Query Operations</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/rag/query</code> - Direct RAG queries</li>
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/generate</code> - All AI generation features</li>
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/cover_letter</code> - Cover letter generation</li>
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/resume</code> - Resume enhancement</li>
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/questionAndAnswers</code> - Q&A recommendations</li>
                </ul>
              </div>

              <div>
                <h4 class="font-semibold text-sm mb-1">☁️ Cloud Storage Operations</h4>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/files</code> - File uploads/management</li>
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/storage/*</code> - Cloud storage access</li>
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/corpus/*</code> - RAG corpus operations</li>
                  <li><code class="bg-base-200 px-2 py-1 rounded">/api/rag/import</code> - Import documents to RAG</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="alert alert-warning mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div class="text-sm">
              <strong>Why the limit?</strong> Each AI request costs money (Google Cloud API calls). The limit prevents accidental runaway costs
              while still giving you plenty of requests for normal use.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tips Section -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">💡 Tips for Best Results</h2>
        <div class="space-y-3">
          <div class="flex items-start gap-3">
            <span class="text-2xl">📝</span>
            <div>
              <h3 class="font-bold">Upload a comprehensive resume</h3>
              <p class="text-sm text-base-content/70">The more detail in your resume, the better the AI can tailor responses. Include metrics, achievements, and specific technologies.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">🎨</span>
            <div>
              <h3 class="font-bold">Customize the AI prompts</h3>
              <p class="text-sm text-base-content/70">Each page has an editable prompt. Adjust it to match your voice and style. Click the "🤖 AI Prompt Editor" section to edit.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">🔄</span>
            <div>
              <h3 class="font-bold">Review and edit AI outputs</h3>
              <p class="text-sm text-base-content/70">AI-generated content is a starting point. Always review and personalize it before submitting to employers.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl">💾</span>
            <div>
              <h3 class="font-bold">Add job descriptions to src/jobs/</h3>
              <p class="text-sm text-base-content/70">Save job postings as JSON files in the src/jobs/ directory. The app will automatically detect and list them.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Technical Details -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">🔧 Technical Stack</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 class="font-bold mb-2">Frontend</h3>
            <ul class="list-disc list-inside space-y-1 text-base-content/70">
              <li>SvelteKit</li>
              <li>DaisyUI (Tailwind CSS)</li>
              <li>Google OAuth</li>
            </ul>
          </div>
          <div>
            <h3 class="font-bold mb-2">Backend</h3>
            <ul class="list-disc list-inside space-y-1 text-base-content/70">
              <li>Google Cloud Vertex AI</li>
              <li>RAG (Retrieval-Augmented Generation)</li>
              <li>Cloud Storage</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- FAQ Section -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">❓ FAQ</h2>
        <div class="space-y-4">
          <div>
            <h3 class="font-bold">Why do I get "Rate limit exceeded" sometimes?</h3>
            <p class="text-sm text-base-content/70">
              You're only rate-limited when using AI features (generating cover letters, Q&A, etc.). You can browse jobs,
              edit prompts, and view files without limits. Wait an hour for your limit to reset, or use features more sparingly.
            </p>
          </div>
          <div>
            <h3 class="font-bold">Is my data private?</h3>
            <p class="text-sm text-base-content/70">
              Your resume is stored in your personal Google Cloud Storage bucket and RAG corpus. It's isolated to your Google account.
            </p>
          </div>
          <div>
            <h3 class="font-bold">Can I use this for LinkedIn auto-apply?</h3>
            <p class="text-sm text-base-content/70">
              Yes! The cover letter generator is optimized for LinkedIn's application system. Save job details as JSON files
              and call the API from your automation script.
            </p>
          </div>
          <div>
            <h3 class="font-bold">How do I reset a prompt to default?</h3>
            <p class="text-sm text-base-content/70">
              If you've modified a prompt, a "↺ Reset" button will appear in the prompt editor. Click it to restore the default.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>

<style>
  code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.85em;
  }
</style>
