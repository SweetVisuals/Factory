import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout';
import SignUpLayout from '../components/auth/SignUpLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { DashboardRouter } from '../components/admin/DashboardRouter';
import { CampaignHub } from '../pages/CampaignHub';
import CreateCampaign from '../pages/CreateCampaign';
import CampaignDashboard from '../pages/CampaignDashboard';
import Discover from '../pages/Discover';
import ProfilePage from '../pages/Profile';
import Inbox from '../pages/Inbox';
import EmailAccounts from '../pages/EmailAccounts';
import Pricing from '../pages/Pricing';
import TestDeleteFunction from '../pages/TestDeleteFunction';
import Layout from '../components/layout/Layout';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';
import AuthVerify from '../pages/AuthVerify';
import { AdminCampaignHub } from '../pages/admin/AdminCampaignHub';
import { AdminAccountsHub } from '../pages/admin/AdminAccountsHub';
import { useAuth } from '../context/AuthContext';

const CampaignsRouter = () => {
  const { user } = useAuth();
  if (user?.email === 'admin@relaysolutions.net') {
    return <AdminCampaignHub />;
  }
  return <CampaignHub />;
};

const EmailAccountsRouter = () => {
  const { user } = useAuth();
  if (user?.email === 'admin@relaysolutions.net') {
    return <AdminAccountsHub />;
  }
  return <EmailAccounts />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={
        <Layout>
          <div className="w-full h-full flex items-center justify-center bg-background/50 backdrop-blur-sm p-4">
            <AuthLayout />
          </div>
        </Layout>
      } />
      <Route path="/signup" element={
        <Layout>
          <div className="w-full h-full flex items-center justify-center bg-background/50 backdrop-blur-sm p-4">
            <SignUpLayout />
          </div>
        </Layout>
      } />
      <Route path="/auth/verify" element={<AuthVerify />} />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingWizard />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/discover" replace />} />

      <Route path="/business-overview" element={
        <ProtectedRoute>
          <Navigate to="/profile?tab=business" replace />
        </ProtectedRoute>
      } />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardRouter />
        </ProtectedRoute>
      } />

      <Route path="/campaigns" element={
        <ProtectedRoute>
          <CampaignsRouter />
        </ProtectedRoute>
      } />

      <Route path="/create-campaign" element={
        <ProtectedRoute>
          <CreateCampaign />
        </ProtectedRoute>
      } />

      <Route path="/campaign/:id" element={
        <ProtectedRoute>
          <CampaignDashboard />
        </ProtectedRoute>
      } />

      <Route path="/lead-scraper" element={
        <ProtectedRoute>
          <Navigate to="/discover?tab=discovery" replace />
        </ProtectedRoute>
      } />

      <Route path="/lists" element={
        <ProtectedRoute>
          <Navigate to="/discover?tab=cloud" replace />
        </ProtectedRoute>
      } />

      <Route path="/discover" element={<Discover />} />

      <Route path="/inbox" element={
        <ProtectedRoute>
          <Inbox />
        </ProtectedRoute>
      } />

      <Route path="/email-accounts" element={
        <ProtectedRoute>
          <EmailAccountsRouter />
        </ProtectedRoute>
      } />

      <Route path="/account-settings" element={
        <ProtectedRoute>
          <Navigate to="/profile?tab=identity" replace />
        </ProtectedRoute>
      } />

      <Route path="/profile" element={<ProfilePage />} />

      <Route path="/test-delete-function" element={
        <ProtectedRoute>
          <TestDeleteFunction />
        </ProtectedRoute>
      } />

      <Route path="/pricing" element={
        <ProtectedRoute>
          <Pricing />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppRoutes;

