# JobJinni – Smart Autofill for Job Seekers

Early MVP Chrome Extension.

## Features Implemented
- Profiles: create multiple role-based profiles; set active.
- Field autofill: basic heuristic label/placeholder matching for standard fields.
- Saved interview answers: store Q/A, fuzzy match by Jaccard token similarity, auto-inject into empty textareas, show badge.
- Popup dashboard: manage profiles, edit active profile fields, add/search answers.
- Hotkey (Ctrl+Shift+J) & context menu to trigger smart fill manually.
- Automatic single run 1.5s after page load.
 - Seeded template reflective / achievement questions (empty placeholders to fill).

## Roadmap
- Import/export (JSON backup)
- Similarity threshold slider / per-site config
- Better semantic matching (embeddings, synonyms) – requires local model or API (optional)
- Answer suggestions UI with 1-click copy instead of auto-fill for already filled fields
- Form field mapping overrides per site
- Inline quick-save of new question answers from content script overlay
- Option to disable auto-run, only manual trigger

## Load in Chrome
1. (Temporary) Icons: Currently manifest omits icons until PNGs are added. Provide PNGs named `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` in `icons/` and then re-add the icons block to the manifest if desired.
2. Open chrome://extensions
3. Enable Developer Mode.
4. Load Unpacked -> select `jobjinni-extension` folder.

Quick PowerShell script to create simple placeholder icons (blue square with white JJ) using .NET Drawing (Windows only, optional):
```
Add-Type -AssemblyName System.Drawing
function Make-Icon($size){
	$bmp = New-Object System.Drawing.Bitmap($size,$size)
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.Clear([System.Drawing.Color]::FromArgb(37,99,235))
	$font = New-Object System.Drawing.Font('Segoe UI', [float]($size*0.42), [System.Drawing.FontStyle]::Bold)
	$sf = New-Object System.Drawing.StringFormat
	$sf.Alignment = 'Center'; $sf.LineAlignment='Center'
	$g.SmoothingMode='AntiAlias'
	$g.DrawString('JJ',$font,[System.Drawing.Brushes]::White,([System.Drawing.RectangleF]::new(0,0,$size,$size)),$sf)
	$out = "icons/icon$size.png"
	$bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
	$g.Dispose(); $bmp.Dispose(); Write-Host "Created $out";
}
mkdir -Force icons | Out-Null
16,32,48,128 | ForEach-Object { Make-Icon $_ }
```
Then add back to manifest.json:
```
	"icons": {
		"16": "icons/icon16.png",
		"32": "icons/icon32.png",
		"48": "icons/icon48.png",
		"128": "icons/icon128.png"
	},
```

## Data Storage
All data stored locally via `chrome.storage.local` (profiles & answers). No external network calls.

## Dev Notes
- Matching is minimal; improvement path: token weighting, Levenshtein, or embedding similarity.
- Ensure not to overwrite existing user-entered values; current logic only fills empty fields.

## Contributing
Add feature ideas in roadmap section. Keep manifest permissions minimal.
