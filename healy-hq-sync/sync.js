/**
 * Healy HQ Google Keep → Notion Sync
 *
 * This script:
 * 1. Connects to your Google Keep account
 * 2. Fetches all notes
 * 3. Sends them to your Notion Idea Inbox
 * 4. Tracks which notes have been synced (avoids duplicates)
 *
 * Usage:
 *   node sync.js          (normal run)
 *   node sync.js --verbose (detailed output)
 */

require('dotenv').config();
const gkeepapi = require('gkeepapi');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION - Load from environment variables
// ============================================================================

const CONFIG = {
  GOOGLE_EMAIL: process.env.GOOGLE_EMAIL,
  GOOGLE_PASSWORD: process.env.GOOGLE_PASSWORD,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  SYNC_STATE_FILE: path.join(__dirname, '.sync-state.json'),
  VERBOSE: process.argv.includes('--verbose'),
};

// Validate that all required credentials are set
function validateConfig() {
  const required = ['GOOGLE_EMAIL', 'GOOGLE_PASSWORD', 'NOTION_API_KEY', 'NOTION_DATABASE_ID'];
  const missing = required.filter(key => !CONFIG[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n📋 Copy .env.example to .env and fill in your credentials');
    process.exit(1);
  }
}

// ============================================================================
// LOGGING HELPER
// ============================================================================

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  verbose: (msg) => CONFIG.VERBOSE && console.log(`📍 ${msg}`),
  divider: () => console.log('---'),
};

// ============================================================================
// SYNC STATE MANAGEMENT
// ============================================================================
// This keeps track of which notes we've already synced,
// so we don't create duplicates in Notion.

class SyncState {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      } catch (e) {
        log.error(`Could not read sync state: ${e.message}`);
        return { synced: [], lastSyncTime: null };
      }
    }
    return { synced: [], lastSyncTime: null };
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    log.verbose(`Saved sync state (${this.data.synced.length} notes tracked)`);
  }

  isSynced(noteId) {
    return this.data.synced.includes(noteId);
  }

  markSynced(noteId) {
    if (!this.isSynced(noteId)) {
      this.data.synced.push(noteId);
    }
    this.data.lastSyncTime = new Date().toISOString();
  }
}

// ============================================================================
// GOOGLE KEEP CONNECTION
// ============================================================================
// Connects to Google Keep and retrieves all notes

async function connectToGoogleKeep() {
  log.info('Connecting to Google Keep...');

  const keep = new gkeepapi.Keep();

  try {
    await keep.login(CONFIG.GOOGLE_EMAIL, CONFIG.GOOGLE_PASSWORD);
    log.success('Connected to Google Keep');
    return keep;
  } catch (error) {
    log.error(`Failed to connect to Google Keep: ${error.message}`);
    log.error('Check your GOOGLE_EMAIL and GOOGLE_PASSWORD in .env');
    process.exit(1);
  }
}

// ============================================================================
// NOTION API - CREATE PAGES
// ============================================================================
// Sends a note to Notion as a new page in the Idea Inbox database

async function createNotionPage(note) {
  const notionHeaders = {
    'Authorization': `Bearer ${CONFIG.NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  // Map the Keep note to Notion page properties
  const notionPayload = {
    parent: {
      database_id: CONFIG.NOTION_DATABASE_ID,
    },
    properties: {
      // Title property - the note's text (truncated if too long)
      'Idea': {
        title: [
          {
            text: {
              content: note.text.substring(0, 100) || '(Empty note)',
            },
          },
        ],
      },
      // Status - new notes always start as "New"
      'Status': {
        select: {
          name: 'New',
        },
      },
      // Category - "Captured" marks it as coming from Keep
      'Category': {
        multi_select: [
          { name: 'Captured' },
        ],
      },
      // Excitement - default to Medium
      'Excitement': {
        select: {
          name: 'Medium',
        },
      },
    },
    // Full note text in page content
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: note.text,
              },
            },
          ],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `\n📝 From Google Keep | ${new Date(note.timestamp).toLocaleString()}`,
              },
              annotations: {
                italic: true,
                color: 'gray',
              },
            },
          ],
        },
      },
    ],
  };

  try {
    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      notionPayload,
      { headers: notionHeaders }
    );

    log.verbose(`Created Notion page: ${response.data.id}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      log.error('Rate limited by Notion API - waiting 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Retry once
      return createNotionPage(note);
    }
    throw error;
  }
}

// ============================================================================
// MAIN SYNC LOGIC
// ============================================================================

async function runSync() {
  log.divider();
  log.info('Starting Healy HQ Keep → Notion Sync');
  log.info(`Time: ${new Date().toLocaleString()}`);
  log.divider();

  // Validate environment
  validateConfig();

  // Load sync state (to avoid duplicates)
  const syncState = new SyncState(CONFIG.SYNC_STATE_FILE);
  log.verbose(`Loaded sync state: ${syncState.data.synced.length} notes previously synced`);

  try {
    // Connect to Google Keep
    const keep = await connectToGoogleKeep();

    // Get all notes
    log.info('Fetching notes from Google Keep...');
    const notes = await keep.getAllNotes();
    log.success(`Found ${notes.length} total notes in Google Keep`);

    // Filter to only new notes (not yet synced)
    const newNotes = notes.filter(note => !syncState.isSynced(note.id));
    log.info(`${newNotes.length} new notes to sync`);

    if (newNotes.length === 0) {
      log.info('✨ Already synced! No new notes to process.');
      log.divider();
      process.exit(0);
    }

    // Process each new note
    let successCount = 0;
    let failCount = 0;

    for (const note of newNotes) {
      try {
        log.verbose(`Processing: "${note.text.substring(0, 50)}..."`);
        await createNotionPage({
          text: note.text,
          timestamp: note.timestamp,
          id: note.id,
        });

        syncState.markSynced(note.id);
        successCount++;
        log.success(`Synced: "${note.text.substring(0, 40)}..."`);
      } catch (error) {
        failCount++;
        log.error(`Failed to sync note: ${error.message}`);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save state and report
    syncState.save();

    log.divider();
    log.success(`Sync complete! ${successCount} synced, ${failCount} failed`);
    log.info(`Next sync: ${new Date(Date.now() + 3600000).toLocaleString()}`);
    log.divider();

  } catch (error) {
    log.error(`Sync failed: ${error.message}`);
    if (CONFIG.VERBOSE) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the sync
runSync();
