import { DbCampaign } from '../../types/database.js';
import { Campaign } from '../../types/index.js';

export function transformDbCampaignToFrontend(dbCampaign: any): Campaign {
  const prospectsCount = dbCampaign.actual_prospects || 0;
  const repliesCount = dbCampaign.actual_replies || 0;
  const sentCount = dbCampaign.actual_sent || 0;
  
  const rate = prospectsCount > 0 
    ? Math.round((repliesCount / prospectsCount) * 100) 
    : 0;

  return {
    id: dbCampaign.id,
    name: dbCampaign.name,
    status: (dbCampaign.status || 'Draft') as any,
    niche: dbCampaign.niche,
    schedule: dbCampaign.schedule,
    prospects: String(prospectsCount),
    replies: String(repliesCount),
    sent: String(sentCount),
    openRate: `${dbCampaign.open_rate || 0}%`,
    replyRate: `${rate}%`,
    company_name: dbCampaign.company_name,
    contact_number: dbCampaign.contact_number,
    primary_email: dbCampaign.primary_email,
    pitch: dbCampaign.pitch,
    objective: dbCampaign.objective || dbCampaign.pitch || 'Awaiting detailed instructions from the Boss...',
    business_id: dbCampaign.business_id,
    target_id: dbCampaign.target_id,
    current_step: dbCampaign.current_step
  };
}

export function transformFrontendCampaignToDb(campaign: Partial<Campaign>): Partial<DbCampaign> {
  const { replyRate, prospects, replies, objective, ...rest } = campaign;
  
  return {
    ...rest,
    open_rate: 0, // open_rate no longer updated from frontend
    prospects: prospects ? parseInt(prospects, 10) : 0,
    replies: replies ? parseInt(replies, 10) : 0,
    company_name: campaign.company_name,
    contact_number: campaign.contact_number,
    primary_email: campaign.primary_email,
    pitch: campaign.pitch,
    objective: objective
  };
}
