[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Dataset,
    [int]$MaxEpochs = 5000,
    [switch]$Resume,
    [string]$NodePath
)
$ErrorActionPreference = 'Stop'
try {
    $nodeExecutable = if ($NodePath) { (Get-Item -LiteralPath $NodePath -ErrorAction Stop).FullName } else { (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source }
    $runtimeVersion = & $nodeExecutable --version
    if ($LASTEXITCODE -ne 0 -or $runtimeVersion -ne 'v24.14.0') { throw 'Node.js 24.14.0 is required; use -NodePath for an explicit executable.' }
    $cliArguments = @((Join-Path $PSScriptRoot 'ai-train.mjs'), 'training', '--dataset', $Dataset)
    if ($PSBoundParameters.ContainsKey('MaxEpochs')) { $cliArguments += @('--max-epochs', [string]$MaxEpochs) }
    if ($Resume) { $cliArguments += '--resume' }
    & $nodeExecutable @cliArguments
    exit $LASTEXITCODE
} catch { Write-Error $_ -ErrorAction Continue; exit 2 }
