import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupBucket() {
  console.log('Creating signatures bucket...');
  const { data, error } = await supabase.storage.createBucket('signatures', {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']
  });

  if (error) {
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      console.log('Bucket already exists.');
    } else {
      console.error('Error creating bucket:', error);
      return;
    }
  } else {
    console.log('Bucket created successfully:', data);
  }

  console.log('Updating bucket to be public (in case it already existed)...');
  await supabase.storage.updateBucket('signatures', {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']
  });

  console.log('Bucket setup complete.');
}

setupBucket();
