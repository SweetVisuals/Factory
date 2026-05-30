import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Mail, Users, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EmailTemplate, Lead } from '@/types';
import { toast } from '@/components/ui/use-toast';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: string;
    templates: EmailTemplate[];
}

interface TestResult {
    stepName: string;
    subject: string;
    content: string;
}

export const TestOutputModal: React.FC<Props> = ({ open, onOpenChange, campaignId, templates }) => {
    const [testLead, setTestLead] = useState<Lead | null>(null);
    const [results, setResults] = useState<TestResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (open) {
            fetchTestLead();
        } else {
            setResults([]);
            setError(null);
        }
    }, [open, campaignId]);

    const fetchTestLead = async () => {
        try {
            setIsLoading(true);
            setError(null);
            // Get the first lead for this campaign to use as a test
            const { data, error } = await supabase
                .from('campaign_leads')
                .select(`
          lead:leads (
            id, email, name, company, title, industry, summary, location
          )
        `)
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            const leadData = data?.[0]?.lead;
            const parsedLead = Array.isArray(leadData) ? leadData[0] : leadData;

            if (!parsedLead) {
                setError('No leads found in this campaign. Please add a lead (e.g. from the Leads tab) to test output.');
            } else {
                setTestLead(parsedLead);
            }
        } catch (err: any) {
            console.error(err);
            setError('Failed to fetch a test lead.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestGeneration = async () => {
        if (!testLead || templates.length === 0) return;
        try {
            setIsGenerating(true);
            setError(null);

            // Pre-sort templates to ensure step order
            const sortedTemplates = [...templates].sort((a, b) => {
                const stepA = a.name.match(/Step (\d+)/i);
                const stepB = b.name.match(/Step (\d+)/i);
                if (stepA && stepB) return parseInt(stepA[1]) - parseInt(stepB[1]);
                return 0; // Maintain original list order
            });

            const newResults: TestResult[] = [];

            for (const tpl of sortedTemplates) {
                const response = await fetch('/api/generate-lead-emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                    },
                    body: JSON.stringify({
                        campaignId,
                        leads: [testLead],
                        templateContent: tpl.content,
                        templateSubject: tpl.subject,
                        company: 'Testing Company', // Mock company placeholder
                    })
                });

                if (!response.ok) throw new Error(`API error: ${response.statusText}`);

                const resData = await response.json();
                if (!resData.success) {
                    throw new Error(resData.error || 'Failed to generate emails');
                }

                const generated = resData.data[0];
                if (generated.error) throw new Error(generated.error);

                newResults.push({
                    stepName: tpl.name,
                    subject: generated.subject || tpl.subject,
                    content: generated.content || tpl.content,
                });
            }

            setResults(newResults);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error generating test emails');
            toast({ title: "Test Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-card border-border max-w-4xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <span>Test Final Email Sequence Output</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-4 space-y-6">
                    {isLoading && !testLead && (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="mt-4 text-sm text-muted-foreground">Fetching test lead...</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-destructive/10 border-none border-destructive/20 rounded-none flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                            <div className="text-sm text-destructive">{error}</div>
                        </div>
                    )}

                    {!isLoading && testLead && results.length === 0 && !error && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted/20 border-none border-border rounded-none">
                                <h3 className="font-semibold text-sm mb-2 text-foreground flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Using Test Lead:
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className="text-muted-foreground">Name:</span> {testLead.name}</div>
                                    <div><span className="text-muted-foreground">Email:</span> {testLead.email}</div>
                                    <div><span className="text-muted-foreground">Company:</span> {testLead.company || 'N/A'}</div>
                                    <div><span className="text-muted-foreground">Title:</span> {testLead.title || 'N/A'}</div>
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">Summary/Notes:</span>
                                        <p className="mt-1 text-xs bg-background/50 p-2 rounded-none border-none border-border">{testLead.summary || 'None'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center py-4">
                                <Button onClick={handleTestGeneration} disabled={isGenerating} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-none shadow-lg">
                                    {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating AI Sequence...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Realistic Test Sequence</>}
                                </Button>
                            </div>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-6">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generated Output for {testLead?.name} at {testLead?.company}</div>
                            {results.map((res, i) => (
                                <div key={i} className="bg-muted/10 border-none border-border rounded-none p-5 space-y-3 shadow-sm">
                                    <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                                        <div className="p-1.5 bg-primary/10 rounded-none"><Mail className="w-4 h-4 text-primary" /></div>
                                        <span className="font-bold text-sm text-foreground">{res.stepName}</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-muted-foreground font-semibold">Subject: </span>
                                        <span className="text-foreground">{res.subject}</span>
                                    </div>
                                    <div className="bg-background/60 p-4 rounded-none text-sm whitespace-pre-wrap font-mono leading-relaxed border-none border-border/40 text-foreground/90">
                                        {res.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-border mt-auto flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
