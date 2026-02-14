<script lang="ts">
  import { onMount } from 'svelte';
  import '$styles/shared.css';
  import AdminGuard from '$lib/components/AdminGuard.svelte';

  let questionsData: any = null;
  let loading = true;
  let error: string | null = null;
  let saving = false;
  let editingQuestions: Record<string, { keywords: string; answers: string }> = {};

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      loading = true;
      error = null;
      
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/generic-questions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();

      if (result.success) {
        questionsData = result.data;
        // Initialize editing state
        editingQuestions = {};
        questionsData.questions.forEach((q: any) => {
          editingQuestions[q._id] = {
            keywords: q.match_keywords.join(', '),
            answers: q.answers.join(', ')
          };
        });
      } else {
        error = result.error || 'Failed to load questions';
      }
    } catch (err: any) {
      error = `Failed to load data: ${err.message}`;
    } finally {
      loading = false;
    }
  }

  async function saveQuestion(questionId: string) {
    try {
      saving = true;
      const edited = editingQuestions[questionId];
      if (!edited) return;

      const keywords = edited.keywords.split(',').map(k => k.trim()).filter(k => k);
      const answers = edited.answers.split(',').map(a => a.trim()).filter(a => a);

      if (keywords.length === 0 || answers.length === 0) {
        alert('Keywords and answers cannot be empty');
        return;
      }

      const token = localStorage.getItem('session_token');
      const response = await fetch(`/api/generic-questions/${questionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          match_keywords: keywords,
          answers: answers
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
      } else {
        alert(`Failed to save: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error saving: ${err.message}`);
    } finally {
      saving = false;
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm('Delete this question?')) return;

    try {
      saving = true;
      const token = localStorage.getItem('session_token');
      const response = await fetch(`/api/generic-questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
      } else {
        alert(`Failed to delete: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error deleting: ${err.message}`);
    } finally {
      saving = false;
    }
  }

  async function addNewQuestion() {
    try {
      saving = true;
      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/generic-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          // Provide valid starter values so creation succeeds.
          match_keywords: ['new keyword'],
          answers: ['new answer']
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        alert('New generic question added. Update keyword/answer fields as needed.');
      } else {
        alert(`Failed to add: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error adding: ${err.message}`);
    } finally {
      saving = false;
    }
  }

  async function toggleAutoAnswer() {
    try {
      saving = true;
      const newValue = !questionsData.settings.autoAnswer;

      const token = localStorage.getItem('session_token');
      const response = await fetch('/api/generic-questions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'settings',
          settings: { autoAnswer: newValue }
        })
      });

      const result = await response.json();
      if (result.success) {
        questionsData.settings.autoAnswer = newValue;
      } else {
        alert(`Failed to update: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      saving = false;
    }
  }

  async function toggleQuestionActive(questionId: string, currentStatus: boolean) {
    try {
      saving = true;
      const token = localStorage.getItem('session_token');
      const response = await fetch(`/api/generic-questions/${questionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          isActive: !currentStatus
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
      } else {
        alert(`Failed to update: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      saving = false;
    }
  }
</script>

<AdminGuard>
<main class="container mx-auto max-w-5xl p-6">
  <div class="page-header">
    <h1 class="text-4xl font-bold mb-4 text-primary">📝 Generic Questions</h1>
    <p class="text-base-content/70">Manage your generic Q&A pairs that will be used as knowledge base for answering employer questions</p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
      <button class="btn btn-sm" on:click={loadData}>Retry</button>
    </div>
  {:else if questionsData}
    <!-- Controls -->
    <div class="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between bg-base-200 p-4 rounded-lg">
      <!-- Enable/Disable Toggle -->
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium">Smart matching:</span>
        <input
          type="checkbox"
          class="toggle toggle-success"
          checked={questionsData.settings.autoAnswer}
          on:change={toggleAutoAnswer}
          disabled={saving}
        />
        <span class="text-xs {questionsData.settings.autoAnswer ? 'text-success' : 'text-base-content/50'}">
          {questionsData.settings.autoAnswer ? 'ON' : 'OFF'}
        </span>
      </div>

      <!-- Add New Button -->
      <button
        class="btn btn-primary btn-sm gap-2"
        on:click={addNewQuestion}
        disabled={saving}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add New
      </button>
    </div>

    <!-- Info Banner -->
    <div class="alert alert-info mb-6">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <div>
        <h3 class="font-bold">How it works</h3>
        <div class="text-xs">These generic questions and answers are included in your knowledge base when answering employer questions. The AI will use both your resume and these generic answers to provide better responses.</div>
      </div>
    </div>

    <!-- Questions List -->
    <div class="space-y-3">
      {#if questionsData.questions.length === 0}
        <div class="alert">
          <span>No generic questions yet. Click "Add New" to create your first question.</span>
        </div>
      {:else}
        {#each questionsData.questions as question, index (question._id)}
          <div class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-4">
              <!-- Question Header -->
              <div class="flex items-center gap-3 mb-3">
                <div class="badge badge-neutral">#{index + 1}</div>
                {#if question.questionId}
                  <div class="badge badge-outline">ID: {question.questionId}</div>
                {/if}
                <div class="badge {question.isActive ? 'badge-success' : 'badge-error'}">
                  {question.isActive ? 'Active' : 'Inactive'}
                </div>
                <div class="flex-1"></div>
                <button
                  class="btn btn-ghost btn-xs"
                  on:click={() => toggleQuestionActive(question._id, question.isActive)}
                  disabled={saving}
                  title={question.isActive ? 'Deactivate' : 'Activate'}
                >
                  {question.isActive ? '✅' : '❌'}
                </button>
                <button
                  class="btn btn-ghost btn-xs"
                  on:click={() => deleteQuestion(question._id)}
                  disabled={saving}
                  aria-label="Delete question"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="grid grid-cols-1 gap-3">
                <!-- Keywords Input -->
                <div class="form-control">
                  <label class="label py-1" for={`keywords-${question._id}`}>
                    <span class="label-text font-medium">🔍 For questions matching these keywords:</span>
                  </label>
                  <input
                    id={`keywords-${question._id}`}
                    type="text"
                    class="input input-bordered w-full"
                    placeholder='right to work, work authorization, visa status'
                    bind:value={editingQuestions[question._id].keywords}
                    on:blur={() => saveQuestion(question._id)}
                  />
                  <label class="label">
                    <span class="label-text-alt text-base-content/60">Separate multiple keywords with commas</span>
                  </label>
                </div>

                <!-- Answer Input -->
                <div class="form-control">
                  <label class="label py-1" for={`answers-${question._id}`}>
                    <span class="label-text font-medium">✅ Answer with:</span>
                  </label>
                  <input
                    id={`answers-${question._id}`}
                    type="text"
                    class="input input-bordered w-full"
                    placeholder='Australian citizen, Yes, I have work rights'
                    bind:value={editingQuestions[question._id].answers}
                    on:blur={() => saveQuestion(question._id)}
                  />
                  <label class="label">
                    <span class="label-text-alt text-base-content/60">Separate multiple answers with commas (AI will choose the best one)</span>
                  </label>
                </div>
              </div>

              {#if index === 0}
                <!-- Demo Info - Only show on first card -->
                <details class="collapse collapse-arrow bg-base-200 mt-2">
                  <summary class="collapse-title text-xs font-medium py-2 min-h-0">
                    See current values
                  </summary>
                  <div class="collapse-content text-xs">
                    <div class="space-y-1">
                      <div>
                        <span class="font-semibold">Keywords:</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                          {#each question.match_keywords as keyword}
                            <span class="badge badge-xs badge-ghost">{keyword}</span>
                          {/each}
                        </div>
                      </div>
                      <div>
                        <span class="font-semibold">Answers:</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                          {#each question.answers as ans}
                            <span class="badge badge-xs badge-primary">{ans}</span>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Summary -->
    <div class="mt-6 stats shadow">
      <div class="stat">
        <div class="stat-title">Total Questions</div>
        <div class="stat-value text-primary">{questionsData.questions.length}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Active Questions</div>
        <div class="stat-value text-success">{questionsData.questions.filter((q: any) => q.isActive).length}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Status</div>
        <div class="stat-value text-sm {questionsData.settings.autoAnswer ? 'text-success' : 'text-error'}">
          {questionsData.settings.autoAnswer ? 'Enabled' : 'Disabled'}
        </div>
      </div>
    </div>
  {/if}
</main>
</AdminGuard>

<style>
  .page-header {
    margin-bottom: 2rem;
  }
</style>
