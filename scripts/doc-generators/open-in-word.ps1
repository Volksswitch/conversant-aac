<#
    Ask WORD whether a .docx actually opens. The only check that has ever been right.

      powershell -File scripts/doc-generators/open-in-word.ps1 "Documents\*.docx"
      powershell -File scripts/doc-generators/open-in-word.ps1 "Documents\One File.docx"

    Exit code 0 if every file opened, 1 if any failed.

    WHY THIS EXISTS, and it is the third time (August 27 2026). A .docx that Word
    refuses has now been produced three separate ways -- xml.etree rewriting the
    namespace prefixes, an emptied table cell, and a numbering list used but never
    declared -- and on every occasion EVERY LOCAL CHECK SAID THE FILE WAS FINE:

      * it unzipped, and every part parsed
      * python-docx opened it and read back all the text
      * LibreOffice converted it without complaint
      * check-docs.py ran all twenty rules over it and reported zero errors

    So the lesson recorded after the second time -- "a docx check must assert what the
    CONSUMER requires, not what the parser accepts" -- was right and was still not
    enough, because it was implemented as a list of the two faults already known. A
    list of known faults cannot catch the next new one. Word can.

    Word is installed on this machine and always was. It was simply never asked.

    NOTES
      * Opened read-only, with no window and no alerts, so nothing is modified and
        nothing can pop a dialog and hang.
      * A Word process is started once for the WHOLE BATCH and quit at the end,
        including on failure -- an orphaned WINWORD.EXE holding a file open is its
        own small disaster. Pass every path in one call: starting Word once per
        document takes minutes over the document set and seconds in one batch.
      * Paths must be absolute for Word. Relative ones are resolved here.
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
            # Open(path, ConfirmConversions=false, ReadOnly=true)
            $doc = $word.Documents.Open($f.FullName, $false, $true)
            Write-Host ("  OK    {0}" -f $f.Name)
            $doc.Close(0)
        } catch {
            $failed++
            $msg = ($_.Exception.Message -split "`n")[0]
            Write-Host ("  WORD REFUSES  {0}  ->  {1}" -f $f.Name, $msg)
        }
    }
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
if ($failed) { Write-Host "`n$failed document(s) Word will not open."; exit 1 }
Write-Host "`nAll $($files.Count) document(s) open in Word."
exit 0
