<#
    Refresh a document's TABLE OF CONTENTS through Word, and save.

      powershell -File scripts/doc-generators/update-toc.ps1 "Documents\A.docx" "Documents\B.docx"

    WHY THIS NEEDS WORD AT ALL. A table of contents is a FIELD: the .docx stores the
    last result Word calculated, and nothing outside Word can recalculate it, because
    the page a heading lands on is a function of layout - fonts, widths, the printer
    metrics - not of the markup. So the numbers drift the moment a paragraph is added
    anywhere above, and every edit made by python-docx leaves them a little more wrong.
    Word repaginates and rewrites them; there is no other route.

    ⚠ WORD REWRITES THE WHOLE PACKAGE ON SAVE. Unlike every other tool here, this one
    is not surgical - Word re-serializes each part in its own way, so a byte comparison
    against the backup will show most parts changed and proves nothing. Verify by
    comparing the TEXT instead: every paragraph should be identical except the contents
    listing. Back up first; that is what makes this reversible.

    ⚠ UPDATE THE TOC, NOT Fields.Update(). Updating every field in the document would
    also re-evaluate anything else Word calls a field, which is a larger blast radius
    than the job needs.

    Exit code 0 if every file updated, 1 if any failed.
#>
param([Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Path)

$files = @(Get-Item -Path $Path -ErrorAction SilentlyContinue |
           Where-Object { $_.Extension -eq '.docx' -and $_.Name -notlike '~$*' })
if ($files.Count -eq 0) { Write-Host "no .docx matched: $Path"; exit 1 }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$failed = 0
try {
    foreach ($f in $files) {
        try {
            $doc = $word.Documents.Open($f.FullName, $false, $false)
            $n = $doc.TablesOfContents.Count
            if ($n -eq 0) {
                Write-Host ("  NO TOC  {0}" -f $f.Name)
                $doc.Close(0)
                continue
            }
            for ($i = 1; $i -le $n; $i++) { $doc.TablesOfContents.Item($i).Update() | Out-Null }
            $doc.Save()
            $doc.Close(0)
            Write-Host ("  UPDATED {0}  ({1} TOC)" -f $f.Name, $n)
        } catch {
            $failed++
            $msg = ($_.Exception.Message -split "`n")[0]
            Write-Host ("  FAILED  {0}  ->  {1}" -f $f.Name, $msg)
        }
    }
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
if ($failed -gt 0) { Write-Host ""; Write-Host "$failed document(s) failed."; exit 1 }
exit 0
