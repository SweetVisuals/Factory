import { Plus, Mail, ChevronRight } from 'lucide-react';
import { EmailTemplate } from '../../../types';

interface TemplateListProps {
  templates: EmailTemplate[];
  selectedTemplate: EmailTemplate | null;
  onSelect: (template: EmailTemplate) => void;
  onCreateNew: () => void;
}

const TemplateList = ({ templates, selectedTemplate, onSelect, onCreateNew }: TemplateListProps) => {
  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="p-6 flex justify-between items-center bg-muted/20 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Sequence Registry</h3>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{templates.length} Modules Active</p>
        </div>
        <button
          onClick={onCreateNew}
          className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-all shadow-sm"
          title="Initialize New Module"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-background/30">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={`w-full text-left p-4 rounded-xl transition-all group relative overflow-hidden border ${selectedTemplate?.id === template.id
              ? 'bg-primary border-primary text-primary-foreground shadow-md'
              : 'bg-card border-border hover:border-primary/30 text-muted-foreground hover:text-foreground shadow-sm'
              }`}
          >
            {selectedTemplate?.id === template.id && (
              <div className="absolute top-0 right-0 p-1 opacity-10 rotate-12">
                <Mail size={40} />
              </div>
            )}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1.5">
                <div className={`text-xs font-bold uppercase tracking-wider ${selectedTemplate?.id === template.id ? 'text-primary-foreground/90' : 'text-primary'}`}>
                  {template.name || 'Untitled Module'}
                </div>
                {selectedTemplate?.id === template.id && <ChevronRight size={14} className="text-primary-foreground/70" />}
              </div>
              <div className={`text-sm font-semibold truncate pr-4 ${selectedTemplate?.id === template.id ? 'text-primary-foreground' : 'text-foreground'}`}>{template.subject || 'No subject line set'}</div>
            </div>
          </button>
        ))}

        {templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4 border border-dashed border-border rounded-2xl">
            <div className="p-4 bg-muted/30 rounded-full">
              <Mail className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Sequence registry is currently empty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateList;
