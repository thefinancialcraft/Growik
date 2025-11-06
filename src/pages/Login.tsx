import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase, SUPABASE_URL, SUPABASE_ENV_OK, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { encryptPassword, decryptPassword } from "@/lib/utils";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  user_name?: string;
  employee_id?: string;
  role?: string;
  status?: string;
  approval_status?: string;
  super_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

const LoginPage = () => {
  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error(`Authentication timeout after ${ms}ms`));
        }, ms);
      })
    ]);
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved email and password if remember me was checked
  useEffect(() => {
    const loadRememberedCredentials = async () => {
      const savedEmail = localStorage.getItem("rememberedEmail");
      const savedEncryptedPassword = localStorage.getItem("rememberedPassword");
      const rememberMeChecked = localStorage.getItem("rememberMe") === "true";
      
      if (savedEmail && savedEncryptedPassword && rememberMeChecked) {
        try {
          const decryptedPassword = await decryptPassword(savedEncryptedPassword);
          setFormData(prev => ({ 
            ...prev, 
            email: savedEmail,
            password: decryptedPassword
          }));
          setRememberMe(true);
        } catch (error) {
          console.error("Error decrypting password:", error);
          // Clear invalid data
          localStorage.removeItem("rememberedEmail");
          localStorage.removeItem("rememberedPassword");
          localStorage.removeItem("rememberMe");
        }
      }
    };
    
    loadRememberedCredentials();
  }, []);

  // Check for deletion message from navigation state or URL params
  useEffect(() => {
    const message = location.state?.message;
    const urlParams = new URLSearchParams(location.search);
    const urlMessage = urlParams.get('message');
    
    if (message) {
      setError(message);
      // Clear the state to prevent the message from showing again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    } else if (urlMessage) {
      setError(decodeURIComponent(urlMessage));
      // Clear URL param
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.search, navigate, location.pathname]);

  // Test Supabase connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log("=== TESTING SUPABASE CONNECTION ===");
        console.log("Env loaded?", SUPABASE_ENV_OK, "URL:", SUPABASE_URL);
        console.log("Origin:", window.location.origin, "Online:", navigator.onLine);

        // Health check to isolate CORS/network problems
        try {
          const healthUrl = `${SUPABASE_URL}/auth/v1/health`;
          const res = await fetch(healthUrl, { 
            method: 'GET',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          const text = await res.text();
          console.log("Auth health status:", res.status, "body:", text);
        } catch (e) {
          console.error("Auth health request failed:", e);
        }

        // Minimal DB read to detect RLS/permission issues quickly
        try {
          const { data: probe, error: probeErr } = await supabase
            .from('user_profiles')
            .select('id')
            .limit(1);
          console.log('DB probe result:', { count: probe?.length ?? 0, error: probeErr });
        } catch (e) {
          console.error('DB probe exception:', e);
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Supabase connection error:", error);
        } else {
          console.log("Supabase connection successful");
          console.log("Current session:", data.session);
          console.log("Current user:", data.session?.user);
        }

        // Check if any users exist in the database
        console.log("=== CHECKING DATABASE USERS ===");
        const { data: users, error: usersError } = await supabase
          .from('user_profiles')
          .select('email, user_name, role, status')
          .limit(5);

        if (usersError) {
          console.error("Error fetching users:", usersError);
          console.error("Error details:", {
            code: usersError.code,
            message: usersError.message,
            details: usersError.details
          });
        } else {
          console.log("Existing users in database:", users);
          console.log("User count:", users?.length || 0);
        }

        // Test database permissions
        console.log("=== TESTING DATABASE PERMISSIONS ===");
        const { data: testQuery, error: testError } = await supabase
          .from('user_profiles')
          .select('count')
          .limit(1);

        if (testError) {
          console.error("Database permission test failed:", testError);
        } else {
          console.log("Database permissions working correctly");
        }
      } catch (error) {
        console.error("=== CONNECTION TEST EXCEPTION ===");
        console.error("Failed to connect to Supabase:", error);
        console.error("Error type:", typeof error);
        console.error("Error message:", error?.message);
      }
    };

    testConnection();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("=== LOGIN DEBUG START ===");
    console.log("Form data:", formData);

    // Basic validation
    if (!formData.email || !formData.password) {
      console.log("Validation failed: Missing email or password");
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      console.log("Attempting to sign in with email:", formData.email);

      // First, let's check if the user exists in auth
      console.log("Calling supabase.auth.signInWithPassword...");
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      console.log("=== AUTH RESPONSE ===");
      console.log("Auth data:", authData);
      console.log("Auth error:", authError);
      console.log("User object:", authData?.user);
      console.log("Session:", authData?.session);

      if (authError) {
        console.error("Auth error details:", {
          message: authError.message,
          status: authError.status,
          name: authError.name,
          error: authError
        });

        // Handle specific error cases
        let errorMessage = "";

        // Check for "Invalid login credentials" error (status 400)
        if (authError.status === 400 || 
            authError.message?.includes("Invalid login credentials") ||
            authError.message?.toLowerCase().includes("invalid login") ||
            authError.message?.toLowerCase().includes("invalid email or password")) {
          
          // Try to check if email exists in user_profiles to distinguish between user not found vs wrong password
          try {
            const { data: profileCheck, error: checkError } = await supabase
              .from('user_profiles')
              .select('email')
              .eq('email', formData.email)
              .maybeSingle();
            
            // If email not found in profiles, user doesn't exist
            if (!profileCheck && (!checkError || checkError.code === 'PGRST116')) {
              errorMessage = "User not found. Please check your email or contact your admin.";
            } else {
              // Email exists but password might be wrong
              errorMessage = "Invalid email or password. Please check your credentials and try again.";
            }
          } catch (checkError) {
            // If check fails, show generic invalid credentials message
            errorMessage = "Invalid email or password. Please check your credentials and try again.";
          }
        }
        // Check for user not found scenarios
        else if (authError.message?.toLowerCase().includes("user") && 
                 authError.message?.toLowerCase().includes("not found")) {
          errorMessage = "User not found. Please check your email or contact your admin.";
        } 
        else if (authError.status === 404) {
          errorMessage = "User not found. Please check your email or contact your admin.";
        }
        // Email not confirmed
        else if (authError.message?.includes("Email not confirmed") || 
                 authError.message?.toLowerCase().includes("email not confirmed")) {
          errorMessage = "Please check your email and click the verification link before signing in.";
        }
        // Too many requests
        else if (authError.message?.includes("Too many requests") || 
                 authError.message?.toLowerCase().includes("too many")) {
          errorMessage = "Too many login attempts. Please try again later.";
        }
        // Network or connection errors
        else if (authError.message?.toLowerCase().includes("network") ||
                 authError.message?.toLowerCase().includes("fetch") ||
                 authError.message?.toLowerCase().includes("connection")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
        }
        // Default: show the actual error message
        else {
          errorMessage = authError.message || "Login failed. Please try again.";
        }

        // Always set and display the error
        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (authData?.user) {
        console.log("=== USER AUTHENTICATED SUCCESSFULLY ===");
        console.log("User ID:", authData.user.id);
        console.log("User email:", authData.user.email);
        console.log("Email confirmed at:", authData.user.email_confirmed_at);
        console.log("User metadata:", authData.user.user_metadata);
        console.log("App metadata:", authData.user.app_metadata);

        // Check user's profile and role (non-blocking)
        try {
          console.log("=== FETCHING USER PROFILE ===");
          console.log("Querying user_profiles table for user_id:", authData.user.id);

          // Add a short timeout so login never hangs on profile read
          let profile: any = null;
          let profileError: any = null;
          try {
            // Use Promise.race with timeout directly
            const profileQuery = supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', authData.user.id)
              .maybeSingle();
            
            const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => {
              setTimeout(() => {
                reject(new Error('Profile fetch timeout after 5000ms'));
              }, 5000);
            });
            
            const result = await Promise.race([profileQuery, timeoutPromise]) as { data: any; error: any };
            profile = result.data;
            profileError = result.error;
          } catch (e: any) {
            console.warn('Profile fetch timed out or failed, proceeding to dashboard.', e?.message || e);
            localStorage.setItem("isAuthenticated", "true");
            navigate('/dashboard');
            setLoading(false);
            return;
          }

          console.log("=== PROFILE QUERY RESULT ===");
          console.log("Profile data:", profile);
          console.log("Profile error:", profileError);
          console.log("Profile error code:", profileError?.code);
          console.log("Profile error message:", profileError?.message);

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile details:', {
              code: profileError.code,
              message: profileError.message,
              details: profileError.details,
              hint: profileError.hint
            });
            // Proceed to dashboard even if profile fetch fails
            console.log("Profile fetch error - proceeding to dashboard");
            localStorage.setItem("isAuthenticated", "true");
            navigate('/dashboard');
            return;
          }

          console.log("=== PROFILE ANALYSIS ===");
          console.log("Profile exists:", !!profile);
          if (profile) {
            const userProfileTemp = profile as UserProfile;
            console.log("Profile role:", userProfileTemp.role);
            console.log("Profile status:", userProfileTemp.status);
            console.log("Profile employee_id:", userProfileTemp.employee_id);
            console.log("Profile created_at:", userProfileTemp.created_at);

            // Cache role/profile for fast reads in Header/Sidebar and global usage
            try {
              localStorage.setItem(`profile_${authData.user.id}`, JSON.stringify(userProfileTemp));
              const sidebarCache = {
                employee_id: userProfileTemp.employee_id,
                updated_at: userProfileTemp.updated_at,
                user_name: userProfileTemp.user_name,
                email: userProfileTemp.email,
                role: userProfileTemp.role,
                super_admin: userProfileTemp.super_admin,
              } as Record<string, any>;
              localStorage.setItem(`profile_sidebar_${authData.user.id}`, JSON.stringify(sidebarCache));
              if (userProfileTemp.role) localStorage.setItem('currentUserRole', userProfileTemp.role);
              if (typeof userProfileTemp.super_admin === 'boolean') localStorage.setItem('isSuperAdmin', String(userProfileTemp.super_admin));
            } catch {}
          }

          // If user has no profile, proceed to dashboard (do not block login)
          if (!profile) {
            console.log("No profile found - proceeding to dashboard");
            localStorage.setItem("isAuthenticated", "true");
            navigate('/dashboard');
            setLoading(false);
            return;
          }

          // Type assertion after null check
          const userProfile = profile as UserProfile;

          // Save email and encrypted password if remember me is checked
          if (rememberMe) {
            try {
              const encryptedPassword = await encryptPassword(formData.password);
              localStorage.setItem("rememberedEmail", formData.email);
              localStorage.setItem("rememberedPassword", encryptedPassword);
              localStorage.setItem("rememberMe", "true");
            } catch (error) {
              console.error("Error encrypting password:", error);
              // Still save email even if encryption fails
              localStorage.setItem("rememberedEmail", formData.email);
              localStorage.setItem("rememberMe", "true");
            }
          } else {
            localStorage.removeItem("rememberedEmail");
            localStorage.removeItem("rememberedPassword");
            localStorage.removeItem("rememberMe");
          }

          // If user is rejected, redirect to rejection page
          if (userProfile.approval_status === 'rejected') {
            console.log("User rejected, redirecting to rejection page");
            navigate('/rejected');
            return;
          }

          // If user is suspended, redirect to suspended page
          if (userProfile.status === 'suspend') {
            console.log("User suspended, redirecting to suspended page");
            navigate('/suspended');
            return;
          }

          // If user is on hold, redirect to hold page
          if (userProfile.status === 'hold') {
            console.log("User on hold, redirecting to hold page");
            navigate('/hold');
            return;
          }

          // If role is "user" and not approved, redirect to approval pending page
          if ((userProfile.role === 'user' || !userProfile.role) && userProfile.approval_status !== 'approved') {
            console.log("User role not approved, redirecting to approval pending");
            navigate('/approval-pending');
            return;
          }

          // If user is active (admin/super_admin or approved user), allow access to dashboard
          if (userProfile.status === 'active') {
            console.log("User active, redirecting to dashboard");
            localStorage.setItem("isAuthenticated", "true");
            navigate('/dashboard');
            return;
          }

          // Default fallback - allow access to dashboard
          console.log("Default fallback, redirecting to dashboard");
          localStorage.setItem("isAuthenticated", "true");
          navigate('/dashboard');
        } catch (profileError) {
          console.error("=== PROFILE CHECK EXCEPTION ===");
          console.error("Profile check error:", profileError);
          console.error("Error type:", typeof profileError);
          console.error("Error message:", profileError?.message);
          setError("Error checking user profile. Please try again.");
          setLoading(false);
        }
      } else {
        console.log("=== NO USER DATA RETURNED ===");
        console.log("Auth data is null or undefined");
        console.log("Full auth response:", authData);
        setError("Login failed. Please try again.");
        setLoading(false);
      }
    } catch (error) {
      console.error("=== LOGIN EXCEPTION ===");
      console.error("Login error:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);

      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          setError("Network error. Please check your internet connection.");
        } else if (error.message.includes("Supabase")) {
          setError("Authentication service error. Please try again later.");
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } else {
        setError("An error occurred during login. Please try again.");
      }
      setLoading(false);
    } finally {
      console.log("=== LOGIN DEBUG END ===");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setError(error.message);
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      setError("An error occurred during Google sign-in");
    }
  };

  const checkAllUsers = async () => {
    try {
      console.log("=== CHECKING ALL USERS IN DATABASE ===");
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching users:", error);
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
      } else {
        console.log("=== DATABASE USERS ===");
        console.log("Total users found:", users?.length || 0);

        if (users && users.length > 0) {
          users.forEach((user, index) => {
            const userProfile = user as UserProfile;
            console.log(`User ${index + 1}:`, {
              id: userProfile.id,
              user_id: userProfile.user_id,
              user_name: userProfile.user_name,
              email: userProfile.email,
              role: userProfile.role,
              status: userProfile.status,
              employee_id: userProfile.employee_id,
              created_at: userProfile.created_at,
              updated_at: userProfile.updated_at
            });
          });
        } else {
          console.log("No users found in database");
        }

        alert(`Found ${users?.length || 0} users in database. Check console for details.`);
      }

      // Also check auth users
      console.log("=== CHECKING AUTH USERS ===");
      console.log("Note: Admin API not available in client-side code");
      console.log("Auth users can only be checked from server-side or admin panel");
    } catch (error) {
      console.error("=== ERROR CHECKING USERS ===");
      console.error("Error checking users:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error?.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 px-4 py-8">
      <div className="w-full max-w-md p-6 md:p-8 bg-white/90 rounded-2xl shadow-xl border border-white/50">
        <div className="flex flex-col items-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-2 overflow-hidden">
            <img 
              src="/Nexus icon.png" 
              alt="TFC Nexus Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-1 tracking-tight">Welcome Back</h2>
          <p className="text-gray-400 text-sm">Sign in to your TFC Nexus account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-gray-50 text-gray-700 text-sm transition"
              required
              autoFocus
              disabled={loading}
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-gray-500 mb-1">Password *</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-gray-50 text-gray-700 text-sm transition pr-10"
                required
                disabled={loading}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                disabled={loading}
              />
              <label htmlFor="rememberMe" className="ml-2 text-xs text-gray-600 cursor-pointer">
                Remember me
              </label>
            </div>
            <div className="text-xs">
              <Link
                to="/forgot-password"
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-sm transition text-base disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Don't have an account?{" "}
              <Link to="/signup" className="text-indigo-600 hover:text-indigo-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
