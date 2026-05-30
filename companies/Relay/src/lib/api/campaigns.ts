import { supabase } from '../supabase';
import { Campaign } from '../../types';
import { transformDbCampaignToFrontend, transformFrontendCampaignToDb } from '../utils/transformers';
import { toast } from '../../components/ui/use-toast';

export async function createCampaign(campaign: Omit<Campaign, 'id'>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const dbCampaign = {
      ...transformFrontendCampaignToDb(campaign),
      user_id: user.id
    };
    
    const { data, error } = await supabase
      .from('campaigns')
      .insert(dbCampaign)
      .select()
      .single();

    if (error) throw error;
    return transformDbCampaignToFrontend(data);
  } catch (error) {
    console.error('Error creating campaign:', error);
    toast({
      title: "Error",
      description: "Failed to create campaign. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
}

export async function fetchCampaigns() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      toast({
        title: "Error",
        description: "Please sign in to view campaigns",
        variant: "destructive"
      });
      return [];
    }

    // Explicitly verify user_id matches authenticated user
    const { data: statsData, error } = await supabase
      .from('campaign_stats')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: campaignsData } = await supabase
      .from('campaigns')
      .select('id, current_step')
      .eq('user_id', user.id);

    const data = statsData.map(stat => {
      const camp = campaignsData?.find(c => c.id === stat.id);
      return {
        ...stat,
        current_step: camp?.current_step || 1
      };
    });

    return data.map(transformDbCampaignToFrontend);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    toast({
      title: "Error",
      description: "Failed to load campaigns. Please check your connection and try again.",
      variant: "destructive"
    });
    return [];
  }
}

export async function updateCampaign(id: string, updates: Partial<Campaign>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const dbUpdates = transformFrontendCampaignToDb(updates);

    const { data, error } = await supabase
      .from('campaigns')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return transformDbCampaignToFrontend(data);
  } catch (error) {
    console.error('Error updating campaign:', error);
    toast({
      title: "Error",
      description: "Failed to update campaign. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
}

export async function deleteCampaign(id: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First, handle foreign key constraints by nullifying references in inbox_emails
    // We nullify instead of delete to preserve the email history
    await supabase
      .from('inbox_emails')
      .update({ campaign_id: null })
      .eq('campaign_id', id);

    // Also handle campaign_emails if not already cascaded
    await supabase
      .from('campaign_emails')
      .delete()
      .eq('campaign_id', id);

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting campaign:', error);
    toast({
      title: "Error",
      description: "Failed to delete campaign. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
}
