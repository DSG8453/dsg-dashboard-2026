import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SupportProvider } from "@/context/SupportContext";

// Layout Components
import { Navbar } from "@/components/layout/Navbar";
import { WhatsAppSupport } from "@/components/support/WhatsAppSupport";
import { DevicePendingApproval } from "@/components/auth/DevicePendingApproval";
import { AuthCallback } from "@/components/auth/AuthCallback";

// Page Components
import { LoginPage } from "@/pages/LoginPage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { UsersPage } from "@/pages/UsersPage";
import { CredentialsPage } from "@/pages/CredentialsPage";
import { IPManagementPage } from "@/pages/IPManagementPage";
import { DevicesPage } from "@/pages/DevicesPage";
import { ActivityLogsPage } from "@/pages/ActivityLogsPage";
import { SupportManagementPage } from "@/pages/SupportManagementPage";
import { IssuesPage } from "@/pages/IssuesPage";

// Protected Route Component with Device Check
const ProtectedRoute = ({ children, requireDeviceApproval = true }) => {
  const { isAuthenticated, isLoading, isDeviceApproved, deviceStatus, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-dsg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check device approval (admins bypass this check)
  if (requireDeviceApproval && !isDeviceApproved && deviceStatus) {
    return <DevicePendingApproval />;
  }

  return children;
};

// Layout wrapper for authenticated pages
const AuthenticatedLayout = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-dsg">
      <Navbar currentUser={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <WhatsAppSupport />
    </div>
  );
};

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  // CRITICAL: Check for session_id or token in URL fragment synchronously during render
  // This must happen BEFORE ProtectedRoute runs to prevent race conditions
  // session_id = legacy Emergent auth flow
  // token = new direct Google OAuth flow
  if (location.hash?.includes('session_id=') || location.hash?.includes('token=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <DashboardPage currentUser={user} />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <ProfilePage currentUser={user} />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <UsersPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/credentials"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <CredentialsPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ip-management"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <IPManagementPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <DevicesPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity-logs"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <ActivityLogsPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <SupportManagementPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/issues"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <IssuesPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Public Routes - No Login Required */}
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SupportProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
          {/* DSG Transport Branding Badge */}
          <a 
            href="https://portal.dsgtransport.net" 
            className="dsg-brand-badge"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png" 
              alt="DSG Transport" 
            />
            <span>DSG Transport LLC</span>
          </a>
        </SupportProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
