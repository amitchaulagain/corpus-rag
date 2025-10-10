#!/bin/bash

# Add AdminGuard to all UI pages

pages=(
  "/home/wagle/corpus-rag/src/routes/(app)/job-analysis/+page.svelte"
  "/home/wagle/corpus-rag/src/routes/(app)/search/+page.svelte"
  "/home/wagle/corpus-rag/src/routes/(app)/upload/+page.svelte"
  "/home/wagle/corpus-rag/src/routes/(app)/settings/+page.svelte"
)

for page in "${pages[@]}"; do
  echo "Processing: $page"

  # Add import after first <script> tag
  sed -i '/<script/a\  import AdminGuard from '"'"'$lib/components/AdminGuard.svelte'"'"';' "$page"

  # Find line after </script> and add <AdminGuard>
  sed -i '/<\/script>/a\<AdminGuard>' "$page"

  # Add </AdminGuard> before last line
  echo "</AdminGuard>" >> "$page"

  echo "Done: $page"
done

echo "All pages updated!"
