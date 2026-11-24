[CmdletBinding()]
param(
    [string]$Config,
    [string]$LevelDirectory,
    [Parameter(Mandatory=$true)][string]$Output,
    [int]$MaxGames = 1000,
    [int]$EvaluationGames = 300,
    [long]$Seed = 7,
    [int]$Workers = 1,
    [switch]$Resume,
    [string]$NodePath
)
$ErrorActionPreference = 'Stop'
try {
    $nodeExecutable = if ($NodePath) { (Get-Item -LiteralPath $NodePath -ErrorAction Stop).FullName } else { (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source }
    $runtimeVersion = & $nodeExecutable --version
    if ($LASTEXITCODE -ne 0 -or $runtimeVersion -ne 'v24.14.0') { throw 'Node.js 24.14.0 is required; use -NodePath for an explicit executable.' }
    $cliArguments = @((Join-Path $PSScriptRoot 'ai-train.mjs'), 'autoplay', '--output', $Output)
    if ($Resume) { $cliArguments += '--resume' }
    if ($Config) { $cliArguments += @('--config', $Config) }
    if ($LevelDirectory) { $cliArguments += @('--levels', $LevelDirectory) }
    foreach ($mapping in @(@('MaxGames','--max-games'), @('EvaluationGames','--evaluation-games'), @('Seed','--seed'), @('Workers','--workers'))) {
        if ($PSBoundParameters.ContainsKey($mapping[0])) { $cliArguments += @($mapping[1], [string]$PSBoundParameters[$mapping[0]]) }
    }
    & $nodeExecutable @cliArguments
    exit $LASTEXITCODE
} catch { Write-Error $_ -ErrorAction Continue; exit 2 }
