# Healy HQ Google Keep → Notion Sync

Automatically sync your Google Keep voice dumps to your Notion **Idea Inbox**.

Every voice-to-text note you capture goes straight into Healy HQ's 💡 **Idea Inbox**, where you process it in the 🎯 **Now** room each morning.

---

## 🚀 Quick Start (5 minutes)

### 1. Install Node.js
If you don't have it, download from https://nodejs.org/ (LTS version)

Verify:
```bash
node --version
npm --version
```

### 2. Clone credentials and set up `.env`
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your editor
```

### 3. Get your Google credentials
You'll need a **Google App Password** (not your main password):

1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already enabled
3. Go back to Security → App passwords
4. Select "Mail" and "Windows Computer" (or your device)
5. Copy the generated password → paste in `.env` as `GOOGLE_PASSWORD`

### 4. Get your Notion credentials

**Notion API Key:**
1. Go to https://www.notion.com/my-integrations
2. Click "+ New integration"
3. Name it "Healy HQ Sync"
4. Copy the "Internal Integration Token" → paste in `.env` as `NOTION_API_KEY`

**Database ID:**
1. Open your Healy HQ in Notion
2. Go to 💡 **Idea Inbox** database
3. Copy the URL: `https://notion.so/your-username/[DATABASE-ID]?v=xxx`
4. The long alphanumeric part is your Database ID → paste in `.env`

**Connect Notion to the integration:**
1. Go back to your Idea Inbox database
2. Click ⋮ (three dots) → "+ Add connections"
3. Search for "Healy HQ Sync" and connect it

### 5. Install dependencies
```bash
npm install
```

### 6. Run the sync
```bash
npm start
```

You should see:
```
---
ℹ️  Starting Healy HQ Keep → Notion Sync
✅ Connected to Google Keep
✅ Found 15 total notes in Google Keep
ℹ️  12 new notes to sync
✅ Synced: "Voice note about AI training..."
✅ Synced: "Podcast idea - coffee shop sounds..."
✅ Sync complete! 12 synced, 0 failed
---
```

---

## 📚 How It Works (Code Walkthrough)

### Three Main Pieces:

#### 1. **Google Keep Connection** (`connectToGoogleKeep()`)
```javascript
const keep = new gkeepapi.Keep();
await keep.login(EMAIL, PASSWORD);
const notes = await keep.getAllNotes();
```
- Uses `gkeepapi` library to log into your Keep account
- Fetches all your notes
- Returns them as a list

#### 2. **Sync State** (Avoid Duplicates)
```javascript
const syncState = new SyncState('.sync-state.json');
if (syncState.isSynced(note.id)) {
  // Skip this note - already synced
}
syncState.markSynced(note.id);
```
- Keeps a `.sync-state.json` file that tracks which notes you've already sent
- On first run, all notes get synced
- On second run, only NEW notes get synced
- **This prevents duplicates!**

#### 3. **Push to Notion** (`createNotionPage()`)
```javascript
const payload = {
  parent: { database_id: DATABASE_ID },
  properties: {
    'Idea': { title: [{ text: { content: note.text } }] },
    'Status': { select: { name: 'New' } },
    'Category': { multi_select: [{ name: 'Captured' }] },
  },
};
await axios.post('https://api.notion.com/v1/pages', payload, headers);
```
- Calls Notion's API
- Creates a new page in your Idea Inbox
- Sets properties: Status = "New", Category = "Captured"
- Adds the full note text as page content
- Includes metadata (timestamp, "From Google Keep")

### The Flow:
```
Google Keep Note
    ↓
Is it already synced? (check .sync-state.json)
    ↓ No
Create page in Notion Idea Inbox
    ↓
Mark as synced in .sync-state.json
    ↓
Done!
```

---

## 🛠️ Customization

### Change the Notion properties
In `sync.js`, find `createNotionPage()` and modify the `properties`:

```javascript
properties: {
  'Idea': { /* Title */ },
  'Status': { select: { name: 'New' } },     // ← Change this
  'Category': { multi_select: [{ name: 'Captured' }] },  // ← Or this
  'Excitement': { select: { name: 'Medium' } },  // ← Or add new ones
},
```

### Add filters (e.g., "only sync notes with #task")
Modify the `newNotes` filtering:
```javascript
const newNotes = notes.filter(note => 
  !syncState.isSynced(note.id) && 
  note.text.includes('#task')  // ← Only sync notes with #task
);
```

### Run on a schedule (automatic)
See "Automation" section below.

---

## 🔄 Run Automatically

### Option A: Cron (Linux/Mac)
```bash
# Edit your crontab
crontab -e

# Add this line to run sync every hour
0 * * * * cd /home/user/learningsql-2875059/healy-hq-sync && npm start >> sync.log 2>&1

# Every 30 minutes:
*/30 * * * * cd /home/user/learningsql-2875059/healy-hq-sync && npm start >> sync.log 2>&1
```

### Option B: Windows Task Scheduler
1. Open "Task Scheduler"
2. Create Basic Task
3. Name: "Healy HQ Keep Sync"
4. Trigger: Every 1 hour
5. Action: Start a program
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `C:\path\to\sync.js`

### Option C: Cloud (Firebase, AWS Lambda, Vercel)
Deploy this to run serverless (no computer needs to be on):
```bash
# Firebase Cloud Function example
firebase init functions
# Copy sync.js logic into functions/index.js
firebase deploy
```

### Option D: GitHub Actions (Free!)
Create `.github/workflows/keep-sync.yml`:
```yaml
name: Healy HQ Keep Sync

on:
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm start
        env:
          GOOGLE_EMAIL: ${{ secrets.GOOGLE_EMAIL }}
          GOOGLE_PASSWORD: ${{ secrets.GOOGLE_PASSWORD }}
          NOTION_API_KEY: ${{ secrets.NOTION_API_KEY }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
```

---

## 🐛 Troubleshooting

### "Missing required environment variables"
- Make sure you copied `.env.example` → `.env`
- Make sure `.env` is in the same folder as `sync.js`
- Make sure all 4 variables are filled in

### "Failed to connect to Google Keep"
- Check your `GOOGLE_EMAIL` is correct
- If you use 2FA, use an **App Password**, not your main password
- If still failing, try logging into Keep manually first: https://keep.google.com/

### "Notion API Error: Invalid database_id"
- Make sure you got the Database ID from the URL correctly
- Try the full database URL: `https://notion.so/user/[DATABASE-ID]?v=xxx`
- Make sure the integration is connected to the database (✓ "Add connections")

### "Rate limited by Notion"
- Normal! The script handles this and waits 1 second
- If it keeps happening, increase the delay in line ~207:
```javascript
await new Promise(resolve => setTimeout(resolve, 1000)); // ← increase this
```

### See detailed logs
```bash
npm run dev
# Or:
node sync.js --verbose
```

---

## 📝 Next Steps

1. **Run it manually** once to test: `npm start`
2. **Schedule it** to run automatically (see "Run Automatically" section)
3. **Customize** the Notion properties to match your style
4. **Optional**: Deploy to cloud so it runs 24/7 without your computer being on

---

## 📖 Learning Resources

- **gkeepapi**: https://github.com/kiwix/gkeepapi
- **Notion API**: https://developers.notion.com/
- **Node.js**: https://nodejs.org/en/docs/

---

## ⚠️ Security Notes

- **Never commit `.env`** to git! It's in `.gitignore`
- **App Passwords**: Use Google App Passwords instead of your main password
- **Notion Token**: Keep it secret! Don't share it publicly
- **Local storage**: `.sync-state.json` contains note IDs (safe to commit if you want)

---

**Questions?** Open an issue or check the code comments in `sync.js` — every function is explained!
