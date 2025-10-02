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

  // Handle both formats: with spaces and with underscores
  $: skillsInResume = get(analysisResult, 'skills_in_resume', get(analysisResult, 'skills in resume', []));
  $: skillsInJD = get(analysisResult, 'skills_in_jd', get(analysisResult, 'skills in JD', []));
  $: matchedSkills = get(analysisResult, 'matched_skills', get(analysisResult, 'matched skills', []));
  $: missingSkills = get(analysisResult, 'missing_skills', get(analysisResult, 'missing skills', []));

  $: keywordsInResume = get(analysisResult, 'keywords_in_resume', get(analysisResult, 'KEYWORDS in resume', []));
  $: keywordsInJD = get(analysisResult, 'keywords_in_jd', get(analysisResult, 'KEYWORDS in JD', []));
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

    <!-- Skills Breakdown -->
    <div class="card bg-base-100 shadow-md col-span-1 md:col-span-2">
      <div class="card-body">
        <h3 class="card-title mb-4">📊 Skills Analysis</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Your Skills -->
          <div class="p-3 bg-base-200 rounded-lg">
            <h4 class="font-semibold text-sm mb-2">Your Skills ({skillsInResume.length})</h4>
            {#if skillsInResume.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each skillsInResume as skill}
                  <span class="badge badge-sm">{skill}</span>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-base-content/60">No skills extracted</p>
            {/if}
          </div>

          <!-- Required Skills -->
          <div class="p-3 bg-base-200 rounded-lg">
            <h4 class="font-semibold text-sm mb-2">Required Skills ({skillsInJD.length})</h4>
            {#if skillsInJD.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each skillsInJD as skill}
                  <span class="badge badge-sm badge-outline">{skill}</span>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-base-content/60">No skills extracted</p>
            {/if}
          </div>

          <!-- Match Summary -->
          <div class="p-3 bg-base-200 rounded-lg">
            <h4 class="font-semibold text-sm mb-2">Match Summary</h4>
            <div class="space-y-2">
              <div>
                <span class="text-xs text-success">✅ Matched: {matchedSkills.length}</span>
                {#if matchedSkills.length > 0}
                  <div class="text-xs mt-1 flex flex-wrap gap-1">
                    {#each matchedSkills as skill}
                      <span class="badge badge-success badge-xs">{skill}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div>
                <span class="text-xs text-error">❌ Missing: {missingSkills.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Keywords Breakdown -->
    <div class="card bg-base-100 shadow-md col-span-1 md:col-span-2">
      <div class="card-body">
        <h3 class="card-title mb-4">🔑 Keywords Analysis</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Matched Keywords -->
          <div>
            <h4 class="font-bold text-success mb-2">✅ Matched Keywords ({matchedKeywords.length})</h4>
            {#if matchedKeywords.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each matchedKeywords as keyword}
                  <span class="badge badge-success">{keyword}</span>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-base-content/60">No keyword matches found</p>
            {/if}
          </div>

          <!-- Missing Keywords -->
          <div>
            <h4 class="font-bold text-error mb-2">❌ Missing Keywords ({missingKeywords.length})</h4>
            {#if missingKeywords.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each missingKeywords as keyword}
                  <span class="badge badge-error badge-outline">{keyword}</span>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-base-content/60">No missing keywords - excellent match!</p>
            {/if}
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
