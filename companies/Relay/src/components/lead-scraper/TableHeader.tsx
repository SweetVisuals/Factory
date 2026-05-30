import React from 'react';
import { CustomCheckbox } from '../ui/CustomCheckbox';

interface Props {
  onSelectAll: () => void;
  allSelected: boolean;
  totalLeads: number;
  hidePersonalColumns?: boolean;
  showActions?: boolean;
}

export const TableHeader: React.FC<Props> = ({ onSelectAll, allSelected, totalLeads, hidePersonalColumns, showActions }) => (
  <thead className="bg-foreground/[0.01] border-none">
    <tr>
      <th className="px-6 py-6 text-left w-12">
        <CustomCheckbox
          checked={allSelected}
          onChange={onSelectAll}
        />
      </th>
      <th className="px-6 py-6 text-left">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Contact Information</span>
      </th>
      {!hidePersonalColumns && (
        <th className="px-6 py-6 text-left">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Full Name</span>
        </th>
      )}
      <th className="px-6 py-6 text-left">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Organization</span>
      </th>
      <th className="px-6 py-6 text-left">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Context</span>
      </th>
      <th className="px-6 py-6 text-left">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Location</span>
      </th>
      <th className="px-6 py-6 text-left">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Platform</span>
      </th>
      <th className="px-6 py-6 text-left">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Channels</span>
      </th>
      {showActions && (
        <th className="px-6 py-6 text-right">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Manage</span>
        </th>
      )}
    </tr>
  </thead>
);

