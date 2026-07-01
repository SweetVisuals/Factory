import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useApp } from '../context/AppContext';
import Layout from '../components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormData {
  name: string;
  niche: string;
  objective: string;
  maxEmailsPerDay: string;
  frequency: 'daily' | 'weekly';
}

const CreateCampaign = () => {
  const navigate = useNavigate();
  const { addCampaign } = useApp();
  const { register, handleSubmit, setValue } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await addCampaign({
        name: data.name,
        status: 'Draft',
        prospects: '0',
        replies: '0',
        replyRate: '0%',
        niche: data.niche,
        objective: data.objective,
        schedule: {
          frequency: data.frequency,
          maxEmailsPerDay: parseInt(data.maxEmailsPerDay),
        },
      });
      navigate('/campaigns');
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto text-foreground animate-in fade-in duration-200">
        
        {/* Dynamic Header Section */}
        <div className="p-8 pb-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
                <h1 className="text-4xl font-black text-white tracking-tighter">Create Campaign</h1>
              </div>
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] ml-5">
                Launch a new cold email outreach sequence
              </p>
            </div>
            
            <button
              onClick={() => navigate('/campaigns')}
              className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/5 hover:bg-white/5 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-all"
            >
              ← Back to Campaigns
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
          <Card className="border-border shadow-2xl bg-card overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/30 p-8">
              <CardTitle className="text-2xl font-bold text-foreground">Campaign Details</CardTitle>
              <p className="text-muted-foreground mt-1">Configure your new outreach campaign settings below.</p>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-foreground font-semibold">Campaign Name</Label>
                  <Input
                    id="name"
                    {...register('name', { required: true })}
                    placeholder="e.g. Q1 SaaS Outreach"
                    className="bg-background/50 border-border focus:border-primary/50 h-12 px-4 rounded-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="niche" className="text-foreground font-semibold">Niche</Label>
                  <Input
                    id="niche"
                    {...register('niche', { required: true })}
                    placeholder="e.g. SaaS, E-commerce, Real Estate"
                    className="bg-background/50 border-border focus:border-primary/50 h-12 px-4 rounded-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="objective" className="text-foreground font-semibold">Boss Objective</Label>
                  <textarea
                    id="objective"
                    {...register('objective', { required: true })}
                    placeholder="e.g. Find 500 SaaS founders and pitch our new automation tool..."
                    className="w-full bg-background/50 border-none border-border focus:border-primary/50 min-h-[120px] p-4 rounded-none transition-all resize-none text-foreground outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">This is what your autonomous agents will use as their primary instruction.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="maxEmailsPerDay" className="text-foreground font-semibold">Emails Per Day</Label>
                    <Input
                      id="maxEmailsPerDay"
                      type="number"
                      {...register('maxEmailsPerDay', { required: true })}
                      defaultValue="100"
                      min="1"
                      max="1000"
                      className="bg-background/50 border-border focus:border-primary/50 h-12 px-4 rounded-none transition-all"
                    />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Max limit: 1000/day</p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="frequency" className="text-foreground font-semibold">Frequency</Label>
                    <Select defaultValue="daily" onValueChange={(value) => setValue('frequency', value as 'daily' | 'weekly')}>
                      <SelectTrigger className="bg-[#0a0a0a] border border-white/10 focus:border-white/30 h-12 px-4 rounded-xl transition-all text-white">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#000000] border border-white/10 rounded-xl text-white">
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-border">
                  <button
                    onClick={() => navigate('/campaigns')}
                    type="button"
                    className="px-6 py-2.5 rounded-none border-none border-border text-foreground hover:bg-muted font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-primary text-primary-foreground rounded-none hover:bg-primary/90 font-bold transition-all shadow-lg shadow-primary/30"
                  >
                    Create Campaign
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default CreateCampaign;
