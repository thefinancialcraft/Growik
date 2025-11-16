import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import Login from "./pages/Login";
import SignupPage from "./pages/SignupPage";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Contract from "./pages/Contract";
import ContractEditor from "./pages/ContractEditor";
import Messaging from "./pages/Messaging";
import Influencer from "./pages/Influencer";
import Product from "./pages/Product";
import Campaign from "./pages/Campaign";
import CampaignDetail from "./pages/CampaignDetail";
import Collaboration from "./pages/Collaboration";
import CollaborationAssignment from "./pages/CollaborationAssignment";
import Companies from "./pages/Companies";
import Settings from "./pages/Settings";
import ApprovalPending from "./components/ApprovalPending";
import Hold from "./pages/Hold";
import Suspended from "./pages/Suspended";
import Rejected from "./pages/Rejected";
import ProfileCompletion from "./pages/ProfileCompletion";
import ChatWidget from "./components/ChatWidget";
// Intermediate pages removed for direct-to-dashboard flow
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Rely on auth state only; don't block on profile/localStorage
    if (loading) {
      setChecking(true);
      return;
    }
    setIsAuthenticated(Boolean(user));
    setChecking(false);
  }, [user, loading]);

  // Profile-based redirection removed for direct-to-dashboard flow

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/" 
        replace 
        state={{ message: "User data deleted or not found contact to your admin" }}
      />
    );
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/profile-completion"
              element={
                <ProtectedRoute>
                  <ProfileCompletion />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contract"
              element={
                <ProtectedRoute>
                  <Contract />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contract/editor"
              element={
                <ProtectedRoute>
                  <ContractEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messaging"
              element={
                <ProtectedRoute>
                  <Messaging />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencer"
              element={
                <ProtectedRoute>
                  <Influencer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/product"
              element={
                <ProtectedRoute>
                  <Product />
                </ProtectedRoute>
              }
            />
            <Route
              path="/companies"
              element={
                <ProtectedRoute>
                  <Companies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaign"
              element={
                <ProtectedRoute>
                  <Campaign />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaign/:id"
              element={
                <ProtectedRoute>
                  <CampaignDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/collaboration"
              element={
                <ProtectedRoute>
                  <Collaboration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/collaboration/:id"
              element={
                <ProtectedRoute>
                  <Collaboration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/collaborationAssignment"
              element={
                <ProtectedRoute>
                  <CollaborationAssignment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/collaborationAssignment/:id"
              element={
                <ProtectedRoute>
                  <CollaborationAssignment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approval-pending"
              element={
                <ProtectedRoute>
                  <ApprovalPending />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hold"
              element={
                <ProtectedRoute>
                  <Hold />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suspended"
              element={
                <ProtectedRoute>
                  <Suspended />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rejected"
              element={
                <ProtectedRoute>
                  <Rejected />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ChatWidget />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
