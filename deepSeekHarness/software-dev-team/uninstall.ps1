<#
.SYNOPSIS
    从 DeepSeek Harness 的 profile patch 层移除「软件开发团队」Agent 预设（dev-team）。

.DESCRIPTION
    做的事：
      1. 备份现有的 cordis.patch.yml；
      2. 删除预设声明块（优先按安装标记删除，否则按 id: preset-dev-team 删除整条 `- insert:` 条目）；
      3. 把 agent-preset-registry 的 selectedDefault 复位为 standard，或整行删掉。

    不会动 profile 的 package.json、bundle 列表，也不会动其他预设。

.PARAMETER DshHome
    DSH home 目录。默认取环境变量 DSH_HOME，未设置时用 %USERPROFILE%\.dsh。

.PARAMETER Profile
    profile 名。桌面版为 desktop。

.PARAMETER KeepDefault
    保留 selectedDefault 行（只在预设已不存在、但你还想手动改默认值时用）。
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
    [string]$Profile = 'desktop',
    [switch]$KeepDefault
)

$ErrorActionPreference = 'Stop'

$BeginMarker = '# >>> deepSeekHarness dev-team preset (begin) >>>'
$EndMarker   = '# <<< deepSeekHarness dev-team preset (end) <<<'

$DefaultBeginMarker = '# >>> deepSeekHarness dev-team default selection (begin) >>>'
$DefaultEndMarker   = '# <<< deepSeekHarness dev-team default selection (end) <<<'

function Remove-MarkedBlock {
    param([System.Collections.Generic.List[string]]$Lines, [string]$Begin, [string]$End)
    $begin = $Lines.IndexOf($Begin)
    if ($begin -lt 0) { return $false }
    $end = $Lines.IndexOf($End, $begin)
    if ($end -lt 0) { $end = $Lines.Count - 1 }
    $Lines.RemoveRange($begin, ($end - $begin) + 1)
    return $true
}

function Get-NormalizedLines {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return , [string[]]@() }
    return , ([regex]::Split($Text, "`r`n|`n"))
}

function Get-LineEnding {
    param([string]$Text)
    if ($Text -match "`r`n") { return "`r`n" }
    return "`n"
}

function Remove-PresetBlock {
    param([System.Collections.Generic.List[string]]$Lines)

    # 1) 优先删除带标记的块
    if (Remove-MarkedBlock -Lines $Lines -Begin $BeginMarker -End $EndMarker) { return $true }

    # 2) 回退：删除包含 preset-dev-team 的顶层 `- insert:` 条目
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -notmatch '^-\s+insert:\s*$') { continue }
        $end = $Lines.Count
        for ($j = $i + 1; $j -lt $Lines.Count; $j++) {
            if ($Lines[$j] -match '^-\s') { $end = $j; break }
        }
        $slice = $Lines.GetRange($i, $end - $i)
        if (($slice -join "`n") -match '(?m)^.*id:\s*preset-dev-team\s*$') {
            $Lines.RemoveRange($i, $end - $i)
            # 顺手清掉紧贴在被删条目上方的孤儿注释：整块连续注释中只要有一行提到本预设就整块删
            $run = New-Object System.Collections.Generic.List[int]
            for ($k = $i - 1; $k -ge 0; $k--) {
                if ($Lines[$k].Trim() -eq '') { break }
                if ($Lines[$k].Trim() -notmatch '^#') { break }
                $run.Add($k)
            }
            if ($run.Count -gt 0 -and ($run | Where-Object { $Lines[$_] -match 'preset-dev-team|软件开发团队|自定义 preset' }).Count -gt 0) {
                foreach ($k in ($run | Sort-Object -Descending)) { $Lines.RemoveAt($k) }
            }
            return $true
        }
    }
    return $false
}

function Clear-RegistryDefault {
    param([System.Collections.Generic.List[string]]$Lines, [string]$Id)

    $idx = -1
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^- id:\s*agent-preset-registry\s*$') { $idx = $i; break }
    }
    if ($idx -lt 0) { return 'missing-entry' }

    $end = $Lines.Count
    for ($i = $idx + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^-\s') { $end = $i; break }
    }
    for ($i = $idx + 1; $i -lt $end; $i++) {
        if ($Lines[$i] -match '^(\s*)selectedDefault:\s*' + [regex]::Escape($Id) + '\s*$') {
            $Lines.RemoveAt($i)
            return 'removed'
        }
    }
    return 'not-found'
}

$profileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
$patchFile  = Join-Path $profileDir 'cordis.patch.yml'

Write-Host "DSH home   : $DshHome"
Write-Host "profile    : $Profile  ($profileDir)"
Write-Host "patch 文件 : $patchFile"
Write-Host ''

if (-not (Test-Path -LiteralPath $patchFile -PathType Leaf)) {
    Write-Host "找不到 patch 文件，无需卸载：$patchFile"
    return
}

if (-not $PSCmdlet.ShouldProcess($patchFile, '移除 dev-team 预设声明')) {
    Write-Host '已取消（-WhatIf）。'
    return
}

$existingText = [System.IO.File]::ReadAllText($patchFile, [System.Text.Encoding]::UTF8)
$eol = Get-LineEnding $existingText
$lines = [System.Collections.Generic.List[string]]::new()
foreach ($l in (Get-NormalizedLines $existingText)) { $lines.Add($l) }

if (Remove-PresetBlock $lines) {
    Write-Host '已移除预设声明。'
} else {
    Write-Host '没有找到 dev-team 预设声明（可能未安装）。'
}

# 安装脚本自己追加的 registry 条目整块删掉；原本就有的条目只摘掉 selectedDefault
if (Remove-MarkedBlock -Lines $lines -Begin $DefaultBeginMarker -End $DefaultEndMarker) {
    Write-Host '已移除安装脚本追加的 agent-preset-registry 条目。'
} elseif (-not $KeepDefault) {
    $state = Clear-RegistryDefault -Lines $lines -Id 'dev-team'
    switch ($state) {
        'removed'       { Write-Host '已把 agent-preset-registry 的 selectedDefault 复位（删掉 dev-team 行）。' }
        'missing-entry' { Write-Host 'patch 层里没有 agent-preset-registry 条目，无需处理。' }
        default         { Write-Host '没有 selectedDefault: dev-team 行，默认项可能仍指向该预设，请在「设置 → Agent 预设」里改回标准模式。' }
    }
}

while ($lines.Count -gt 0 -and $lines[$lines.Count - 1].Trim() -eq '') { $lines.RemoveAt($lines.Count - 1) }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = "$patchFile.bak-$stamp"
Copy-Item -LiteralPath $patchFile -Destination $backupFile -Force
Write-Host "已备份：$backupFile"

$out = ($lines -join $eol) + $eol
[System.IO.File]::WriteAllText($patchFile, $out, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "已写入：$patchFile"
Write-Host ''
Write-Host '改动生效后，「设置 → Agent 预设」里的「软件开发团队」卡片会消失；已有会话仍保持创建时的组合。'
