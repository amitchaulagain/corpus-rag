<!-- src/lib/components/JobAnalysisResult.svelte -->
<script lang="ts">
  export let analysisResult;

  let showRawJson = false;

  // Helper to safely get nested properties
  const get = (obj, path, defaultValue = null) => {
    const keys = Array.isArray(path) ? path : path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result === null || result === undefined) return defaultValue;
      result = result[key];
    }
    return result === undefined ? defaultValue : result;
  };

  // Safely access all data points
  $: overallScore = Math.round(get(analysisResult, 'overall_fit_score', 0));
  $: skillsScore = Math.round(get(analysisResult, 'category_scores.skills_match_score', 0));
  $: experienceScore = Math.round(get(analysisResult, 'category_scores.experience_match_score', 0));
  $: matchedSkills = get(analysisResult, 'matched_skills', []);
  $: missingSkills = get(analysisResult, 'missing_skills', []);
  $: matchedKeywords = get(analysisResult, 'matched_keywords', []);
  $: missingKeywords = get(analysisResult, 'missing_keywords', []);
  $: summary = get(analysisResult, 'evaluation_summary', 'No summary provided.');
  $: recommendations = get(analysisResult, 'recommendations', []);

</script>

<div class="analysis-container">
  <!-- Header -->
  <div class="header">
    <h2 class="text-2xl font-bold">Job Fit Analysis</h2>
    <button class="btn btn-sm btn-outline" on:click={() => showRawJson = !showRawJson}>
      {showRawJson ? 'Hide' : 'Show'} Raw JSON
    </button>
  </div>

  <!-- Raw JSON View -->
  {#if showRawJson}
    <div class="raw-json-view card bg-base-200 p-4 mt-4">
      <pre class="text-xs">{JSON.stringify(analysisResult, null, 2)}</pre>
    </div>
  {/if}

  <!-- Main Dashboard -->
  <div class="dashboard-grid mt-4">
    <!-- Overall Score Gauge -->
    <div class="card bg-base-100 shadow-md">
      <div class="card-body items-center text-center">
        <h3 class="card-title">Overall Fit Score</h3>
        <div class="radial-progress text-primary" style="--value:{overallScore}; --size:12rem; --thickness: 1.5rem;">
          <span class="text-3xl font-bold">{overallScore}%</span>
        </div>
      </div>
    </div>

    <!-- Category Scores -->
    <div class="card bg-base-100 shadow-md">
      <div class="card-body">
        <h3 class="card-title mb-4">Category Breakdown</h3>
        <div class="space-y-4">
          <div>
            <label class="label">
              <span class="label-text">Skills Match</span>
              <span class="label-text-alt">{skillsScore}%</span>
            </label>
            <progress class="progress progress-success w-full" value={skillsScore} max="100"></progress>
          </div>
          <div>
            <label class="label">
              <span class="label-text">Experience Match</span>
              <span class="label-text-alt">{experienceScore}%</span>
            </label>
            <progress class="progress progress-info w-full" value={experienceScore} max="100"></progress>
          </div>
        </div>
      </div>
    </div>

    <!-- Matched & Missing -->
    <div class="card bg-base-100 shadow-md col-span-1 md:col-span-2">
        <div class="card-body">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Matched Column -->
                <div>
                    <h3 class="font-bold text-lg text-success mb-2">✅ What You Have</h3>
                    <div class="p-2 rounded-lg">
                        <h4 class="font-semibold text-sm mb-1">Matched Skills</h4>
                        {#if matchedSkills.length > 0}
                            <ul class="list-disc list-inside text-sm">
                                {#each matchedSkills as item}
                                    <li>{item}</li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-sm text-base-content/60">No specific skill matches found.</p>
                        {/if}
                    </div>
                    <div class="p-2 mt-2 rounded-lg">
                        <h4 class="font-semibold text-sm mb-1">Matched Keywords</h4>
                        {#if matchedKeywords.length > 0}
                            <ul class="list-disc list-inside text-sm">
                                {#each matchedKeywords as item}
                                    <li>{item}</li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-sm text-base-content/60">No specific keyword matches found.</p>
                        {/if}
                    </div>
                </div>

                <!-- Missing Column -->
                <div>
                    <h3 class="font-bold text-lg text-error mb-2">❌ What You're Missing</h3>
                     <div class="p-2 rounded-lg">
                        <h4 class="font-semibold text-sm mb-1">Missing Skills</h4>
                        {#if missingSkills.length > 0}
                            <ul class="list-disc list-inside text-sm">
                                {#each missingSkills as item}
                                    <li>{item}</li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-sm text-base-content/60">No missing skills identified. Great match!</p>
                        {/if}
                    </div>
                    <div class="p-2 mt-2 rounded-lg">
                        <h4 class="font-semibold text-sm mb-1">Missing Keywords</h4>
                        {#if missingKeywords.length > 0}
                            <ul class="list-disc list-inside text-sm">
                                {#each missingKeywords as item}
                                    <li>{item}</li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-sm text-base-content/60">No missing keywords identified.</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Summary -->
    <div class="card bg-base-100 shadow-md">
      <div class="card-body">
        <h3 class="card-title">AI Evaluation Summary</h3>
        <p class="text-base-content/80">{summary}</p>
      </div>
    </div>

    <!-- Recommendations -->
    <div class="card bg-base-100 shadow-md">
      <div class="card-body">
        <h3 class="card-title">AI Recommendations</h3>
        {#if recommendations.length > 0}
            <ul class="list-decimal list-inside space-y-2 text-base-content/80">
                {#each recommendations as item}
                    <li>{item}</li>
                {/each}
            </ul>
        {:else}
            <p class="text-base-content/60">No recommendations provided.</p>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }
</style>
