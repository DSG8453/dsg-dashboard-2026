import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Layout Components
import { Navbar } from "@/components/layout/Navbar";

// Page Components
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { UsersPage } from "@/pages/UsersPage";
import { CredentialsPage } from "@/pages/CredentialsPage";
import { IPManagementPage } from "@/pages/IPManagementPage";
import { DevicesPage } from "@/pages/DevicesPage";
import { ActivityLogsPage } from "@/pages/ActivityLogsPage";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

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
    </div>
  );
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Route */}
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

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
