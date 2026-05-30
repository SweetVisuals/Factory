import { Save, Trash, Sparkles, RotateCcw, Loader2, Edit3, Target, Activity } from 'lucide-react';
import { EmailTemplate } from '../../../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TemplateEditorProps {
  template: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
  onSave: () => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  isRegenerating?: boolean;
}

const TemplateEditor = ({
  template,
  onChange,
  onSave,
  onDelete,
  onRegenerate,
  onUndo,
  canUndo,
  isRegenerating
}: TemplateEditorProps) => {
  return (
    <div className="flex-1 p-8 bg-transparent text-foreground space-y-10">
      <div className="flex justify-between items-start">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted/40 rounded-xl">
              <Edit3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground">Sequence Module</h3>
              <p className="text-sm font-medium text-muted-foreground mt-1">Configure propagation logic</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-muted/20 p-1.5 rounded-xl w-fit">
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center px-4 py-2.5 text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-all disabled:opacity-50 shadow-sm"
              title="Recalibrate with AI"
            >
              {isRegenerating ? <Activity size={16} className="mr-2 animate-spin" /> : <Sparkles size={16} className="mr-2" />}
              Recalibrate
            </button>
            <button
              onClick={onUndo}
              disabled={!canUndo || isRegenerating}
              className="flex items-center px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all disabled:opacity-30"
              title="Revert Change"
            >
              <RotateCcw size={16} className="mr-2" />
              Revert
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onDelete}
            className="flex items-center px-6 py-3 text-sm font-bold text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all group"
          >
            <Trash size={18} className="mr-2 opacity-70 group-hover:opacity-100" />
            Purge
          </button>
          <button
            onClick={onSave}
            className="flex items-center px-8 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
          >
            <Save size={18} className="mr-2" />
            Lock Module
          </button>
        </div>
      </div>

      <div className="space-y-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Module Designation</Label>
            <div className="relative group">
              <Edit3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={template.name}
                onChange={(e) => onChange({ ...template, name: e.target.value })}
                placeholder="e.g. Initial Outreach"
                className="bg-card border-border focus:ring-2 focus:ring-primary/20 h-14 rounded-xl pl-12 font-bold text-base transition-all placeholder:text-muted-foreground shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Transmission Subject</Label>
            <div className="relative group">
              <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={template.subject}
                onChange={(e) => onChange({ ...template, subject: e.target.value })}
                placeholder="Enter transmission subject"
                className="bg-card border-border focus:ring-2 focus:ring-primary/20 h-14 rounded-xl pl-12 font-bold text-base transition-all placeholder:text-muted-foreground shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Propagation Payload</Label>
          <div className="relative">
            <div className="absolute top-4 right-4 flex gap-2">
              <span className="px-3 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground">Markdown Supported</span>
            </div>
            <Textarea
              value={template.content}
              onChange={(e) => onChange({ ...template, content: e.target.value })}
              rows={16}
              placeholder="Write your email content here. Use {{company}} for prospects, [[relevant_observation]] for AI personalization, or <company>, <contactnumber>, <primaryemail> for your details."
              className="bg-card border-border focus:ring-2 focus:ring-primary/20 font-mono text-sm leading-relaxed resize-none p-8 rounded-2xl transition-all custom-scrollbar shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
