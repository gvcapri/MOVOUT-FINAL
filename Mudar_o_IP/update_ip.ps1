# Script para atualizar o IP automaticamente nos arquivos de configuração do Frontend e Motorista

# 1. Detectar o IPv4 local da máquina
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi", "Ethernet" | Where-Object { $_.IPv4Address -notlike "169.*" -and $_.IPv4Address -notlike "127.*" } | Select-Object -First 1).IPv4Address

if (-not $ip) {
    Write-Host "Erro: Não foi possível detectar um endereço IP local (Wi-Fi ou Ethernet)." -ForegroundColor Red
    exit
}

Write-Host "IP Detectado: $ip" -ForegroundColor Green

# 2. Caminhos dos arquivos baseados na localização do script
$scriptDir = $PSScriptRoot
$root = Split-Path -Parent $scriptDir # Pasta raiz (Movout-repo)

$pathFrontend = Join-Path $root "Frontend"
$pathMotorista = Join-Path $root "Frontend Motorista"

$configFrontend = Join-Path $pathFrontend "src/api/config.js"
$configMotorista = Join-Path $pathMotorista "src/api/config.js"

# 3. Conteúdo para os arquivos
$contentFrontend = "// Configuracao central da API (Gerado automaticamente)`nconst BASE_IP = '$ip';`n`nexport const API_BASE_URL = 'http://' + BASE_IP + ':8000/api/v1';`nexport const WS_BASE_URL = 'ws://' + BASE_IP + ':8000/api/v1';"

$contentMotorista = "// Configuracao central da API do Motorista (Gerado automaticamente)`nconst BASE_IP = '$ip';`n`nexport const API_BASE_URL = 'http://' + BASE_IP + ':8000/api/v1';`nexport const WS_BASE_URL = 'ws://' + BASE_IP + ':8000/api/v1';"

# 4. Criar/Atualizar os arquivos
if (Test-Path $pathFrontend) {
    $apiDir = Join-Path $pathFrontend "src/api"
    if (-not (Test-Path $apiDir)) { New-Item -Path $apiDir -ItemType Directory -Force | Out-Null }
    [System.IO.File]::WriteAllLines($configFrontend, $contentFrontend.Split("`n"))
    Write-Host "Atualizado: $configFrontend" -ForegroundColor Cyan
}

if (Test-Path $pathMotorista) {
    $apiDir = Join-Path $pathMotorista "src/api"
    if (-not (Test-Path $apiDir)) { New-Item -Path $apiDir -ItemType Directory -Force | Out-Null }
    [System.IO.File]::WriteAllLines($configMotorista, $contentMotorista.Split("`n"))
    Write-Host "Atualizado: $configMotorista" -ForegroundColor Cyan
}

Write-Host "`nSucesso! Os IPs foram atualizados para $ip." -ForegroundColor Green
Write-Host "Lembre-se de reiniciar o Expo ('r' no terminal) para carregar as novas configurações."

