# JobJinni – Smart Autofill for Job Seekers

Early MVP Chrome Extension.

## Features Implemented
 - Seeded template reflective / achievement questions (empty placeholders to fill).

## Roadmap

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

## Contributing
Add feature ideas in roadmap section. Keep manifest permissions minimal.
# HireBot - Chrome Extension

A powerful Chrome extension that streamlines hiring and recruitment processes by automating data extraction, candidate management, and email templating.

## Features

### 🔍 Smart Data Extraction
- Automatically extract candidate information from LinkedIn profiles
- Parse job postings from Indeed, Glassdoor, and other job sites
- Extract contact information (emails, phone numbers) from any webpage
- Support for manual selection-based extraction

### 👥 Candidate Management
- Save and organize candidate data locally
- Track candidates across different job sites
- Export candidate data to CSV
- Search and filter saved candidates

### 📧 Email Templates
- Pre-built templates for common recruiting scenarios:
	- Interview invitations
	- Rejection letters
	- Follow-up emails
	- Job offers
	- Reference check requests
- Customizable templates with variable substitution
- One-click template application to email compose areas

### ⚙️ Customizable Settings
- Configure auto-extraction preferences
- Enable/disable specific job sites
- Set data retention periods
- Manage email templates

## Installation

### From Source
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The HireBot extension should now appear in your Chrome toolbar

### Required Files
Before installation, ensure you have:
- All JavaScript files in the `js/` directory
- CSS files in the `css/` directory
- HTML files in the root directory
- Icons in the `icons/` directory (create placeholder icons if needed)
- Template files in the `templates/` directory

## Usage

### Basic Workflow
1. **Navigate** to a job site or candidate profile
2. **Click** the HireBot extension icon
3. **Extract** data using the "Extract Data" button
4. **Review** the extracted information
5. **Save** candidate data or apply email templates

### Supported Sites
- **LinkedIn**: Profile information, job postings
- **Indeed**: Job postings, candidate profiles
- **Glassdoor**: Job listings, company information
- **Generic sites**: Email and phone extraction

### Email Templates
1. Navigate to any email compose area
2. Open HireBot popup
3. Click "Use Template"
4. Select desired template
5. Template will be automatically inserted

## File Structure

```
hirebot-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main popup interface
├── options.html          # Settings page
├── css/
│   ├── popup.css         # Popup styling
│   └── options.css       # Options page styling
├── js/
│   ├── background.js     # Background service worker
│   ├── content.js        # Content script for web pages
│   ├── popup.js          # Popup UI logic
│   ├── options.js        # Options page logic
│   └── shared/
│       ├── utils.js      # Utility functions
│       ├── storage.js    # Storage management
│       └── messaging.js  # Message handling
├── icons/
│   ├── icon16.png        # 16x16 icon
│   ├── icon32.png        # 32x32 icon
│   ├── icon48.png        # 48x48 icon
│   └── icon128.png       # 128x128 icon
├── templates/
│   └── email_templates.json # Email template definitions
└── README.md            # This file
```

## Development

### Key Components

**Background Script** (`js/background.js`)
- Manages extension lifecycle
- Handles storage operations
- Coordinates between popup and content scripts

**Content Script** (`js/content.js`)
- Runs on web pages
- Extracts data from DOM
- Applies templates to text areas

**Popup Script** (`js/popup.js`)
- Manages popup UI interactions
- Displays extracted data
- Handles user actions

### Adding New Extractors
To add support for a new job site:

1. Add detection logic in `content.js`:
```javascript
if (hostname.includes('newjobsite.com')) {
	this.pageType = 'newjobsite';
}
```

2. Implement extraction method:
```javascript
extractNewJobSiteData() {
	const data = {};
	data.title = this.getTextContent('.job-title-selector');
	data.company = this.getTextContent('.company-selector');
	return data;
}
```

3. Add case to `performExtraction()` method

### Message Passing
The extension uses Chrome's message passing API:

```javascript
// Send message to background
chrome.runtime.sendMessage({
	type: 'MESSAGE_TYPE',
	data: { /* your data */ }
});

// Send message to content script
chrome.tabs.sendMessage(tabId, {
	type: 'MESSAGE_TYPE',
	data: { /* your data */ }
});
```

### Storage
All data is stored locally using Chrome's storage API:
- Candidate data
- User settings
- Email templates

## Permissions

The extension requires:
- `storage`: For saving candidate data and settings
- `activeTab`: For accessing current tab content
- `scripting`: For injecting content scripts
- `tabs`: For managing browser tabs
- `host_permissions`: For accessing job sites

## Privacy

- All data is stored locally on your device
- No data is sent to external servers
- Candidate information remains private
- You control data retention and deletion

## Troubleshooting

### Common Issues

**Extension not working on a site**
- Check if the site is supported
- Ensure content script permissions
- Try refreshing the page

**Data extraction failing**
- Site layout may have changed
- Check browser console for errors
- Try manual selection extraction

**Templates not applying**
- Ensure you're on a page with text inputs
- Check if page uses custom text editors
- Try refreshing the page

### Debug Mode
Enable developer mode and check:
- Browser console for JavaScript errors
- Extension popup console
- Background page console

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Guidelines
- Follow existing code style
- Add comments for complex logic
- Test on multiple job sites
- Update documentation

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For issues, feature requests, or questions:
1. Check the troubleshooting section
2. Create an issue on GitHub
3. Provide detailed reproduction steps

## Changelog

### Version 1.0.0
- Initial release
- LinkedIn, Indeed, Glassdoor support
- Email templates
- Candidate management
- Settings page

---

**Note**: This extension is for educational and productivity purposes. Always respect website terms of service and privacy policies when extracting data.
