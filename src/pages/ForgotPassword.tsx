import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Mail, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    if (!email.trim()) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      console.log("=== PASSWORD RESET REQUEST ===");
      console.log("Email:", email);
      console.log("Redirect URL:", `${window.location.origin}/reset-password`);
      
      const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      console.log("Reset response - data:", data);
      console.log("Reset response - error:", resetError);

      if (resetError) {
        console.error("Password reset error details:", {
          message: resetError.message,
          status: resetError.status,
          name: resetError.name
        });
        setError(resetError.message || "Failed to send password reset email. Please try again.");
      } else {
        console.log("Password reset email sent successfully");
        setSuccess(true);
      }
    } catch (error: any) {
      console.error("Password reset exception:", error);
      setError(error.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="text-2xl font-semibold text-gray-800 mb-1 tracking-tight">Forgot Password</h2>
          <p className="text-gray-400 text-sm text-center">Enter your email to reset your password</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-800 font-medium text-sm mb-1">Password reset email sent!</p>
                  <p className="text-green-700 text-xs">
                    We've sent a password reset link to <strong>{email}</strong>. Please check your email and click the link to reset your password.
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
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
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
              <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none bg-gray-50 text-gray-700 text-sm transition"
                  style={{ 
                    '--tw-ring-color': '#385DFF',
                  } as React.CSSProperties & { '--tw-ring-color': string }}
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(56, 93, 255, 0.2)'}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                  required
                  autoFocus
                  disabled={loading}
                  placeholder="Enter your email address"
                />
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
                  Sending...
                </>
              ) : (
                "Send Reset Link"
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
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

