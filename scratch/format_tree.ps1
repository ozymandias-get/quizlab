$tree = Get-Content 'PROJECT_STRUCTURE.md'
$cr = [char]13
$lf = [char]10
$nl = $cr + $lf
$header = '# Project Recursive Structure' + $nl + $nl
$header += '> Generated on ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + $nl
$header += '> Note: node_modules and .git folders are excluded for brevity.' + $nl + $nl
$header += '```text' + $nl
$footer = $nl + '```'

$final = $header + ($tree -join $nl) + $footer
[System.IO.File]::WriteAllText('PROJECT_STRUCTURE.md', $final)
