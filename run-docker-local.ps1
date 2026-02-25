# corpus-rag - Run with Docker on Local Machine
# Prerequisites: Docker Desktop must be installed and running
# Run: .\run-docker-local.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== corpus-rag Local Docker Setup ===" -ForegroundColor Cyan

# 1. Check Docker
Write-Host "`n[1/4] Checking Docker..." -ForegroundColor Yellow
try {
    docker --version | Out-Null
    Write-Host "  OK - Docker is available" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Docker not found. Please install Docker Desktop:" -ForegroundColor Red
    Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    exit 1
}

# 2. Ensure .env exists
Write-Host "`n[2/4] Checking .env file..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $PSScriptRoot ".env.example") $envPath
    Write-Host "  Created .env from .env.example - please edit and add JWT_SECRET" -ForegroundColor Yellow
} else {
    Write-Host "  OK - .env exists" -ForegroundColor Green
}

# 3. Add APP_URL for local if missing
$envContent = Get-Content $envPath -Raw
if ($envContent -notmatch "APP_URL=") {
    Add-Content $envPath "`nAPP_URL=http://localhost:3000"
    Write-Host "  Added APP_URL=http://localhost:3000 to .env" -ForegroundColor Green
}

# 4. Build and run
Write-Host "`n[3/4] Building and starting containers (this may take a few minutes)..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[4/4] Done!" -ForegroundColor Green
    Write-Host "`n  Open in browser: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "`n  Useful commands:" -ForegroundColor White
    Write-Host "    docker compose logs -f app    # View logs" -ForegroundColor Gray
    Write-Host "    docker compose down           # Stop" -ForegroundColor Gray
} else {
    Write-Host "`n  Build failed. Run 'docker compose logs app' for details." -ForegroundColor Red
    exit 1
}
