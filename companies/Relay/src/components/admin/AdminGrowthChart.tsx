import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const AdminGrowthChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-card border border-border rounded-2xl p-6 min-h-[300px]">
        <span className="text-muted-foreground text-sm font-bold uppercase tracking-widest">No growth data available</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-card border border-border rounded-2xl p-6 min-h-[350px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-foreground font-black uppercase tracking-tight text-lg">Growth & Acquisition</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Past 30 Days</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] uppercase font-bold text-muted-foreground">New Users</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] uppercase font-bold text-muted-foreground">New Campaigns</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.2)" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.2)" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(0,0,0,0.9)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              itemStyle={{ color: '#fff' }}
            />
            <Line 
              type="monotone" 
              dataKey="users" 
              name="Users"
              stroke="var(--primary)" 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6, fill: 'var(--primary)' }}
            />
            <Line 
              type="monotone" 
              dataKey="campaigns" 
              name="Campaigns"
              stroke="#3b82f6" 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
