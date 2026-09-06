<#
    Export a document to PDF beside itself, through Word.

      powershell -ExecutionPolicy Bypass -File scripts/doc-generators/export-pdf.ps1 "Documents\A.docx"

    The -ExecutionPolicy flag is not optional on this machine: without it the script is
    refused before it runs, which reads as a broken script rather than a policy.

    WHY THIS EXISTS. Several documents ship as a .pdf next to the .docx - that is the
    copy a tester actually opens, because it needs no Word and looks the same on every
    machine. Nothing was regenerating them, and nothing in the sync workflow mentioned
    them, so a sync left the .docx correct and the .pdf beside it describing the app as
    it was weeks earlier. Found September 5 2026: the manuals were three days newer than
    their own PDFs, and the PDFs still described a Settings tab that no longer existed.

    ⚠ A STALE PDF IS WORSE THAN NO PDF, which is why this is worth a script rather than a
    note. It carries no sign of its age, sits under the same name as the current
    document, and is the copy most likely to be read - so the reader has no way to tell
    they are looking at the old one.

    ⚠ IT MUST RUN AFTER update-toc.ps1, not before. The contents listing is a cached
    field, so exporting first bakes yesterday's page numbers into the PDF permanently -
    and unlike the .docx, a PDF has no field to recalculate later.

    Exit code 0 if every file exported, 1 if any failed.
#>
param([Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Path)

$wdFormatPDF = 17
$failed = 0

# ⚠ A FRESH WORD PER DOCUMENT, not one instance for the batch. Sharing an instance is
# faster and is what this did first - and Word disconnected part way through the very
# first run (RPC_E_DISCONNECTED after one export), leaving two documents unexported and
# their stale PDFs in place, which is precisely the failure this script exists to stop.
# One document per instance means a crash costs that document only.
foreach ($p in $Path) {
    $full = (Resolve-Path -LiteralPath $p -ErrorAction SilentlyContinue)
    if (-not $full) {
        Write-Host "  MISSING $p"
        $failed++
        continue
    }
    $full = $full.Path
    $pdf = [System.IO.Path]::ChangeExtension($full, '.pdf')
    $word = $null
    $doc = $null
    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        # ReadOnly: this must never be the thing that modifies a document. It is the last
        # step of a sync, and a save here would undo the work above it.
        $doc = $word.Documents.Open($full, [ref]$false, [ref]$true)
        $doc.ExportAsFixedFormat($pdf, $wdFormatPDF)
        Write-Host ("  EXPORTED " + [System.IO.Path]::GetFileName($pdf))
    } catch {
        Write-Host ("  FAILED   " + [System.IO.Path]::GetFileName($full) + " - " + $_.Exception.Message)
        $failed++
    } finally {
        try { if ($doc) { $doc.Close([ref]$false) } } catch { }
        try { if ($word) { $word.Quit() } } catch { }
    }
}

if ($failed -gt 0) { exit 1 }
exit 0
