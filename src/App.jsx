import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { OrgProvider } from './contexts/OrgContext'
import { useAuth } from './contexts/AuthContext'
import AppShell from './components/layout/AppShell'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import AcceptInvite from './pages/auth/AcceptInvite'
import Dashboard from './pages/dashboard/Dashboard'
import ParameterList from './pages/monitor/ParameterList'
import ParameterEditor from './pages/monitor/ParameterEditor'
import ConditionalRuleEditor from './pages/monitor/ConditionalRuleEditor'
import ConditionalRuleView from './pages/monitor/ConditionalRuleView'
import FormatStandards from './pages/monitor/FormatStandards'
import ChannelTemplates from './pages/monitor/ChannelTemplates'
import ValueRequests from './pages/monitor/ValueRequests'
import ConflictLog from './pages/conflicts/ConflictLog'
import OrganizationSettings from './pages/settings/OrganizationSettings'
import TeamMembers from './pages/settings/TeamMembers'
import UserManagement from './pages/settings/UserManagement'
import UserProfile from './pages/settings/UserProfile'
import AuditLog from './pages/settings/AuditLog'
import DataCollection from './pages/settings/DataCollection'
import Help from './pages/Help'
import CampaignList from './pages/campaigns/CampaignList'
import CampaignEditor from './pages/campaigns/CampaignEditor'
import CampaignDetail from './pages/campaigns/CampaignDetail'
import UrlBuilder from './pages/campaigns/UrlBuilder'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/" element={
        <ProtectedRoute>
          <OrgProvider>
            <AppShell />
          </OrgProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Monitor */}
        <Route path="monitor/parameters" element={<ParameterList />} />
        <Route path="monitor/parameters/:paramName" element={<ParameterEditor />} />
        <Route path="monitor/rules" element={<ParameterList />} />
        <Route path="monitor/rules/new" element={<ConditionalRuleEditor />} />
        <Route path="monitor/rules/:ruleId/edit" element={<ConditionalRuleEditor />} />
        <Route path="monitor/rules/:ruleId" element={<ConditionalRuleView />} />
        <Route path="monitor/issues" element={<ParameterList />} />
        <Route path="monitor/format-standards" element={<FormatStandards />} />
        <Route path="monitor/channel-templates" element={<ChannelTemplates />} />
        <Route path="monitor/value-requests" element={<ValueRequests />} />
        {/* Legacy redirects */}
        <Route path="monitor/standards" element={<Navigate to="/monitor/format-standards" replace />} />

        {/* Conflicts */}
        <Route path="conflicts" element={<ConflictLog />} />

        {/* Campaigns */}
        <Route path="campaigns" element={<CampaignList />} />
        <Route path="campaigns/new" element={<CampaignEditor />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetail />} />
        <Route path="campaigns/:campaignId/edit" element={<CampaignEditor />} />
        <Route path="campaigns/:campaignId/channels/:channelId/urls/new" element={<UrlBuilder />} />
        <Route path="campaigns/:campaignId/channels/:channelId/urls/:urlId/edit" element={<UrlBuilder />} />

        {/* Settings */}
        <Route path="settings/organization" element={<OrganizationSettings />} />
        <Route path="settings/team" element={<TeamMembers />} />
        <Route path="settings/user-management" element={<UserManagement />} />
        <Route path="settings/profile" element={<UserProfile />} />
        <Route path="settings/audit-log" element={<AuditLog />} />
        <Route path="settings/data-collection" element={<DataCollection />} />

        {/* Help */}
        <Route path="help" element={<Help />} />

        {/* Legacy redirects */}
        <Route path="settings/domains" element={<Navigate to="/settings/data-collection" replace />} />
        <Route path="settings/api-keys" element={<Navigate to="/settings/data-collection" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
