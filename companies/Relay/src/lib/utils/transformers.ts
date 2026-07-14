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
  const dbCampaign: Partial<any> = {};

  if (campaign.id !== undefined) dbCampaign.id = campaign.id;
  if (campaign.name !== undefined) dbCampaign.name = campaign.name;
  if (campaign.status !== undefined) dbCampaign.status = campaign.status.toLowerCase();
  if (campaign.niche !== undefined) dbCampaign.niche = campaign.niche;
  if (campaign.schedule !== undefined) dbCampaign.schedule = campaign.schedule;
  if (campaign.pitch !== undefined) {
    dbCampaign.pitch = campaign.pitch;
  } else if (campaign.objective !== undefined) {
    dbCampaign.pitch = campaign.objective;
  }
  
  if (campaign.prospects !== undefined) {
    dbCampaign.prospects = parseInt(campaign.prospects, 10);
  }
  if (campaign.replies !== undefined) {
    dbCampaign.replies = parseInt(campaign.replies, 10);
  }

  return dbCampaign;
}
