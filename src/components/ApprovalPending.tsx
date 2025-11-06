import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

import {
    Clock,
    CheckCircle,
    AlertCircle,
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Briefcase,
    XCircle
} from "lucide-react";

interface UserProfile {
    id: string;
    user_name: string;
    email: string;
    contact_no?: string;
    role: 'user' | 'admin' | 'super_admin';
    approval_status: 'pending' | 'approved' | 'rejected';
    status: 'active' | 'hold' | 'suspend';
    employee_id?: string;
    profile_complete?: boolean;
    super_admin?: boolean;
    created_at: string;
    updated_at: string;
}

const ApprovalPending = () => {
    const { user, signOut, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showRegistration, setShowRegistration] = useState(false);

    const fetchUserProfile = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                setError("Failed to fetch profile data.");
            } else if (data) {
                const userProfile = data as UserProfile;
                setProfile(userProfile);

                // Check if profile is complete, if not show registration form
                if (!userProfile.profile_complete) {
                    setShowRegistration(true);
                    setLoading(false);
                    return;
                }

                // If approved or active, redirect to dashboard
                if (userProfile.approval_status === 'approved' && userProfile.status === 'active') {
                    localStorage.setItem("isAuthenticated", "true");
                    navigate("/dashboard");
                } else if (userProfile.approval_status === 'approved' && userProfile.status === 'hold') {
                    navigate("/hold");
                } else if (userProfile.approval_status === 'approved' && userProfile.status === 'suspend') {
                    navigate("/suspended");
                }
            }
        } catch (error) {
            setError("An error occurred while fetching profile data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log("=== APPROVAL PENDING DEBUG ===");
        console.log("User:", user?.id);
        console.log("Auth loading:", authLoading);
        console.log("Profile:", profile);

        // Wait for auth to be loaded
        if (authLoading) {
            console.log("Auth still loading, waiting...");
            return;
        }

        // Only redirect if auth is loaded and no user exists
        if (!user && !authLoading) {
            console.log("No user found, redirecting to login");
            navigate("/login");
            return;
        }

        if (user) {
            console.log("User found, fetching profile");
            fetchUserProfile();

            // Set up real-time subscription for profile updates
            const channel = supabase
                .channel(`profile_updates_${user.id}`)
                .on('postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'user_profiles',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('=== REALTIME UPDATE RECEIVED ===');
                        console.log('Profile updated:', payload.new);
                        console.log('Old values:', payload.old);
                        const updatedProfile = payload.new as UserProfile;
                        setProfile(updatedProfile);

                        // Update cache
                        try {
                            localStorage.setItem(`profile_sidebar_${user.id}`, JSON.stringify({
                                employee_id: updatedProfile.employee_id,
                                updated_at: updatedProfile.updated_at,
                                user_name: updatedProfile.user_name,
                                email: updatedProfile.email,
                                role: updatedProfile.role,
                                super_admin: updatedProfile.super_admin,
                            }));
                        } catch (e) {
                            console.error('Error updating cache:', e);
                        }

                        // Redirect based on new status
                        if (updatedProfile.status === 'active' && updatedProfile.approval_status === 'approved') {
                            console.log('Status changed to active + approved, redirecting to dashboard');
                            localStorage.setItem("isAuthenticated", "true");
                            navigate("/dashboard");
                        } else if (updatedProfile.status === 'hold') {
                            console.log('Status changed to hold, redirecting to hold page');
                            navigate("/hold");
                        } else if (updatedProfile.status === 'suspend') {
                            console.log('Status changed to suspend, redirecting to suspended page');
                            navigate("/suspended");
                        } else if (updatedProfile.approval_status === 'rejected') {
                            console.log('Approval status changed to rejected, redirecting to rejected page');
                            navigate("/rejected");
                        }
                    }
                )
                .subscribe((status) => {
                    console.log('Realtime subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        console.log('Successfully subscribed to profile updates');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('Error subscribing to profile updates');
                    }
                });

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user, authLoading, navigate]);

    const handleBackToLogin = async () => {
        try {
            await signOut();
            navigate("/");
        } catch (error) {
            console.error("Error signing out:", error);
            navigate("/");
        }
    };

    const getApprovalIcon = () => {
        switch (profile?.approval_status) {
            case 'approved':
                return <CheckCircle className="w-8 h-8 text-green-500" />;
            case 'rejected':
                return <AlertCircle className="w-8 h-8 text-red-500" />;
            default:
                return <Clock className="w-8 h-8 text-yellow-500" />;
        }
    };

    const getApprovalText = () => {
        switch (profile?.approval_status) {
            case 'approved':
                return "Application Approved!";
            case 'rejected':
                return "Application Rejected";
            default:
                return "Pending Approval";
        }
    };

    const getApprovalDescription = () => {
        switch (profile?.approval_status) {
            case 'approved':
                return "Your application has been approved. You can now access the dashboard.";
            case 'rejected':
                return "Your application has been rejected. Please contact support for more information.";
            default:
                return "Your application is under review. This usually takes 24-72 hours.";
        }
    };

    const getApprovalColor = () => {
        switch (profile?.approval_status) {
            case 'approved':
                return "bg-green-50 text-green-700 border-green-100";
            case 'rejected':
                return "bg-red-50 text-red-700 border-red-100";
            default:
                return "bg-yellow-50 text-yellow-700 border-yellow-100";
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin':
                return "bg-red-50 text-red-700 border-red-100";
            case 'user':
                return "bg-blue-50 text-blue-700 border-blue-100";
            default:
                return "bg-gray-50 text-gray-700 border-gray-100";
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin':
                return 'Admin';
            case 'user':
                return 'User';
            default:
                return role;
        }
    };


    // Show loading spinner while auth is loading or profile is being fetched
    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading your approval status...</p>
                </div>
            </div>
        );
    }

    // If no user after loading, show error
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Session Expired</h2>
                    <p className="text-gray-600 mb-4">Please log in again to view your approval status.</p>
                    <button
                        onClick={() => navigate("/login")}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md transition"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Profile Not Found</h2>
                    <p className="text-gray-600 mb-4">Please complete your profile first.</p>
                    <button
                        onClick={() => navigate("/profile-completion")}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
                    >
                        Complete Profile
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
                <div className="w-full max-w-2xl p-8 bg-white rounded-xl shadow-lg border border-gray-100">
                    <div className="flex flex-col items-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                            {getApprovalIcon()}
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-2">{getApprovalText()}</h2>
                        <p className="text-gray-600 text-center max-w-md">{getApprovalDescription()}</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className={`p-4 rounded-lg border ${getApprovalColor()} mb-6`}>
                        <div className="flex items-center gap-2 mb-3">
                            {getApprovalIcon()}
                            <span className="font-medium">{getApprovalText()}</span>
                        </div>

                        {profile.status === 'hold' && (
                            <div className="space-y-2 text-sm">
                                <p>• Your account is temporarily on hold</p>
                                <p>• Please contact support for more information</p>
                                <p>• Your account will be activated after the hold is lifted</p>
                            </div>
                        )}

                        {profile.status === 'suspend' && (
                            <div className="space-y-2 text-sm">
                                <p>• Your account has been suspended indefinitely</p>
                                <p>• Please contact support for assistance</p>
                                <p>• You cannot access the system until suspension is lifted</p>
                            </div>
                        )}

                        {profile.status === 'active' && (
                            <div className="space-y-2 text-sm">
                                <p>• Your account is active and fully functional</p>
                                <p>• You can access all dashboard features</p>
                                <p>• Welcome to the system!</p>
                            </div>
                        )}

                        {profile.approval_status === 'approved' && profile.employee_id && (
                            <div className="space-y-2 text-sm">
                                <p><strong>Employee ID:</strong> {profile.employee_id}</p>
                                <p>• You can now access all dashboard features</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Profile Details
                        </h3>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Name:</span>
                                <span className="text-sm text-gray-600">{profile.user_name || "Not set"}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Email:</span>
                                <span className="text-sm text-gray-600">{profile.email}</span>
                            </div>

                            {profile.contact_no && (
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-medium">Contact:</span>
                                    <span className="text-sm text-gray-600">{profile.contact_no}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Role:</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(profile.role)}`}>
                                    {getRoleLabel(profile.role)}
                                </span>
                            </div>

                            {profile.employee_id && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Employee ID:</span>
                                    <span className="text-sm text-gray-600">{profile.employee_id}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Account Created:</span>
                                <span className="text-sm text-gray-600">{new Date(profile.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {profile.approval_status === 'pending' && (
                        <div className="text-center space-y-4">
                            <button
                                onClick={handleBackToLogin}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md transition"
                            >
                                Back to Login
                            </button>

                            <p className="text-gray-500 text-sm">
                                You can check this page again later to see your approval status.
                            </p>
                        </div>
                    )}

                    {profile.approval_status === 'approved' && (
                        <div className="text-center">
                            <button
                                onClick={() => {
                                    localStorage.setItem("isAuthenticated", "true");
                                    navigate("/dashboard");
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )}

                    {profile.approval_status === 'rejected' && (
                        <div className="text-center space-y-4">
                            <button
                                onClick={handleBackToLogin}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md transition"
                            >
                                Back to Login
                            </button>

                            <p className="text-gray-500 text-sm">
                                Your application has been rejected. Please contact support for more information.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {/* New user setup modal removed */}
        </>
    );
};

export default ApprovalPending; 