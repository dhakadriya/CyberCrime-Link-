import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'

// Pages — Auth
import { LoginPage } from './pages/auth/LoginPage'

// Pages — Core
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { CasesPage } from './pages/cases/CasesPage'
import { CaseDetailPage } from './pages/cases/CaseDetailPage'
import { CreateCasePage } from './pages/cases/CreateCasePage'
import { ImportCasesPage } from './pages/cases/ImportCasesPage'
import { PersonsPage } from './pages/persons/PersonsPage'
import { PersonDetailPage } from './pages/persons/PersonDetailPage'
import { CreatePersonPage } from './pages/persons/CreatePersonPage'
import { EvidencePage } from './pages/evidence/EvidencePage'
import { EvidenceDetailPage } from './pages/evidence/EvidenceDetailPage'
import { EntitiesPage } from './pages/entities/EntitiesPage'

// Pages — Intelligence
import { DataIngestionPage } from './pages/ingest/DataIngestionPage'
import { NetworkGraphPage } from './pages/network/NetworkGraphPage'
import { NetworkAnalysisPage } from './pages/analysis/NetworkAnalysisPage'
import { CommunitiesPage } from './pages/communities/CommunitiesPage'
import { AnomaliesPage } from './pages/anomalies/AnomaliesPage'
import { InvestigationPage } from './pages/investigation/InvestigationPage'
import { GeospatialPage } from './pages/map/GeospatialPage'
import { QueryPage } from './pages/query/QueryPage'
import { LeadsPage } from './pages/leads/LeadsPage'

// Pages — Existing
import { RelationshipsPage } from './pages/relationships/RelationshipsPage'
import { PrioritizationPage } from './pages/prioritization/PrioritizationPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { AuditPage } from './pages/audit/AuditPage'
import { SecurityPage } from './pages/security/SecurityPage'
import { UsersPage } from './pages/users/UsersPage'
import { SettingsPage } from './pages/settings/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* All authenticated routes under AppShell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Investigation */}
              <Route path="/cases" element={<ProtectedRoute permission="CASE_READ"><CasesPage /></ProtectedRoute>} />
              <Route path="/cases/new" element={<ProtectedRoute permission="CASE_CREATE"><CreateCasePage /></ProtectedRoute>} />
              <Route path="/cases/import" element={<ProtectedRoute permission="CASE_CREATE"><ImportCasesPage /></ProtectedRoute>} />
              <Route path="/cases/:id" element={<ProtectedRoute permission="CASE_READ"><CaseDetailPage /></ProtectedRoute>} />

              <Route path="/persons" element={<ProtectedRoute permission="PERSON_READ"><PersonsPage /></ProtectedRoute>} />
              <Route path="/persons/new" element={<ProtectedRoute permission="PERSON_CREATE"><CreatePersonPage /></ProtectedRoute>} />
              <Route path="/persons/:id" element={<ProtectedRoute permission="PERSON_READ"><PersonDetailPage /></ProtectedRoute>} />

              <Route path="/entities" element={<ProtectedRoute permission="CASE_READ"><EntitiesPage /></ProtectedRoute>} />

              <Route path="/evidence" element={<ProtectedRoute permission="EVIDENCE_READ"><EvidencePage /></ProtectedRoute>} />
              <Route path="/evidence/:id" element={<ProtectedRoute permission="EVIDENCE_READ"><EvidenceDetailPage /></ProtectedRoute>} />

              {/* Intelligence */}
              <Route path="/ingest" element={<ProtectedRoute permission="CASE_CREATE"><DataIngestionPage /></ProtectedRoute>} />
              <Route path="/network" element={<ProtectedRoute permission="CASE_READ"><NetworkGraphPage /></ProtectedRoute>} />
              <Route path="/analysis" element={<ProtectedRoute permission="CASE_READ"><NetworkAnalysisPage /></ProtectedRoute>} />
              <Route path="/communities" element={<ProtectedRoute permission="CASE_READ"><CommunitiesPage /></ProtectedRoute>} />
              <Route path="/anomalies" element={<ProtectedRoute permission="CASE_READ"><AnomaliesPage /></ProtectedRoute>} />
              <Route path="/timeline" element={<ProtectedRoute permission="CASE_READ"><InvestigationPage /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute permission="CASE_READ"><GeospatialPage /></ProtectedRoute>} />
              <Route path="/query" element={<ProtectedRoute permission="CASE_READ"><QueryPage /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute permission="CASE_READ"><LeadsPage /></ProtectedRoute>} />

              {/* Legacy routes kept for compatibility */}
              <Route path="/investigation" element={<Navigate to="/timeline" replace />} />
              <Route path="/relationships" element={<ProtectedRoute permission="CASE_READ"><RelationshipsPage /></ProtectedRoute>} />
              <Route path="/prioritization" element={<ProtectedRoute permission="CASE_READ"><PrioritizationPage /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/reports" element={<ProtectedRoute permission="REPORT_GENERATE"><ReportsPage /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute permission="AUDIT_READ"><AuditPage /></ProtectedRoute>} />
              <Route path="/security" element={<ProtectedRoute permission="SECURITY_READ"><SecurityPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute permission="USER_MANAGE"><UsersPage /></ProtectedRoute>} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
   </ThemeProvider>
  )
}
