import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AlertCircle, User, Mail, Phone, Calendar, Briefcase, Badge } from "lucide-react";

interface UserProfile {
    id: string;
    user_name: string;
    email: string;
    contact_no?: string;
    role: 'user' | 'admin' | 'super_admin';
    approval_status: 'pending' | 'approved' | 'rejected';
    status: 'active' | 'hold' | 'suspend';
    employee_id?: string;
    status_reason?: string;
    hold_duration_days?: number;
    hold_end_time?: string;
    super_admin?: boolean;
    created_at: string;
    updated_at: string;
}

const Hold = () => {
    const { user, signOut, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [timeRemaining, setTimeRemaining] = useState<string>("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Calculate time remaining and auto-update status when expired
    useEffect(() => {
        if (!profile?.hold_end_time || !user?.id || isUpdatingStatus) {
            if (!profile?.hold_end_time) {
                setTimeRemaining("");
            }
            return;
        }

        const updateTimer = async () => {
            const now = new Date().getTime();
            const endTime = new Date(profile.hold_end_time!).getTime();
            const difference = endTime - now;

            if (difference <= 0) {
                setTimeRemaining("Hold period expired");
                
                // Auto-update status to active if hold period expired (only for role='user')
                if (profile.status === 'hold' && profile.role === 'user' && !isUpdatingStatus) {
                    setIsUpdatingStatus(true);
                    console.log('Hold period expired, auto-updating status to active');
                    try {
                        const { error: updateError } = await supabase
                            .from('user_profiles')
                            // @ts-ignore - Supabase type inference issue
                            .update({
                                status: 'active',
                                status_reason: 'hold expired account active by system',
                                hold_end_time: null,
                                hold_duration_days: null
                            })
                            .eq('user_id', user.id);

                        if (updateError) {
                            console.error('Error auto-updating status:', updateError);
                            setIsUpdatingStatus(false);
                        } else {
                            console.log('Status auto-updated to active');
                            // Refresh profile to get updated status
                            const { data: updatedData, error: fetchError } = await supabase
                                .from('user_profiles')
                                .select('*')
                                .eq('user_id', user.id)
                                .single();
                            
                            if (!fetchError && updatedData) {
                                const updatedProfile = updatedData as UserProfile;
                                setProfile(updatedProfile);
                                
                                // Redirect if status changed to active
                                if (updatedProfile.status === 'active' && updatedProfile.approval_status === 'approved') {
                                    localStorage.setItem("isAuthenticated", "true");
                                    navigate("/dashboard");
                                }
                            }
                            setIsUpdatingStatus(false);
                        }
                    } catch (error) {
                        console.error('Exception auto-updating status:', error);
                        setIsUpdatingStatus(false);
                    }
                }
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            if (days > 0) {
                setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
            } else if (hours > 0) {
                setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
                setTimeRemaining(`${minutes}m ${seconds}s`);
            } else {
                setTimeRemaining(`${seconds}s`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [profile?.hold_end_time, profile?.status, profile?.role, user?.id, isUpdatingStatus, navigate]);

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

                // Redirect if status changes
                if (userProfile.status === 'active' && userProfile.approval_status === 'approved') {
                    localStorage.setItem("isAuthenticated", "true");
                    navigate("/dashboard");
                } else if (userProfile.status === 'suspend') {
                    navigate("/suspended");
                } else if (userProfile.approval_status === 'rejected') {
                    navigate("/rejected");
                } else if (userProfile.approval_status === 'pending') {
                    navigate("/approval-pending");
                }
            }
        } catch (error) {
            setError("An error occurred while fetching profile data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;

        if (!user && !authLoading) {
            navigate("/login");
            return;
        }

        if (user) {
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

                        // Redirect if status changes
                        if (updatedProfile.status === 'active' && updatedProfile.approval_status === 'approved') {
                            localStorage.setItem("isAuthenticated", "true");
                            navigate("/dashboard");
                        } else if (updatedProfile.status === 'suspend') {
                            navigate("/suspended");
                        } else if (updatedProfile.approval_status === 'rejected') {
                            navigate("/rejected");
                        } else if (updatedProfile.approval_status === 'pending') {
                            navigate("/approval-pending");
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

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Session Expired</h2>
                    <p className="text-gray-600 mb-4">Please log in again.</p>
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
            <div className="w-full max-w-2xl p-8 bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="flex flex-col items-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-50 mb-4">
                        <AlertCircle className="w-8 h-8 text-yellow-500" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-2">Account On Hold</h2>
                    <p className="text-gray-600 text-center max-w-md">
                        Your account is temporarily on hold. Please contact support for more information.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 border border-red-100">
                        {error}
                    </div>
                )}

                <div className="bg-yellow-50 text-yellow-700 border border-yellow-100 p-4 rounded-lg mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Account On Hold</span>
                    </div>
                    <div className="space-y-2 text-sm">
                        <p>• Your account is temporarily on hold</p>
                        <p>• Please contact support for more information</p>
                        <p>• Your account will be activated after the hold is lifted</p>
                        {profile.hold_end_time && timeRemaining && (
                            <div className="mt-3 pt-3 border-t border-yellow-200">
                                <p className="font-semibold">Hold will be lifted in:</p>
                                <p className="text-lg font-bold text-yellow-800 mt-1">{timeRemaining}</p>
                                {profile.hold_end_time && (
                                    <p className="text-xs mt-1 opacity-75">
                                        Until: {new Date(profile.hold_end_time).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
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
                            <span className="text-sm text-gray-600 capitalize">{profile.role || "user"}</span>
                        </div>

                        {profile.employee_id && (
                            <div className="flex items-center gap-2">
                                <Badge className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Employee ID:</span>
                                <span className="text-sm text-gray-600">{profile.employee_id}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium">Account Created:</span>
                            <span className="text-sm text-gray-600">{new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>

                        {profile.status_reason && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                                    <div>
                                        <span className="text-sm font-semibold text-yellow-800">Status Reason:</span>
                                        <p className="text-sm text-yellow-700 mt-1">{profile.status_reason}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-center">
                    <button
                        onClick={handleBackToLogin}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md transition"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Hold;

