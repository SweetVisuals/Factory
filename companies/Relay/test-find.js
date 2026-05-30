const campaignLeads = [{ leads: { id: "123", email: "test@example.com" } }];
const p = { lead_id: "123" };
const leadEntry = campaignLeads.find((l) => l.leads && (Array.isArray(l.leads) ? l.leads[0]?.id : l.leads.id) === p.lead_id);
console.log("leadEntry:", leadEntry);
