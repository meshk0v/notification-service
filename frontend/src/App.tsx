import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './layouts/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import CampaignWizard from './pages/CampaignWizard'
import CampaignDetails from './pages/CampaignDetails'
import Users from './pages/Users'
import Groups from './pages/Groups'
import Templates from './pages/Templates'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route index element={<Dashboard />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/new" element={<CampaignWizard />} />
        <Route path="campaigns/:id" element={<CampaignDetails />} />
        <Route path="users" element={<Users />} />
        <Route path="groups" element={<Groups />} />
        <Route path="templates" element={<Templates />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
