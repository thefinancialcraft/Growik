import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    // Check if we have a valid session/token from the email link
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setError("Invalid or expired reset link. Please request a new password reset.");
          return;
        }

        if (session) {
          setIsValidToken(true);
        } else {
          // Check URL hash for access token
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const type = hashParams.get('type');
          
          if (accessToken && type === 'recovery') {
            setIsValidToken(true);
          } else {
            setError("Invalid or expired reset link. Please request a new password reset.");
          }
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setError("An error occurred. Please try again.");
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      console.log("=== RESET PASSWORD ===");
      console.log("Updating password...");

      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      console.log("Update response - data:", data);
      console.log("Update response - error:", updateError);

      if (updateError) {
        console.error("Password update error details:", {
          message: updateError.message,
          status: updateError.status,
          name: updateError.name
        });
        setError(updateError.message || "Failed to update password. Please try again.");
      } else {
        console.log("Password updated successfully");
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/");
        }, 3000);
      }
    } catch (error: any) {
      console.error("Password reset exception:", error);
      setError(error.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isValidToken && error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6, #eff6ff)' }}>
        <div className="w-full max-w-md p-6 md:p-8 bg-white/90 rounded-2xl shadow-xl border border-white/50">
          <div className="flex flex-col items-center mb-7">
            <div className="inline-flex items-center justify-center mb-3">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                id="Layer_1" 
                data-name="Layer 1" 
                viewBox="0 0 24 24" 
                className="w-12 h-12 fill-current"
                style={{ color: '#385DFF' }}
              >
                <path d="M19.89,9.65c-.36-.42-.32-1.05,.1-1.41,.42-.36,1.05-.32,1.41,.1,1.07,1.24,1.85,2.71,2.32,4.38,.15,.53-.16,1.08-.69,1.23-.09,.03-.18,.04-.27,.04-.44,0-.84-.29-.96-.73-.39-1.39-1.04-2.6-1.91-3.62Zm4.06,7.66c-1.36,4.08-4.31,4.68-5.95,4.68-1.41,0-2.64-.62-3.66-1.55-1.18,.93-2.63,1.55-4.34,1.55s-3.22-.95-4.63-2.4c-1.25,1.2-3.33,2.4-4.37,2.4-.46,0-.88-.33-.98-.8-.11-.54,.24-1.07,.78-1.18,1.15-.24,2.26-.96,3.27-1.96C1.64,14.78,0,10.24,0,7.5,0,4.57,2.54,2,5.43,2s5.57,2.62,5.57,5.5c0,2.69-1.65,7.29-4.29,10.61,1.08,1.15,2.22,1.89,3.29,1.89,1.17,0,2.19-.42,3.02-1.06-1.31-1.86-2.02-4.12-2.02-5.48,0-1.84,1.64-3.45,3.51-3.45s3.49,1.61,3.49,3.45c0,1.51-.77,3.77-2.23,5.58,.67,.59,1.42,.97,2.23,.97,1.95,0,3.32-1.12,4.05-3.32,.17-.52,.74-.81,1.27-.63,.52,.17,.81,.74,.63,1.27ZM9,7.5c0-1.8-1.74-3.5-3.57-3.5s-3.43,1.67-3.43,3.5c0,2.39,1.47,6.2,3.41,8.99,2.14-2.88,3.59-6.79,3.59-8.99Zm5.45,9.96c1.02-1.4,1.55-3.05,1.55-4,0-.73-.74-1.45-1.49-1.45s-1.51,.73-1.51,1.45c0,.95,.55,2.6,1.45,4Z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-1 tracking-tight">Invalid Reset Link</h2>
            <p className="text-gray-400 text-sm text-center">This password reset link is invalid or has expired</p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium text-sm">{error}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              to="/forgot-password"
              className="w-full py-2 text-white font-semibold rounded-md shadow-sm transition text-base flex items-center justify-center"
              style={{ backgroundColor: '#385DFF' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d4dd9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#385DFF'}
            >
              Request New Reset Link
            </Link>
            <Link
              to="/"
              className="w-full py-2 border border-gray-300 text-gray-700 font-semibold rounded-md shadow-sm transition text-base flex items-center justify-center hover:bg-gray-50"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6, #eff6ff)' }}>
      <div className="w-full max-w-md p-6 md:p-8 bg-white/90 rounded-2xl shadow-xl border border-white/50">
        <div className="flex flex-col items-center mb-7">
          <div className="inline-flex items-center justify-center mb-3">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              id="Layer_1" 
              data-name="Layer 1" 
              viewBox="0 0 24 24" 
              className="w-12 h-12 fill-current"
              style={{ color: '#385DFF' }}
            >
              <path d="M19.89,9.65c-.36-.42-.32-1.05,.1-1.41,.42-.36,1.05-.32,1.41,.1,1.07,1.24,1.85,2.71,2.32,4.38,.15,.53-.16,1.08-.69,1.23-.09,.03-.18,.04-.27,.04-.44,0-.84-.29-.96-.73-.39-1.39-1.04-2.6-1.91-3.62Zm4.06,7.66c-1.36,4.08-4.31,4.68-5.95,4.68-1.41,0-2.64-.62-3.66-1.55-1.18,.93-2.63,1.55-4.34,1.55s-3.22-.95-4.63-2.4c-1.25,1.2-3.33,2.4-4.37,2.4-.46,0-.88-.33-.98-.8-.11-.54,.24-1.07,.78-1.18,1.15-.24,2.26-.96,3.27-1.96C1.64,14.78,0,10.24,0,7.5,0,4.57,2.54,2,5.43,2s5.57,2.62,5.57,5.5c0,2.69-1.65,7.29-4.29,10.61,1.08,1.15,2.22,1.89,3.29,1.89,1.17,0,2.19-.42,3.02-1.06-1.31-1.86-2.02-4.12-2.02-5.48,0-1.84,1.64-3.45,3.51-3.45s3.49,1.61,3.49,3.45c0,1.51-.77,3.77-2.23,5.58,.67,.59,1.42,.97,2.23,.97,1.95,0,3.32-1.12,4.05-3.32,.17-.52,.74-.81,1.27-.63,.52,.17,.81,.74,.63,1.27ZM9,7.5c0-1.8-1.74-3.5-3.57-3.5s-3.43,1.67-3.43,3.5c0,2.39,1.47,6.2,3.41,8.99,2.14-2.88,3.59-6.79,3.59-8.99Zm5.45,9.96c1.02-1.4,1.55-3.05,1.55-4,0-.73-.74-1.45-1.49-1.45s-1.51,.73-1.51,1.45c0,.95,.55,2.6,1.45,4Z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-1 tracking-tight">Reset Password</h2>
          <p className="text-gray-400 text-sm text-center">Enter your new password</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-800 font-medium text-sm mb-1">Password reset successfully!</p>
                  <p className="text-green-700 text-xs">
                    Your password has been updated. Redirecting to login page...
                  </p>
                </div>
              </div>
            </div>
            <Link
              to="/"
              className="w-full py-2 text-white font-semibold rounded-md shadow-sm transition text-base flex items-center justify-center"
              style={{ backgroundColor: '#385DFF' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d4dd9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#385DFF'}
            >
              Go to Login
            </Link>
          </div>
        ) : (
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
              <label htmlFor="password" className="block text-xs font-medium text-gray-500 mb-1">
                New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-md focus:outline-none bg-gray-50 text-gray-700 text-sm transition"
                  style={{ 
                    '--tw-ring-color': '#385DFF',
                  } as React.CSSProperties & { '--tw-ring-color': string }}
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(56, 93, 255, 0.2)'}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                  required
                  autoFocus
                  disabled={loading}
                  placeholder="Enter new password (min 6 characters)"
                  minLength={6}
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

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-500 mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-md focus:outline-none bg-gray-50 text-gray-700 text-sm transition"
                  style={{ 
                    '--tw-ring-color': '#385DFF',
                  } as React.CSSProperties & { '--tw-ring-color': string }}
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(56, 93, 255, 0.2)'}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                  required
                  disabled={loading}
                  placeholder="Confirm new password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 text-white font-semibold rounded-md shadow-sm transition text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              style={{ 
                backgroundColor: '#385DFF',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#2d4dd9';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#385DFF';
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="text-center">
              <Link
                to="/"
                className="text-sm font-medium transition-colors inline-flex items-center"
                style={{ color: '#385DFF' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#2d4dd9'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#385DFF'}
              >
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;

