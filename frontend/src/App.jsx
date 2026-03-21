import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Interview from "./pages/Interview";
import Review from "./pages/Review";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Knowledge from "./pages/Knowledge";
import TopicDetail from "./pages/TopicDetail";
import Graph from "./pages/Graph";
import RecordingAnalysis from "./pages/RecordingAnalysis";
import NotFound from "./pages/NotFound";

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (!token) return <Navigate to="/" replace />;
  return children;
}

function PublicHome() {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (token)
    return (
      <AppShell>
        <Home />
      </AppShell>
    );
  return <Landing />;
}

function AuthPage() {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (token) return <Navigate to="/" replace />;
  return <Login />;
}

function AppShell({ children }) {
  return (
    <div className="flex flex-col md:flex-row h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto flex flex-col">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/interview/:sessionId" element={<Interview />} />
                <Route path="/review/:sessionId" element={<Review />} />
                <Route path="/history" element={<History />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/topic/:topic" element={<TopicDetail />} />
                <Route path="/knowledge" element={<Knowledge />} />
                <Route path="/graph" element={<Graph />} />
                <Route path="/recording" element={<RecordingAnalysis />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
