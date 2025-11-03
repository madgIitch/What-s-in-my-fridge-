# whats-in-my-fridge-backend/functions/scripts/create-vm-with-gpu.ps1  
  
# Lista de GPUs a probar (ordenadas por disponibilidad y costo)  
$gpuTypes = @(  
    @{Type = "nvidia-tesla-k80"; Count = 1; Description = "Tesla K80 (mas antigua, muy disponible)"},  
    @{Type = "nvidia-tesla-p4"; Count = 1; Description = "Tesla P4 (buena disponibilidad)"},  
    @{Type = "nvidia-tesla-p100"; Count = 1; Description = "Tesla P100 (disponibilidad media)"},  
    @{Type = "nvidia-tesla-v100"; Count = 1; Description = "Tesla V100 (mas cara pero disponible)"}  
)  
  
# Lista de zonas a probar (reducida a las mas probables)  
$zones = @(  
    "us-central1-a",  
    "us-central1-b",  
    "us-central1-c",  
    "us-central1-f",  
    "us-west1-a",  
    "us-west1-b",  
    "us-east4-a",  
    "us-east4-b",  
    "us-east4-c",  
    "europe-west1-b",  
    "europe-west1-c",  
    "europe-west4-a",  
    "europe-west4-b",  
    "asia-east1-a",  
    "asia-east1-c",  
    "asia-southeast1-a",  
    "asia-southeast1-b",  
    "asia-southeast1-c",  
    "australia-southeast1-a",  
    "australia-southeast1-b"  
)  
  
$vmName = "recipe-processor"  
$machineType = "n1-standard-4"  
$imageFamily = "ubuntu-2204-lts"  
$imageProject = "ubuntu-os-cloud"  
$maintenancePolicy = "TERMINATE"  
  
Write-Host "Buscando zona con GPU disponible..." -ForegroundColor Cyan  
Write-Host "Probando $($gpuTypes.Count) tipos de GPU en $($zones.Count) zonas`n" -ForegroundColor Cyan  
  
$success = $false  
$attemptCount = 0  
$totalAttempts = $gpuTypes.Count * $zones.Count  
  
foreach ($gpu in $gpuTypes) {  
    Write-Host "`n=== Probando GPU: $($gpu.Description) ===" -ForegroundColor Yellow  
      
    foreach ($zone in $zones) {  
        $attemptCount++  
        Write-Host "[$attemptCount/$totalAttempts] Zona: $zone" -ForegroundColor White  
          
        try {  
            $acceleratorArg = "type=$($gpu.Type),count=$($gpu.Count)"  
              
            $args = @(  
                "compute",  
                "instances",  
                "create",  
                $vmName,  
                "--zone=$zone",  
                "--machine-type=$machineType",  
                "--accelerator=$acceleratorArg",  
                "--image-family=$imageFamily",  
                "--image-project=$imageProject",  
                "--maintenance-policy=$maintenancePolicy",  
                "--quiet"  
            )  
              
            & gcloud @args 2>&1 | Out-Null  
              
            if ($LASTEXITCODE -eq 0) {  
                Write-Host "`nEXITO! VM creada correctamente" -ForegroundColor Green  
                Write-Host "Nombre: $vmName" -ForegroundColor Green  
                Write-Host "Zona: $zone" -ForegroundColor Green  
                Write-Host "Tipo: $machineType" -ForegroundColor Green  
                Write-Host "GPU: $($gpu.Type)" -ForegroundColor Green  
                Write-Host "`nPasos siguientes:" -ForegroundColor Cyan  
                Write-Host "   1. Conectar por SSH: gcloud compute ssh $vmName --zone=$zone" -ForegroundColor White  
                Write-Host "   2. Instalar Ollama: curl -fsSL https://ollama.com/install.sh | sh" -ForegroundColor White  
                Write-Host "   3. Descargar modelo: ollama pull llama3.1:8b" -ForegroundColor White  
                Write-Host "   4. Instalar Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs" -ForegroundColor White  
                Write-Host "   5. Ejecutar script: cd functions; npm install; npx ts-node src/normalizeRecipesLlama.ts" -ForegroundColor White  
                Write-Host "   6. Descargar resultados: gcloud compute scp $vmName`:~/functions/data/recipes.json . --zone=$zone" -ForegroundColor White  
                Write-Host "   7. Eliminar VM: gcloud compute instances delete $vmName --zone=$zone" -ForegroundColor White  
                $success = $true  
                break  
            }  
        }  
        catch {  
            $errorMsg = $_.Exception.Message  
            if ($errorMsg -like "*ZONE_RESOURCE_POOL_EXHAUSTED*") {  
                Write-Host "  Sin recursos disponibles" -ForegroundColor DarkYellow  
            }  
            else {  
                Write-Host "  Error: $errorMsg" -ForegroundColor Red  
            }  
        }  
          
        Start-Sleep -Seconds 1  
    }  
      
    if ($success) {  
        break  
    }  
}  
  
if (-not $success) {  
    Write-Host "`nNo se pudo crear la VM en ninguna zona disponible." -ForegroundColor Red  
    Write-Host "`nOpciones alternativas:" -ForegroundColor Yellow  
    Write-Host "   1. Intenta de nuevo en 1-2 horas (la disponibilidad cambia)" -ForegroundColor White  
    Write-Host "   2. Usa VM sin GPU (mas lento pero disponible inmediatamente)" -ForegroundColor White  
    Write-Host "   3. Ejecuta el procesamiento localmente" -ForegroundColor White  
    exit 1  
}