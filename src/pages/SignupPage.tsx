import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Mail, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";

const SignupPage: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    contactNo: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.contactNo || !formData.email || !formData.password || !formData.confirmPassword) {
      setError("All fields are required.");
      return;
    }

    // First name validation
    if (formData.firstName.trim().length < 2) {
      setError("First name must be at least 2 characters long.");
      return;
    }

    // Last name validation
    if (formData.lastName.trim().length < 2) {
      setError("Last name must be at least 2 characters long.");
      return;
    }

    // Contact number validation (basic phone number format)
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(formData.contactNo.replace(/\s/g, ''))) {
      setError("Please enter a valid contact number.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    // Combine first name and last name
    const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            contact_no: formData.contactNo.trim()
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message || "Signup failed. Please try again.");
        setLoading(false);
        return;
      }

      if (data.user) {
        // Update user profile with name and contact number
        // The profile should be created by the trigger, but we'll try to update it
        // If it doesn't exist yet, we'll wait a moment and try again
        const updateProfile = async (retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              const { error: profileError } = await supabase
                .from('user_profiles')
                .update({
                  user_name: fullName,
                  contact_no: formData.contactNo.trim()
                })
                .eq('user_id', data.user.id);

              if (!profileError) {
                return; // Success
              }

              // If profile doesn't exist yet, wait and retry
              if (profileError.code === 'PGRST116' && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
              }

              console.error('Error updating profile:', profileError);
            } catch (profileUpdateError) {
              console.error('Profile update error:', profileUpdateError);
              if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
        };

        // Update profile (non-blocking - don't wait for it)
        updateProfile().catch(console.error);

        setSuccess(true);
        // Store email for display
        localStorage.setItem("signupEmail", formData.email);
      } else {
        setError("Signup failed. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 md:px-4 md:py-8">
      <div className="w-full h-screen md:h-auto md:max-w-md md:rounded-2xl p-6 md:p-8 bg-white/90 shadow-xl border border-white/50 flex flex-col overflow-y-auto">
        <div className="flex flex-col items-center mb-7">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-2">
            <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </span>
          <h2 className="text-2xl font-semibold text-gray-800 mb-1 tracking-tight">Create Account</h2>
          <p className="text-gray-400 text-sm">Join Signify today</p>
        </div>

        {/* Google Sign Up Button */}
        {!success && (
          <>
            <button
              type="button"
              onClick={async () => {
                setGoogleLoading(true);
                setError("");
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback`
                    }
                  });
                  if (error) {
                    setError(error.message || "Google sign up failed. Please try again.");
                    setGoogleLoading(false);
                  }
                } catch (err: any) {
                  setError("An error occurred during Google sign-up");
                  setGoogleLoading(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2 mb-4 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition text-base font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={googleLoading || loading}
            >
              {googleLoading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                <svg className="w-5 h-5" viewBox="0 0 48 48"><g><circle fill="#fff" cx="24" cy="24" r="24" /><path fill="#4285F4" d="M35.3 24.2c0-.7-.1-1.4-.2-2H24v4.1h6.4c-.3 1.4-1.3 2.6-2.7 3.4v2.8h4.4c2.6-2.4 4.2-5.9 4.2-10.3z" /><path fill="#34A853" d="M24 36c3.6 0 6.6-1.2 8.8-3.2l-4.4-2.8c-1.2.8-2.7 1.3-4.4 1.3-3.4 0-6.2-2.3-7.2-5.3h-4.5v3.3C15.2 33.8 19.3 36 24 36z" /><path fill="#FBBC05" d="M16.8 26c-.3-.8-.5-1.6-.5-2.5s.2-1.7.5-2.5v-3.3h-4.5C11.3 20.2 11 22.1 11 24s.3 3.8.8 5.3l4.5-3.3z" /><path fill="#EA4335" d="M24 17.7c1.9 0 3.6.6 4.9 1.7l3.7-3.7C30.6 13.8 27.6 12.5 24 12.5c-4.7 0-8.8 2.2-11.3 5.7l4.5 3.3c1-3 3.8-5.3 7.2-5.3z" /></g></svg>
              )}
              {googleLoading ? "Signing up..." : "Sign up with Google"}
            </button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>
          </>
        )}

        {success ? (
          <div className="text-center space-y-6">
            <div className="flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
                <Mail className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Check Your Email</h3>
              <p className="text-gray-600 text-sm mb-4">
                We've sent a verification link to <strong>{localStorage.getItem("signupEmail") || formData.email}</strong>
              </p>
              <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm border border-blue-100">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Next Steps:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Click the verification link in your email</li>
                      <li>Complete your profile details</li>
                      <li>Wait for approval (24-72 hours)</li>
                      <li>Get your Employee ID and access dashboard</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate("/")}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-sm transition text-base"
              >
                Back to Login
              </button>

              <p className="text-gray-500 text-xs">
                Didn't receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => setSuccess(false)}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  try again
                </button>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded mb-2 text-center text-sm border border-red-100">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-gray-50 text-gray-700 text-sm transition"
                  required
                  autoFocus
                  disabled={loading}
                  placeholder="First name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-gray-50 text-gray-700 text-sm transition"
                  required
                  disabled={loading}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contactNo" className="block text-xs font-medium text-gray-500 mb-1">Contact Number *</label>
              <input
                id="contactNo"
                name="contactNo"
                type="tel"
                value={formData.contactNo}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-gray-50 text-gray-700 text-sm transition"
                required
                disabled={loading}
                placeholder="Enter your contact number"
              />
            </div>

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
                  placeholder="Enter password (min 6 characters)"
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
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-500 mb-1">Confirm Password *</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-gray-50 text-gray-700 text-sm transition pr-10"
                  required
                  disabled={loading}
                  placeholder="Confirm your password"
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
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-sm transition text-base disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <div className="text-center">
              <p className="text-gray-500 text-sm">
                Already have an account?{" "}
                <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignupPage; 