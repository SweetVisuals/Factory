import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Dashboard } from '../Dashboard';
import { AdminDashboard } from '../../pages/AdminDashboard';

export const DashboardRouter = () => {
  const { user } = useAuth();
  
  if (user?.email === 'admin@relaysolutions.net') {
    return <AdminDashboard />;
  }
  
  return <Dashboard />;
};
