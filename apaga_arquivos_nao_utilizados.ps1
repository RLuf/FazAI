# Script para encontrar arquivos potencialmente não utilizados
$projectRoot = "E:\fazai"
$excludeDirs = @(".git", "node_modules", "dist", "build")

$allFiles = Get-ChildItem -Path $projectRoot -Recurse -File |
    Where-Object { $_.DirectoryName -notmatch ($excludeDirs -join '|') }

foreach ($file in $allFiles) {
    $references = Get-ChildItem -Path $projectRoot -Recurse -File |
        Where-Object { $_.FullName -ne $file.FullName } |
        Select-String -Pattern ([regex]::Escape($file.Name))
    
    if (-not $references) {
        Write-Host "Arquivo potencialmente não utilizado: $($file.FullName)" -ForegroundColor Yellow
    }
}