/**
 * Healy HQ Keep Export → Google Sheets Processor
 *
 * This Google Apps Script:
 * 1. Monitors a Drive folder for Keep exports
 * 2. Extracts text, lists, images from the export
 * 3. Saves images to Drive folder
 * 4. Pushes metadata to Google Sheets
 * 5. Tracks sync state (no duplicates)
 * 6. Runs daily at 5:30 AM
 *
 * SETUP:
 * 1. Go to https://script.google.com/
 * 2. Create new project
 * 3. Paste this entire file
 * 4. Set your configuration below
 * 5. Run setupFolders() once
 * 6. Add time-based trigger: 5:30 AM daily
 */

// ============================================================================
// CONFIGURATION - CHANGE THESE
// ============================================================================

// Your Google Sheet ID (from the URL: docs.google.com/spreadsheets/d/[THIS])
const SHEET_ID = 'YOUR_SHEET_ID_HERE';

// Sheet name where notes will be added
const SHEET_NAME = 'Keep Notes';

// Folder names in Google Drive
const FOLDERS = {
  EXPORT_INPUT: 'Keep-Exports-Processing',      // Where you export Keep files
  IMAGES_OUTPUT: 'Keep-Images',                  // Where images get saved
  EXPORT_ARCHIVE: 'Keep-Exports-Done',           // Where processed files go
};

// Last sync date (stored in script properties)
const SYNC_STATE_PROPERTY = 'lastSyncDate';

// ============================================================================
// MAIN FUNCTION - Run this to process exports
// ============================================================================

function processKeepExports() {
  Logger.log('🚀 Starting Keep Export Processing...');

  try {
    // Get the input folder
    const inputFolder = getFolderByName(FOLDERS.EXPORT_INPUT);
    if (!inputFolder) {
      Logger.log('❌ Input folder not found. Run setupFolders() first.');
      return;
    }

    // Get all files in the input folder
    const files = inputFolder.getFilesByType(MimeType.HTML);
    const fileList = [];

    while (files.hasNext()) {
      fileList.push(files.next());
    }

    if (fileList.length === 0) {
      Logger.log('✨ No new exports to process.');
      return;
    }

    Logger.log(`📄 Found ${fileList.length} export(s) to process`);

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const imagesFolder = getFolderByName(FOLDERS.IMAGES_OUTPUT);
    const archiveFolder = getFolderByName(FOLDERS.EXPORT_ARCHIVE);

    // Process each file
    for (const file of fileList) {
      try {
        Logger.log(`\n Processing: ${file.getName()}`);

        // Parse the Keep export
        const content = file.getBlob().getDataAsString();
        const notes = parseKeepExport(content);

        Logger.log(`  Found ${notes.length} note(s) in export`);

        // Add each note to the sheet
        for (const note of notes) {
          // Handle images
          if (note.images && note.images.length > 0) {
            note.imageLinks = saveNoteImages(note.images, imagesFolder);
          }

          // Add row to sheet
          addNoteToSheet(sheet, note);
          Logger.log(`  ✅ Added: "${note.text.substring(0, 30)}..."`);
        }

        // Archive the processed file
        archiveFolder.addFile(file);
        inputFolder.removeFile(file);
        Logger.log(`  📦 Archived export file`);

      } catch (error) {
        Logger.log(`  ❌ Error processing ${file.getName()}: ${error}`);
      }
    }

    // Update last sync time
    PropertiesService.getScriptProperties().setProperty(
      SYNC_STATE_PROPERTY,
      new Date().toISOString()
    );

    Logger.log('\n✅ Processing complete!');

  } catch (error) {
    Logger.log(`❌ Error: ${error}`);
  }
}

// ============================================================================
// SETUP FUNCTION - Run once to create folder structure
// ============================================================================

function setupFolders() {
  Logger.log('Setting up folder structure...');

  const root = DriveApp.getRootFolder();

  for (const [key, folderName] of Object.entries(FOLDERS)) {
    const existing = getFolderByName(folderName);
    if (!existing) {
      root.createFolder(folderName);
      Logger.log(`✅ Created folder: ${folderName}`);
    } else {
      Logger.log(`✓ Folder exists: ${folderName}`);
    }
  }

  // Create the sheet if it doesn't exist
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    Logger.log(`✅ Created sheet: ${SHEET_NAME}`);

    // Add headers
    const headers = ['Date', 'Note Type', 'Note Text', 'Image Links', 'Raw Data'];
    sheet.appendRow(headers);
    Logger.log('✅ Added headers');
  }

  Logger.log('✅ Setup complete!');
}

// ============================================================================
// PARSING FUNCTION - Extract content from Keep HTML export
// ============================================================================

function parseKeepExport(htmlContent) {
  const notes = [];

  // Keep exports are typically HTML with divs for each note
  // This is a basic parser - adjust if Keep's export format changes

  const noteRegex = /<div[^>]*class="[^"]*note[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const noteMatches = htmlContent.match(noteRegex);

  if (!noteMatches) {
    return notes;
  }

  for (const noteHtml of noteMatches) {
    const note = {
      text: '',
      images: [],
      type: 'text',
      timestamp: new Date().toISOString(),
    };

    // Extract text
    const textRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const textMatches = noteHtml.match(textRegex);
    if (textMatches) {
      note.text = textMatches.map(t =>
        t.replace(/<[^>]*>/g, '').trim()
      ).join('\n');
    }

    // Extract images (as base64 or data URLs)
    const imgRegex = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    const imgMatches = noteHtml.match(imgRegex);
    if (imgMatches && imgMatches.length > 0) {
      note.images = imgMatches;
      note.type = 'text-with-images';
    }

    // Detect lists
    if (noteHtml.includes('<li') || noteHtml.includes('□')) {
      note.type = 'list';
    }

    // Only add non-empty notes
    if (note.text.trim().length > 0) {
      notes.push(note);
    }
  }

  return notes;
}

// ============================================================================
// SHEET MANAGEMENT - Add note to the spreadsheet
// ============================================================================

function addNoteToSheet(sheet, note) {
  const row = [
    new Date(note.timestamp).toLocaleDateString(),  // Date
    note.type,                                       // Type (text, list, image)
    note.text.substring(0, 500),                     // Note text (truncated)
    note.imageLinks ? note.imageLinks.join('\n') : '', // Image links
    note.imageLinks ? '' : '',                       // Raw data
  ];

  sheet.appendRow(row);

  // Auto-resize columns
  sheet.autoResizeColumns(1, 5);
}

// ============================================================================
// IMAGE HANDLING - Save images from notes
// ============================================================================

function saveNoteImages(imageElements, folder) {
  const links = [];

  for (const img of imageElements) {
    try {
      // If image is base64, decode and save
      const base64Match = img.match(/src="data:image\/([^;]*);base64,([^"]*)/);
      if (base64Match) {
        const mimeType = 'image/' + base64Match[1];
        const base64Data = base64Match[2];

        const blob = Utilities.newBlob(
          Utilities.base64Decode(base64Data),
          mimeType,
          `keep-image-${Date.now()}.${base64Match[1]}`
        );

        const file = folder.createFile(blob);
        links.push(file.getUrl());
      }
    } catch (error) {
      Logger.log(`Warning: Could not save image: ${error}`);
    }
  }

  return links;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFolderByName(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return null;
}

function getLastSyncDate() {
  const props = PropertiesService.getScriptProperties();
  const lastSync = props.getProperty(SYNC_STATE_PROPERTY);
  return lastSync ? new Date(lastSync) : null;
}

// ============================================================================
// SCHEDULED TRIGGER - Set this to run at 5:30 AM
// ============================================================================

// Google Apps Script will call this automatically if you set up a trigger
function dailySync() {
  processKeepExports();
}

// ============================================================================
// MENU FUNCTION - Add buttons to Google Sheet UI (optional)
// ============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Keep Sync')
    .addItem('Process Exports Now', 'processKeepExports')
    .addItem('Setup Folders', 'setupFolders')
    .addDivider()
    .addItem('View Script Logs', 'showLogs')
    .addToUi();
}

function showLogs() {
  Logger.log('Check the execution logs at: Apps Script Editor > View > Execution log');
}
