# BidiFixer: Layout & Direction

A smart Chrome extension that fixes mixed text direction issues for websites displaying Arabic, Hebrew, or other RTL (Right-to-Left) languages alongside LTR (Left-to-Right) content.

## Features

- **Smart CSS Injection**: Automatically applies correct text direction and alignment styles to web pages
- **Global Toggle**: Enable/disable the extension across all websites with a single switch
- **Per-Site Settings**: Customize settings for individual websites
- **Force Important Mode**: Override stubborn website styles with `!important` flag
- **Keyboard Shortcut**: Quick toggle with `Ctrl+Shift+E` (Windows/Linux) or `Cmd+Shift+E` (Mac)
- **Visual Status Badge**: Clear ON/OFF indicator in the browser toolbar
- **Dynamic Content Support**: Works with Single Page Applications (SPAs) like Gmail and Twitter using MutationObserver
- **Dark Mode UI**: Modern, eye-friendly popup interface

## How It Works

BidiFixer injects CSS rules that set:
- `direction: rtl` for paragraphs, lists, headings, blockquotes, tables, inputs, and textareas
- `text-align: start` for proper alignment based on text direction
- Preserves LTR direction for code elements (`pre`, `code`, `kbd`, `samp`)

## Installation

### Manual Installation (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked** and select the extension folder
5. The extension icon should appear in your browser toolbar

### From Chrome Web Store

*Coming soon*

## Usage

### Global Settings
- Click the extension icon to open the popup
- Toggle **Enable on all sites** to activate/deactivate globally

### Per-Site Settings
- Navigate to any website
- Click the extension icon
- Use **Enable on this site** to toggle for the current domain only
- Enable **Force Styles (!important)** if the website resists direction changes

### Keyboard Shortcut
Press `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac) to quickly toggle the extension for the current site.

## Technical Details

### Manifest Version
- Uses **Manifest V3** (latest Chrome extension standard)

### Permissions
- `storage`: Save user preferences
- `activeTab`: Access current tab information
- `tabs`: Monitor tab changes for badge updates
- `scripting`: Inject content scripts when needed

### Components

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration |
| `background.js` | Service worker for state management and badge updates |
| `content.js` | Content script that applies CSS fixes to web pages |
| `popup.html` | User interface for settings |
| `popup.js` | Popup logic and storage management |

## Browser Compatibility

- ✅ Google Chrome (v88+)
- ✅ Microsoft Edge (v88+)
- ✅ Other Chromium-based browsers

## License

This project is provided as-is for educational and practical use.

## Contributing

Feel free to submit issues or pull requests for improvements!

---

**Note**: This extension works locally and does not send any data to external servers. All settings are stored in your browser's local storage.
