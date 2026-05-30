import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from 'components/ui/dialog';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';

interface EditScheduleModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule: any;
    onSave: (updates: {
        endDate: string;
        totalEmails: number;
        intervalMinutes: number;
        emailsPerAccount: number;
    }) => Promise<void>;
}

export const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
    open,
    onOpenChange,
    schedule,
    onSave,
}) => {
    const [endDate, setEndDate] = useState('');
    const [totalEmails, setTotalEmails] = useState<number | ''>('');
    const [intervalMinutes, setIntervalMinutes] = useState<number | ''>('');
    const [emailsPerAccount, setEmailsPerAccount] = useState<number | ''>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open && schedule) {
            setEndDate(schedule.endDate ? schedule.endDate.split('T')[0] : '');
            setTotalEmails(schedule.totalEmails || '');
            setIntervalMinutes(schedule.interval || '');
            setEmailsPerAccount(schedule.emailsPerAccount || '');
        }
    }, [open, schedule]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await onSave({
                endDate,
                totalEmails: Number(totalEmails),
                intervalMinutes: Number(intervalMinutes),
                emailsPerAccount: Number(emailsPerAccount),
            });
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Schedule Sequence</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>End Date</Label>
                        <div className="relative">
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={schedule?.startDate ? schedule.startDate.split('T')[0] : new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Daily Volume (Emails/Day)</Label>
                            <Input
                                type="number"
                                value={totalEmails}
                                onChange={(e) => setTotalEmails(e.target.value ? Number(e.target.value) : '')}
                                min={1}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Interval (minutes)</Label>
                            <Input
                                type="number"
                                value={intervalMinutes}
                                onChange={(e) => setIntervalMinutes(e.target.value ? Number(e.target.value) : '')}
                                min={15}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Emails Per Account</Label>
                        <Input
                            type="number"
                            value={emailsPerAccount}
                            onChange={(e) => setEmailsPerAccount(e.target.value ? Number(e.target.value) : '')}
                            min={1}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
