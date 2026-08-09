import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://db.relaysolutions.net', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q');

async function test() {
    const { count, error } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    console.log('Total Leads:', count, error);

    const { count: nullCount, error: nullError } = await supabase.from('leads').select('*', { count: 'exact', head: true }).is('review_count', null);
    console.log('Leads with review_count is null:', nullCount, nullError);
    
    const { count: emptyReviews, error: emptyError } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('bad_reviews', '[]');
    console.log('Leads with empty bad_reviews array:', emptyReviews, emptyError);
    
    // fetch one lead to inspect schema
    const { data } = await supabase.from('leads').select('*').limit(1);
    console.log('Sample keys:', data ? Object.keys(data[0]) : null);
}

test();
