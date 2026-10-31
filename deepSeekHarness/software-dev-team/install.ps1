<#
.SYNOPSIS
    把「软件开发团队」Agent 预设（dev-team）安装到 DeepSeek Harness 的 profile patch 层。

.DESCRIPTION
    预设声明来自 preset-dev-team.patch.yml（原样导出自本机已安装的配置）。

    脚本做四件事：
      1. 定位 profile 目录（默认 %USERPROFILE%\.dsh\profiles\desktop）；
      2. 备份现有的 cordis.patch.yml；
      3. 若 preset-dev-team 尚不存在，则把预设声明追加到 patch 层（带标记注释，便于卸载）；
      4. 把 agent-preset-registry 的 selectedDefault 设为 dev-team（新任务默认走团队模式）。

    脚本幂等：重复执行不会产生重复的 preset 行（重复的 preset id 会让声明加载失败）。

.PARAMETER DshHome
    DSH home 目录。默认取环境变量 DSH_HOME，未设置时用 %USERPROFILE%\.dsh。

.PARAMETER Profile
    profile 名。桌面版为 desktop。

.PARAMETER PresetFile
    预设声明文件，默认取本脚本同目录的 preset-dev-team.patch.yml。

.PARAMETER NoSetAsDefault
    只安装预设，不改默认选中项。

.PARAMETER Force
    即使已存在 preset-dev-team 也重新追加（会先删除旧的同名块）。

.EXAMPLE
    pwsh -File .\install.ps1
    pwsh -File .\install.ps1 -Profile web -NoSetAsDefault
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }),
    [string]$Profile = 'desktop',
    [string]$PresetFile = (Join-Path $PSScriptRoot 'preset-dev-team.patch.yml'),
    [switch]$NoSetAsDefault,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$BeginMarker = '# >>> deepSeekHarness dev-team preset (begin) >>>'
$EndMarker   = '# <<< deepSeekHarness dev-team preset (end) <<<'
$PresetId    = 'dev-team'

$DefaultBeginMarker = '# >>> deepSeekHarness dev-team default selection (begin) >>>'
$DefaultEndMarker   = '# <<< deepSeekHarness dev-team default selection (end) <<<'

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
    $begin = $Lines.IndexOf($BeginMarker)
    if ($begin -ge 0) {
        $end = $Lines.IndexOf($EndMarker, $begin)
        if ($end -lt 0) { $end = $Lines.Count - 1 }
        $Lines.RemoveRange($begin, ($end - $begin) + 1)
        return $true
    }

    # 2) 回退：删除包含 preset-dev-team 的顶层 `- insert:` 条目
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -notmatch '^-\s+insert:\s*$') { continue }
        $end = $Lines.Count
        for ($j = $i + 1; $j -lt $Lines.Count; $j++) {
            if ($Lines[$j] -match '^-\s') { $end = $j; break }
        }
        $slice = $Lines.GetRange($i, $end - $i)
        if (($slice -join "`n") -match 'id:\s*preset-dev-team\s*$') {
            $Lines.RemoveRange($i, $end - $i)
            return $true
        }
    }
    return $false
}

function Set-RegistryDefault {
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
        if ($Lines[$i] -match '^(\s*)selectedDefault:') {
            $Lines[$i] = $Matches[1] + 'selectedDefault: ' + $Id
            return 'updated'
        }
    }
    for ($i = $idx + 1; $i -lt $end; $i++) {
        if ($Lines[$i] -match '^(\s*)default:') {
            $Lines.Insert($i + 1, $Matches[1] + 'selectedDefault: ' + $Id)
            return 'inserted'
        }
    }
    for ($i = $idx + 1; $i -lt $end; $i++) {
        if ($Lines[$i] -match '^(\s*)config:\s*$') {
            $Lines.Insert($i + 1, $Matches[1] + '  selectedDefault: ' + $Id)
            return 'inserted'
        }
    }
    return 'not-found'
}

# ---------------------------------------------------------------- 读取预设文件
if (-not (Test-Path -LiteralPath $PresetFile -PathType Leaf)) {
    throw "找不到预设声明文件：$PresetFile"
}
$presetText = [System.IO.File]::ReadAllText($PresetFile, [System.Text.Encoding]::UTF8)
$presetLines = Get-NormalizedLines $presetText

# 跳过导出文件的头部注释（直到第一个空行）
$head = 0
while ($head -lt $presetLines.Length -and $presetLines[$head].Trim() -ne '') { $head++ }
if ($head -lt $presetLines.Length) { $head++ }
if ($head -ge $presetLines.Length) { throw "预设声明文件内容为空：$PresetFile" }
$block = $presetLines[$head..($presetLines.Length - 1)]

$hasPresetRow = @($block | Where-Object { $_ -match '^\s*-\s+id:\s*preset-dev-team\s*$' })
if ($hasPresetRow.Count -eq 0) { throw "预设声明文件里找不到 id: preset-dev-team：$PresetFile" }

# ---------------------------------------------------------------- 定位 profile
$profileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
$patchFile  = Join-Path $profileDir 'cordis.patch.yml'

Write-Host "DSH home   : $DshHome"
Write-Host "profile    : $Profile  ($profileDir)"
Write-Host "patch 文件 : $patchFile"
Write-Host ''

if (-not $PSCmdlet.ShouldProcess($patchFile, '写入 dev-team 预设声明')) {
    Write-Host '已取消（-WhatIf）。'
    return
}

if (-not (Test-Path -LiteralPath $profileDir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
}

$existingText = ''
if (Test-Path -LiteralPath $patchFile -PathType Leaf) {
    $existingText = [System.IO.File]::ReadAllText($patchFile, [System.Text.Encoding]::UTF8)
} else {
    Write-Host 'patch 文件不存在，将新建。'
}

$eol = Get-LineEnding $existingText
$lines = [System.Collections.Generic.List[string]]::new()
foreach ($l in (Get-NormalizedLines $existingText)) { $lines.Add($l) }
while ($lines.Count -gt 0 -and $lines[$lines.Count - 1].Trim() -eq '') { $lines.RemoveAt($lines.Count - 1) }

$alreadyInstalled = @($lines | Where-Object { $_ -match '^\s*-\s+id:\s*preset-dev-team\s*$' }).Count -gt 0

if ($alreadyInstalled -and -not $Force) {
    Write-Host '已存在 preset-dev-team，跳过写入（要重装请加 -Force）。'
} else {
    if ($alreadyInstalled) {
        Write-Host '已存在 preset-dev-team，按 -Force 删除旧块后重装。'
        [void](Remove-PresetBlock $lines)
        while ($lines.Count -gt 0 -and $lines[$lines.Count - 1].Trim() -eq '') { $lines.RemoveAt($lines.Count - 1) }
    }
    $lines.Add('')
    $lines.Add($BeginMarker)
    foreach ($l in $block) { $lines.Add($l) }
    $lines.Add($EndMarker)
    Write-Host '已写入预设声明。'
}

if (-not $NoSetAsDefault) {
    $state = Set-RegistryDefault -Lines $lines -Id $PresetId
    switch ($state) {
        'updated'      { Write-Host "已把 agent-preset-registry 的 selectedDefault 设为 $PresetId。" }
        'inserted'     { Write-Host "已在 agent-preset-registry 里补上 selectedDefault: $PresetId。" }
        'missing-entry' {
            Write-Host "patch 层里没有 agent-preset-registry 条目，追加一条（保留部署默认值 standard）。"
            $lines.Add('')
            $lines.Add($DefaultBeginMarker)
            $lines.Add('- id: agent-preset-registry')
            $lines.Add('  name: "@deepseek-ai/dsh-agent-preset-registry"')
            $lines.Add('  config:')
            $lines.Add('    default: standard')
            $lines.Add("    selectedDefault: $PresetId")
            $lines.Add($DefaultEndMarker)
        }
        default        { Write-Host '未能定位 agent-preset-registry 的 config，默认项请在「设置 → Agent 预设」里手动选。' }
    }
}

# ---------------------------------------------------------------- 备份并写回
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = "$patchFile.bak-$stamp"
if (Test-Path -LiteralPath $patchFile -PathType Leaf) {
    Copy-Item -LiteralPath $patchFile -Destination $backupFile -Force
    Write-Host "已备份：$backupFile"
}

$out = ($lines -join $eol) + $eol
[System.IO.File]::WriteAllText($patchFile, $out, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "已写入：$patchFile"
Write-Host ''
Write-Host '下一步：'
Write-Host '  1. 若 DeepSeek Harness 正在运行，profile patch 的改动通常会被实时重载；没有生效就重启应用。'
Write-Host '  2. 打开「设置 → Agent 预设」，确认「自定义」分组里出现「软件开发团队」。'
Write-Host '  3. 新建任务时，模式选择器里应能看到「软件开发团队」。'
