# RevistaMaker - Importar certificado de code signing
# -----------------------------------------------------
# Importa el certificado publico de La Recta Imprenta en los stores
# TrustedPublisher y Root de la maquina local. Una vez importado,
# los .exe firmados de RevistaMaker pasan a ser confiables para Windows
# y para los antivirus de terceros.
#
# NOTA: Es el MISMO certificado que usa PrintLayout. Si esta PC ya tiene
# el cert importado (porque corrio install-codesign-cert.ps1 de PrintLayout),
# no necesita correr este. No hace dano correrlo igual.
#
# Como usarlo:
#   1. Bajar este archivo a la PC.
#   2. Click derecho > "Ejecutar con PowerShell" (acepta UAC para admin).
#      O desde una terminal admin:  powershell -ExecutionPolicy Bypass -File install-codesign-cert.ps1

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Se requiere admin. Relanzando con UAC..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$certUrl = "https://github.com/LarectaimprentaCBA/RevistaMaker/raw/main/build/codesign-public.cer"
$tmpCer = Join-Path $env:TEMP "revistamaker-codesign-public.cer"

Write-Host "Descargando certificado desde GitHub..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $certUrl -OutFile $tmpCer -UseBasicParsing

if (-not (Test-Path $tmpCer)) {
    Write-Host "ERROR: no se pudo descargar el certificado." -ForegroundColor Red
    exit 1
}

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $tmpCer
Write-Host ""
Write-Host "Certificado a importar:" -ForegroundColor Green
Write-Host "  Subject:    $($cert.Subject)"
Write-Host "  Issuer:     $($cert.Issuer)"
Write-Host "  Valido:     $($cert.NotBefore) - $($cert.NotAfter)"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host ""

$tpStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "LocalMachine")
$tpStore.Open("ReadWrite")
$tpStore.Add($cert)
$tpStore.Close()
Write-Host "Importado a TrustedPublisher (LocalMachine)." -ForegroundColor Green

$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$rootStore.Open("ReadWrite")
$rootStore.Add($cert)
$rootStore.Close()
Write-Host "Importado a Trusted Root CA (LocalMachine)." -ForegroundColor Green

Remove-Item $tmpCer -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Listo. Ahora podes instalar o actualizar RevistaMaker sin que el antivirus lo bloquee." -ForegroundColor Cyan
Write-Host ""
Read-Host "Pulsa Enter para cerrar"
