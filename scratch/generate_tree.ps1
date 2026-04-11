$files = Get-ChildItem -Recurse | Where-Object { $_.FullName -notmatch "node_modules|\.git|dist|release|build|test-results" }
$output = New-Object System.Collections.Generic.List[string]
$output.Add("# Project Recursive Structure")
$output.Add("```text")
foreach ($f in $files) {
    if ($f.FullName -match 'C:\\Users\\Victus\\Desktop\\quizlab\\(.*)') {
        $rel = $matches[1]
        if ($f.PSIsContainer) { $output.Add("+ $rel/") }
        else { $output.Add("  - $rel") }
    }
}
$output.Add("```")
[System.IO.File]::WriteAllLines('PROJECT_STRUCTURE.md', $output)
