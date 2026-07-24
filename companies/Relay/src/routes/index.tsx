import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout';
import SignUpLayout from '../components/auth/SignUpLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { Dashboard } from '../components/Dashboard';
import { CampaignHub } from '../pages/CampaignHub';
import CreateCampaign from '../pages/CreateCampaign';
import CampaignDashboard from '../pages/CampaignDashboard';
import Discover from '../pages/Discover';
import ProfilePage from '../pages/Profile';
import Inbox from '../pages/Inbox';
import EmailAccounts from '../pages/EmailAccounts';
import Pricing from '../pages/Pricing';
import TestDeleteFunction from '../pages/TestDeleteFunction';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<AuthLayout />} />
      <Route path="/signup" element={<SignUpLayout />} />
      <Route path="/" element={<Navigate to="/discover" replace />} />

      <Route path="/business-overview" element={
        <ProtectedRoute>
          <Navigate to="/profile?tab=business" replace />
        </ProtectedRoute>
      } />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      <Route path="/campaigns" element={
        <ProtectedRoute>
          <CampaignHub />
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
          <EmailAccounts />
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

