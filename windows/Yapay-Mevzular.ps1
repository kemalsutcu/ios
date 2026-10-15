#requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('Menu', 'Setup', 'Start', 'Apple', 'Preview', 'Production', 'Submit', 'Device', 'Diagnostics', 'Link', 'Development', 'Simulator')]
    [string]$Action = 'Menu',
    [string]$ProjectRoot = '',
    [string]$TokenPath = 'C:\WIX_SECRETS\ADMIN_TOKEN_EXPO.txt',
    [string]$ProjectId = '',
    [switch]$SkipProjectLink,
    [switch]$DevelopmentClient
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# Resolve paths after param(): $PSScriptRoot may be empty when pasted/dot-sourced.
$scriptDirectory = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDirectory) -and $MyInvocation.MyCommand.PSObject.Properties['Path']) {
    if ($MyInvocation.MyCommand.Path) { $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path }
}
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    if (-not [string]::IsNullOrWhiteSpace($scriptDirectory)) {
        $ProjectRoot = Join-Path $scriptDirectory '..'
    } else {
        $ProjectRoot = (Get-Location).Path
    }
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json') -PathType Leaf)) {
    throw 'package.json bulunamadi. Scripti proje klasorunden veya -ProjectRoot ile calistirin.'
}
$script:ExpectedOwner = 'kemalsutcus-team'
$script:ExpectedSlug = 'yapay-mevzular'
$script:ExpectedBundle = 'com.yapaymevzular.app'
$script:EasCliVersion = '24.9.0'

function Get-Value {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Get-AppIdentity {
    $configPath = Join-Path $ProjectRoot 'app.json'
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $expo = Get-Value $config 'expo'
    $ios = Get-Value $expo 'ios'
    $extra = Get-Value $expo 'extra'
    $eas = Get-Value $extra 'eas'
    return [pscustomobject]@{
        Owner = [string](Get-Value $expo 'owner')
        Slug = [string](Get-Value $expo 'slug')
        Bundle = [string](Get-Value $ios 'bundleIdentifier')
        ProjectId = [string](Get-Value $eas 'projectId')
    }
}

function Assert-Identity {
    $identity = Get-AppIdentity
    if ($identity.Owner -ne $script:ExpectedOwner -or $identity.Slug -ne $script:ExpectedSlug -or $identity.Bundle -ne $script:ExpectedBundle) {
        throw 'app.json kimligi beklenen proje ile ayni degil. owner=kemalsutcus-team, slug=yapay-mevzular, ios.bundleIdentifier=com.yapaymevzular.app olmali.'
    }
}

function Assert-Linked {
    Assert-Identity
    $identity = Get-AppIdentity
    $parsedId = [guid]::Empty
    if (-not [guid]::TryParse($identity.ProjectId, [ref]$parsedId) -or $parsedId -eq [guid]::Empty) {
        throw 'Mevcut Expo projesinin UUID baglantisi eksik. Once menu 1 veya -Action Link ile mevcut projeyi baglayin. Yeni proje otomatik olusturulmaz.'
    }
}

function Get-NpmCommand {
    $command = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    if ($null -eq $command) { $command = Get-Command 'npm' -ErrorAction SilentlyContinue }
    if ($null -eq $command -or -not (Get-Command 'node' -ErrorAction SilentlyContinue)) {
        throw 'Node.js LTS ve npm bulunamadi. Node.js kurulumundan sonra bu pencereyi kapatip KURULUM.bat dosyasini yeniden acin.'
    }
    return $command.Source
}

function Get-LocalTool {
    param([string]$Name)
    $binRoot = Join-Path $ProjectRoot 'node_modules\.bin'
    $path = Join-Path $binRoot ($Name + '.cmd')
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $path = Join-Path $binRoot $Name
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw ('Yerel arac bulunamadi: ' + $Name + '. Once menu 1 (Kurulum) calistirin.')
    }
    return $path
}

function Invoke-Native {
    param([string]$Command, [string[]]$Arguments, [string]$Label)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw ($Label + ' basarisiz. Cikis kodu: ' + $LASTEXITCODE)
    }
}

function Invoke-Eas {
    param([string[]]$Arguments)
    $npmPath = Get-NpmCommand
    $easArguments = @('exec', '--yes', ('--package=eas-cli@' + $script:EasCliVersion), '--', 'eas') + $Arguments
    if (-not (Test-Path -LiteralPath $TokenPath -PathType Leaf)) {
        throw 'Expo token dosyasi bulunamadi. C:\WIX_SECRETS\ADMIN_TOKEN_EXPO.txt icine robot hesabina ait gercek access tokeni tek satir olarak kaydedin veya -TokenPath kullanin.'
    }
    if ((Get-Item -LiteralPath $TokenPath).Length -gt 16384) {
        throw 'Token dosyasi beklenen boyutta degil; yalnizca tek access token icermeli.'
    }
    $tokenValue = [System.IO.File]::ReadAllText($TokenPath).TrimStart([char]0xFEFF).Trim()
    if ($tokenValue.Length -lt 16 -or $tokenValue.Length -gt 4096 -or $tokenValue -match '\s' -or $tokenValue -match '^(?:EXPO_TOKEN|ADMIN_TOKEN_EXPO)=' -or $tokenValue -eq 'ADMIN_TOKEN_EXPO') {
        $tokenValue = $null
        throw 'Token dosyasi gecerli tek satir access token icermiyor. Token adini veya KEY=VALUE ifadesini degil, yalnizca gercek token degerini kaydedin.'
    }
    $previousToken = [Environment]::GetEnvironmentVariable('EXPO_TOKEN', 'Process')
    try {
        [Environment]::SetEnvironmentVariable('EXPO_TOKEN', $tokenValue, 'Process')
        # No token argument, logging, copying, setx, .env file, or EXPO_PUBLIC variable.
        Invoke-Native -Command $npmPath -Arguments $easArguments -Label 'EAS'
    } finally {
        [Environment]::SetEnvironmentVariable('EXPO_TOKEN', $previousToken, 'Process')
        $tokenValue = $null
        $previousToken = $null
    }
}

function Link-ExistingProject {
    Assert-Identity
    $identity = Get-AppIdentity
    $chosenId = $ProjectId.Trim()
    if ($identity.ProjectId) {
        Assert-Linked
        if ($chosenId -and $chosenId -ne $identity.ProjectId) {
            throw 'app.json zaten farkli bir UUID ile bagli. Mevcut baglanti otomatik degistirilmedi.'
        }
        Write-Host ('Mevcut proje UUID: ' + $identity.ProjectId)
        Invoke-Eas -Arguments @('project:info')
        return
    }
    Write-Host 'Hedef: @kemalsutcus-team/yapay-mevzular'
    Write-Host 'Expo Dashboard > bu mevcut proje > Project settings > General > Project ID'
    Write-Host 'https://expo.dev/accounts/kemalsutcus-team/projects/yapay-mevzular/settings'
    if (-not $chosenId) {
        $chosenId = (Read-Host 'Mevcut projenin Project ID (UUID) degerini yapistirin; sonra baglamak icin bos birakin').Trim()
    }
    if (-not $chosenId) {
        Write-Host 'Baglanti ertelendi. Yerel Expo onizleme acilabilir; Apple/build/submit icin once UUID ile baglayin.'
        return
    }
    $parsedId = [guid]::Empty
    if (-not [guid]::TryParse($chosenId, [ref]$parsedId) -or $parsedId -eq [guid]::Empty) {
        throw 'Project ID UUID olmali; proje adi, token veya URL degildir.'
    }
    # --id links an existing project. Never use --account --non-interactive or --force here.
    Invoke-Eas -Arguments @('init', '--id', $parsedId.ToString(), '--no-icon')
    Assert-Linked
    if ((Get-AppIdentity).ProjectId -ne $parsedId.ToString()) {
        throw 'Expo proje baglantisi secilen UUID ile dogrulanamadi; build baslatilmadi.'
    }
    Invoke-Eas -Arguments @('project:info')
    Write-Host 'Yukaridaki proje @kemalsutcus-team/yapay-mevzular olmali. Kurulum tamam; build ayri menu secimidir.'
}

function Invoke-LocalChecks {
    $npmPath = Get-NpmCommand
    foreach ($checkName in @('doctor', 'typecheck', 'lint')) {
        Write-Host ('Kontrol: ' + $checkName)
        Invoke-Native -Command $npmPath -Arguments @('run', $checkName) -Label $checkName
    }
}

function Invoke-Setup {
    Assert-Identity
    $npmPath = Get-NpmCommand
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package-lock.json') -PathType Leaf)) {
        throw 'package-lock.json eksik. Tam proje paketini acin; kurulum kilit dosyasini yeniden uretmez.'
    }
    Write-Host 'Bagimliliklar package-lock.json ile kuruluyor...'
    Invoke-Native -Command $npmPath -Arguments @('ci', '--engine-strict') -Label 'npm ci'
    Invoke-LocalChecks
    if ($SkipProjectLink) {
        Write-Host 'Yerel kurulum tamam. Expo proje baglantisi -SkipProjectLink nedeniyle ertelendi.'
    } else {
        Link-ExistingProject
    }
}

function Show-Diagnostics {
    $npmPath = Get-NpmCommand
    Write-Host ('Proje klasoru: ' + $ProjectRoot)
    Invoke-Native -Command 'node' -Arguments @('--version') -Label 'Node.js'
    Invoke-Native -Command $npmPath -Arguments @('--version') -Label 'npm'
    $identity = Get-AppIdentity
    Write-Host ('Expo projesi: @' + $identity.Owner + '/' + $identity.Slug)
    Write-Host ('Bundle ID: ' + $identity.Bundle)
    Write-Host ('Expo UUID: ' + $(if ($identity.ProjectId) { $identity.ProjectId } else { '(henuz bagli degil)' }))
    Write-Host ('Token dosyasi mevcut: ' + (Test-Path -LiteralPath $TokenPath -PathType Leaf))
    Invoke-LocalChecks
    if (Test-Path -LiteralPath $TokenPath -PathType Leaf) {
        Invoke-Eas -Arguments @('whoami')
        if ($identity.ProjectId) { Assert-Linked; Invoke-Eas -Arguments @('project:info') }
    }
}

function Invoke-Action {
    param([string]$SelectedAction)
    switch ($SelectedAction) {
        'Setup' { Invoke-Setup }
        'Link' { Link-ExistingProject }
        'Start' {
            Assert-Identity
            $expoPath = Get-LocalTool 'expo'
            # -DevelopmentClient remains accepted for existing shortcuts; native
            # Sahika now requires a development client for every Start action.
            Write-Host 'Once development buildi iPhonea kurun. Telefon ve bilgisayar ayni Wi-Fi aginda olsun. QR kodunu development client ile acin. Durdurmak icin Ctrl+C.'
            Invoke-Native -Command $expoPath -Arguments @('start', '--lan', '--dev-client') -Label 'Expo'
        }
        'Apple' { Assert-Linked; Invoke-Eas -Arguments @('credentials', '--platform', 'ios') }
        'Device' { Assert-Linked; Invoke-Eas -Arguments @('device:create') }
        'Preview' { Assert-Linked; Invoke-LocalChecks; Invoke-Eas -Arguments @('build', '--platform', 'ios', '--profile', 'preview') }
        'Development' { Assert-Linked; Invoke-LocalChecks; Invoke-Eas -Arguments @('build', '--platform', 'ios', '--profile', 'development') }
        'Simulator' { Assert-Linked; Invoke-LocalChecks; Invoke-Eas -Arguments @('build', '--platform', 'ios', '--profile', 'simulator') }
        'Production' {
            Assert-Linked; Invoke-LocalChecks
            Write-Host 'Production iOS paketi olusturuluyor. App Store Connect/TestFlight gonderimi AYRI menu 6 secimidir.'
            Invoke-Eas -Arguments @('build', '--platform', 'ios', '--profile', 'production')
        }
        'Submit' {
            Assert-Linked
            Write-Host 'EAS listesinden gonderilecek PRODUCTION iOS buildini secin. Otomatik en-son build secilmez.'
            Invoke-Eas -Arguments @('submit', '--platform', 'ios', '--profile', 'production')
        }
        'Diagnostics' { Show-Diagnostics }
        default { throw 'Taninmayan islem.' }
    }
}

Push-Location -LiteralPath $ProjectRoot
try {
    if ($Action -ne 'Menu') { Invoke-Action -SelectedAction $Action; return }
    do {
        Write-Host ''
        Write-Host 'YAPAY MEVZULAR - iPHONE / EXPO'
        Write-Host '1  Kurulum ve mevcut Expo projesini baglama'
        Write-Host '2  Development client sunucusunu baslat (QR)'
        Write-Host '3  Apple sertifika / provisioning ayarlari'
        Write-Host '4  Preview iOS build (kayitli iPhone)'
        Write-Host '5  Production iOS build (TestFlight icin)'
        Write-Host '6  Production buildi App Store Connect/TestFlighta gonder'
        Write-Host '7  iPhone cihazini kaydet'
        Write-Host '8  Tani / yerel kontroller'
        Write-Host '0  Cikis'
        $choice = Read-Host 'Secim'
        $actions = @{ '1'='Setup'; '2'='Start'; '3'='Apple'; '4'='Preview'; '5'='Production'; '6'='Submit'; '7'='Device'; '8'='Diagnostics' }
        if ($choice -eq '0') { break }
        if (-not $actions.ContainsKey($choice)) { Write-Host '0-8 arasinda bir secim girin.'; continue }
        try { Invoke-Action -SelectedAction $actions[$choice] }
        catch { Write-Host ('Islem tamamlanamadi: ' + $_.Exception.Message) -ForegroundColor Red }
    } while ($true)
} finally {
    Pop-Location
}
