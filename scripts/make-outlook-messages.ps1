# Writes unsent Outlook messages (.msg) from a JSON list made by make-beta-emails.py.
# Each entry: { path, subject, html, attach }. Needs classic Outlook installed.
param([Parameter(Mandatory = $true)][string]$Manifest)

$items = Get-Content -Raw -Encoding UTF8 $Manifest | ConvertFrom-Json
$ol = New-Object -ComObject Outlook.Application
foreach ($it in $items) {
    $m = $ol.CreateItem(0)                 # olMailItem
    $m.Subject = $it.subject
    $m.BodyFormat = 2                      # olFormatHTML
    $m.HTMLBody = $it.html
    if ($it.attach) { [void]$m.Attachments.Add($it.attach) }
    $m.SaveAs($it.path, 9)                 # olMSGUnicode
    $m.Close(1)                            # olDiscard: nothing is left in Drafts
    Write-Output $it.path
}
