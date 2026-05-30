const fs = require('fs');
const filePath = 'c:\\Users\\Shadow\\Desktop\\Openclaw Factory\\companies\\Relay\\supabase\\functions\\process-campaign\\index.ts';

let content = fs.readFileSync(filePath, 'utf-8');

// Change status: 'skipped_duplicate' to status: 'failed' to avoid check constraint errors
// since we couldn't update the DB schema.
const oldStatus = "status: 'skipped_duplicate'";
const newStatus = "status: 'failed' /* skipped_duplicate */";

if (content.includes(oldStatus)) {
  content = content.replace(new RegExp(oldStatus, 'g'), newStatus);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('✅ Safely updated status from skipped_duplicate to failed (with comment)');
} else {
  console.log('⚠️ skipped_duplicate status not found (maybe already changed or not applied)');
}
