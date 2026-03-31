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
import ConditionalRules from './pages/monitor/ConditionalRules'
import ConditionalRuleEditor from './pages/monitor/ConditionalRuleEditor'
import ConflictLog from './pages/conflicts/ConflictLog'
import OrganizationSettings from './pages/settings/OrganizationSettings'
import TeamMembers from './pages/settings/TeamMembers'
import ApiKeys from './pages/settings/ApiKeys'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
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
        <Route path="monitor/parameters" element={<ParameterList />} />
        <Route path="monitor/parameters/:paramName" element={<ParameterEditor />} />
        <Route path="monitor/rules" element={<ConditionalRules />} />
        <Route path="monitor/rules/new" element={<ConditionalRuleEditor />} />
        <Route path="monitor/rules/:ruleId/edit" element={<ConditionalRuleEditor />} />
        <Route path="conflicts" element={<ConflictLog />} />
        <Route path="settings/organization" element={<OrganizationSettings />} />
        <Route path="settings/team" element={<TeamMembers />} />
        <Route path="settings/api-keys" element={<ApiKeys />} />
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
