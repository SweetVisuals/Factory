import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lvqmlvbclglalcnfowwc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cW1sdmJjbGdsYWxjbmZvd3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTMxNTMsImV4cCI6MjA5OTU4OTE1M30.PHOdd5mlqBN3RAdz2w0ye64fBgDXAa7e8kto28pzIuU'
);

async function checkLeads() {
  try {
    // Get total count
    const { count: total } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });
    
    // Get validation status breakdown
    const { data: statusData } = await supabase
      .from('leads')
      .select('validation_status, status');
    
    // Count by validation_status
    const validationCounts = {};
    const statusCounts = {};
    
    statusData?.forEach(lead => {
      validationCounts[lead.validation_status] = (validationCounts[lead.validation_status] || 0) + 1;
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
    });
    
    console.log('=== LEADS DATABASE ANALYSIS ===\n');
    console.log('Total leads:', total);
    console.log('\nValidation Status Breakdown:');
    Object.entries(validationCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    console.log('\nStatus Field Breakdown:');
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Test the actual query from Discover.tsx
    console.log('\n=== TESTING DISCOVER QUERY ===\n');
    
    // Query with default filters (statusFilter = 'all')
    let query = supabase.from('leads').select('*', { count: 'exact' });
    query = query.neq('validation_status', 'invalid');
    query = query.neq('status', 'bounced');
    
    const { data: filteredData, count: filteredCount } = await query.limit(5);
    
    console.log('Query with default filters (exclude invalid + bounced):');
    console.log('  Count:', filteredCount);
    console.log('  Sample data:', filteredData?.length || 0, 'records');
    if (filteredData && filteredData.length > 0) {
      console.log('  First record:', {
        id: filteredData[0].id,
        name: filteredData[0].name,
        email: filteredData[0].email,
        validation_status: filteredData[0].validation_status,
        status: filteredData[0].status
      });
    }
    
    // Query without filters
    const { count: unfilteredCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });
    
    console.log('\nUnfiltered count:', unfilteredCount);
    console.log('\n=== ANALYSIS ===');
    console.log('If filtered count is 0 but unfiltered count > 0, then ALL leads are either invalid or bounced');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkLeads();