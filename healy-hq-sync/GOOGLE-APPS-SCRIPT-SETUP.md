# Google Apps Script Setup Guide

## What This Does
- Watches a Drive folder for Keep exports
- Extracts text, lists, and images
- Saves images to a folder
- Pushes all data to Google Sheets
- Runs automatically at 5:30 AM daily

---

## ⚙️ Setup (10 minutes)

### Step 1: Create Your Sheet
1. Go to https://sheets.google.com
2. Create new spreadsheet named "Keep Notes Archive"
3. Get the Sheet ID from the URL:
   - URL: `docs.google.com/spreadsheets/d/[THIS-IS-YOUR-ID]/edit`
   - Copy the ID

### Step 2: Go to Google Apps Script
1. Open https://script.google.com
2. Click **+ New project**
3. Name it "Keep Export Processor"

### Step 3: Copy the Script
1. In the editor, replace everything with the contents of `google-apps-script.js`
2. **Update line 15-16 with your Sheet ID:**
   ```javascript
   const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // ← PASTE YOUR ID HERE
   ```
3. Click **Save** (Ctrl+S)

### Step 4: Run Setup
1. In the editor, select function `setupFolders` (dropdown at top)
2. Click **▶ Run**
3. Approve permissions when prompted
4. Check the logs (View > Execution log) - should see "✅ Setup complete!"

This creates:
- `Keep-Exports-Processing` folder
- `Keep-Images` folder
- `Keep-Exports-Done` folder
- Headers in your sheet

### Step 5: Add the Daily Trigger
1. In the editor, click **⏰ Triggers** (left sidebar)
2. Click **+ Create trigger**
3. Configure:
   - **Function**: `dailySync`
   - **Deployment**: Head
   - **Event type**: Time-driven
   - **Type of time interval**: Day timer
   - **Time of day**: 5:30 AM
4. Click **Save**

Done! ✅

---

## 📱 How to Use

### Export from Keep (on your phone)
1. Open Google Keep
2. Select one or more notes
3. Click ⋮ (menu) → **Send to Google Docs** or export as HTML
4. Save to the `Keep-Exports-Processing` folder in Drive

### Or Use Google Takeout
1. Go to https://takeout.google.com
2. Select **Keep**
3. Download (comes as HTML zip)
4. Extract and move to `Keep-Exports-Processing` folder

### Script Automatically:
- Processes the file
- Extracts text, lists, images
- Saves images to `Keep-Images`
- Adds row to your sheet
- Moves file to `Keep-Exports-Done`

---

## 📊 What Goes into Your Sheet

| Column | What | Example |
|--------|------|---------|
| Date | When note was created | 6/29/2026 |
| Note Type | text / list / text-with-images | text-with-images |
| Note Text | The actual note content | "Podcast idea: coffee shop..." |
| Image Links | Links to saved images | https://drive.google.com/... |
| Raw Data | Additional metadata | (reserved) |

---

## 🧪 Test It

### Manual Test
1. Create a test Keep note with:
   - Some text
   - A list (bullets/checkboxes)
   - An image (optional)
2. Export it to `Keep-Exports-Processing`
3. In Apps Script, click **▶ Run** on `processKeepExports`
4. Check your Sheet - should have a new row!

### Check Logs
- View > Execution log shows what happened
- Look for ✅ and ❌ messages

---

## 🔄 Automatic Daily Run

Once the trigger is set, it runs automatically at **5:30 AM every day**:
- Checks `Keep-Exports-Processing` for new files
- Processes them
- Archives them to `Keep-Exports-Done`

---

## 🎯 Workflow

```
5:30 AM Daily
    ↓
Apps Script checks Keep-Exports-Processing
    ↓
Found new export?
    ├─ Yes → Process it
    │   ├─ Extract text/lists
    │   ├─ Save images to folder
    │   └─ Add row to sheet
    │   └─ Move file to Done folder
    └─ No → Wait until next day
```

---

## ⚙️ Customize

### Change Sync Time
In Triggers, edit the time-of-day to anything you want.

### Change Folder Names
Edit lines 11-16 in the script:
```javascript
const FOLDERS = {
  EXPORT_INPUT: 'Your-Custom-Folder-Name',
  // etc.
};
```

### Change Sheet Name
Edit line 8:
```javascript
const SHEET_NAME = 'Your Custom Sheet Name';
```

---

## 🐛 Troubleshooting

### "Sheet not found"
- Make sure `SHEET_ID` is correct
- Make sure sheet name matches `SHEET_NAME` variable

### "Folder not found"
- Run `setupFolders()` again
- Or manually create the folders:
  - `Keep-Exports-Processing`
  - `Keep-Images`
  - `Keep-Exports-Done`

### "Permission denied"
- Click **Run** again and approve the permissions
- Apps Script needs access to Drive and Sheets

### "No new exports"
- Make sure your Keep export files are in `Keep-Exports-Processing`
- Check they're HTML files (not PDF or other format)
- Export format from Keep should be supported

### See what's happening
- Run `processKeepExports()` manually
- Check View > Execution log for details
- Look for ✅ and ❌ messages

---

## 🔒 Privacy & Security

- This script runs **only in your Google account**
- No data leaves Google
- Files are stored in **your Drive**
- Trigger runs **only for you**

---

## 📞 Next Steps

1. **Test manually** with a Keep export
2. **Set up the trigger** for 5:30 AM
3. **Export from Keep regularly** (daily, weekly, whatever schedule you want)
4. **Check your Sheet** to see notes accumulate

That's it! Keep → Drive Folder → Google Sheet, automatically. ✨

---

## Need Help?

- Check the script comments (lines starting with `//`)
- Read the execution log for error messages
- Logs show exactly what happened: `✅ Added note`, `❌ Error`, etc.
