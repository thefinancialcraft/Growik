import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Plus, Trash2, Shield, CheckCircle, XCircle, Clock, MoreVertical, Settings2, Circle, Search, Users as UsersIcon, UserCheck, UserX, UserPlus, Activity } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  user_id: string;
  email: string;
  user_name?: string;
  contact_no?: string;
  employee_id?: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'hold' | 'suspend';
  approval_status: 'pending' | 'approved' | 'rejected';
  super_admin?: boolean;
  status_reason?: string;
  hold_duration_days?: number;
  hold_end_time?: string;
  created_at: string;
  updated_at: string;
  is_online?: boolean;
  last_seen?: string;
}

const Users = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "user" | "admin" | "super_admin">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "hold" | "suspend">("all");
  const [filterApproval, setFilterApproval] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    contactNo: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [formError, setFormError] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserEmail, setDeleteUserEmail] = useState<string>("");
  const [deleteUserName, setDeleteUserName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Status change dialog state
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    userId: string;
    newStatus: 'active' | 'hold' | 'suspend';
    userName: string;
  } | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [holdDurationType, setHoldDurationType] = useState<'1day' | '2days' | '3days' | 'custom'>('1day');
  const [customHoldDate, setCustomHoldDate] = useState("");
  const [customHoldTime, setCustomHoldTime] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Format last seen time
  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return "Never";
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return lastSeenDate.toLocaleDateString();
  };

  // Check if user is currently online (within last 1 minute)
  const isUserCurrentlyOnline = (userData: User) => {
    // Always prioritize last_seen over presence state
    if (userData.last_seen) {
      const lastSeenDate = new Date(userData.last_seen);
      const now = new Date();
      
      // Check if last_seen is a valid date
      if (isNaN(lastSeenDate.getTime())) {
        // Invalid date, fallback to presence state
        return userData.is_online === true;
      }
      
      const diffMs = now.getTime() - lastSeenDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      // If last_seen is in the future (negative diff), consider offline
      if (diffMs < 0) {
        console.log(`User ${userData.user_name || userData.email}: last_seen is in future, marking offline`);
        return false;
      }
      
      // If last_seen is more than 1 minute old, consider them inactive/offline
      if (diffMins > 1) {
        return false;
      }
      
      // If last_seen is within 1 minute, consider them online
      return diffMins <= 1;
    }
    
    // Fallback: if no last_seen, use presence state
    return userData.is_online === true;
  };

  // Update last seen timestamp for current user (only when tab is visible and user is active)
  useEffect(() => {
    if (!user?.id) return;

    let activityTimeout: NodeJS.Timeout | null = null;
    let isActive = true; // Track if user is active (has interacted in last 1 minute)

    const updateLastSeen = async () => {
      // Only update if tab is visible AND user is active
      if (document.visibilityState === 'hidden' || !isActive) {
        return;
      }

      try {
        await supabase
          .from('user_profiles')
          // @ts-ignore - last_seen column may not be in types
          .update({ last_seen: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error updating last_seen:', error);
      }
    };

    // Reset activity flag and update timestamp
    const resetActivity = () => {
      isActive = true;
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
      
      // Clear existing timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // Set new timeout - mark as inactive after 1 minute
      activityTimeout = setTimeout(() => {
        isActive = false;
        console.log('User inactive for 1 minute, stopping last_seen updates');
      }, 1 * 60 * 1000); // 1 minute
    };

    // Track mouse movements
    const handleMouseMove = () => {
      resetActivity();
    };

    // Track keyboard activity
    const handleKeyPress = () => {
      resetActivity();
    };

    // Track clicks
    const handleClick = () => {
      resetActivity();
    };

    // Track scroll
    const handleScroll = () => {
      resetActivity();
    };

    // Initial activity reset
    resetActivity();

    // Update every 30 seconds (only when tab is visible and user is active)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && isActive) {
        updateLastSeen();
      }
    }, 30000);

    // Listen for visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset activity when tab becomes visible
        resetActivity();
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    return () => {
      clearInterval(interval);
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user?.id]);

  // Set up Realtime Presence to track online users
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Track current user as online
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUserIds = new Set<string>();
        
        // Extract user_ids from presence state
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((presence: any) => {
            if (presence.user_id) {
              onlineUserIds.add(presence.user_id);
            }
          });
        });

        console.log('Presence sync - Online users:', Array.from(onlineUserIds));
        setOnlineUsers(onlineUserIds);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const state = channel.presenceState();
        const onlineUserIds = new Set<string>();
        
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((presence: any) => {
            if (presence.user_id) {
              onlineUserIds.add(presence.user_id);
            }
          });
        });

        console.log('User joined - Online users:', Array.from(onlineUserIds));
        setOnlineUsers(onlineUserIds);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const state = channel.presenceState();
        const onlineUserIds = new Set<string>();
        
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((presence: any) => {
            if (presence.user_id) {
              onlineUserIds.add(presence.user_id);
            }
          });
        });

        console.log('User left - Online users:', Array.from(onlineUserIds));
        setOnlineUsers(onlineUserIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Presence channel subscribed, tracking user:', user.id);
          // Track current user as online
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
          console.log('User tracked as online');
        }
      });

    return () => {
      console.log('Unsubscribing from presence channel');
      channel.unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id) return;

      try {
        // Check if user is admin or super admin
        const { data: currentUser } = await supabase
          .from('user_profiles')
          .select('role, super_admin')
          .eq('user_id', user.id)
          .maybeSingle() as { data: { role: string; super_admin: boolean } | null };

        if (!currentUser || (currentUser.role !== 'admin' && !currentUser.super_admin)) {
          toast({
            title: "Access Denied",
            description: "Only administrators can access this page.",
            variant: "destructive",
          });
          navigate('/dashboard');
          return;
        }

        // Fetch all users (admin can see all)
        console.log("=== FETCHING ALL USERS ===");
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        console.log("Users fetch result:", { data, error });
        console.log("Number of users fetched:", data?.length || 0);

        if (error) {
          console.error("Error fetching users:", error);
          console.error("Error details:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }

        if (data) {
          console.log("Setting users:", data.length);
          console.log("Current online users:", Array.from(onlineUsers));
          // Map online status from presence
          const usersWithOnlineStatus = (data as User[]).map((userData) => {
            const isOnline = onlineUsers.has(userData.user_id);
            console.log(`User ${userData.user_name || userData.email}: user_id=${userData.user_id}, is_online=${isOnline}`);
            return {
              ...userData,
              is_online: isOnline,
            };
          });
          setUsers(usersWithOnlineStatus);
        } else {
          console.warn("No data returned from users query");
          setUsers([]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: "Error",
          description: "Failed to fetch users.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user, navigate, toast, onlineUsers]);

  // Update users' online status when onlineUsers changes
  useEffect(() => {
    if (users.length === 0) return;
    
    console.log('Updating users online status. Online users:', Array.from(onlineUsers));
    setUsers(prevUsers => {
      const updated = prevUsers.map(userData => {
        const isOnline = onlineUsers.has(userData.user_id);
        console.log(`User ${userData.user_name || userData.email}: is_online=${isOnline}, user_id=${userData.user_id}`);
        return {
          ...userData,
          is_online: isOnline,
        };
      });
      return updated;
    });
  }, [onlineUsers]);

  // Set up real-time subscription for last_seen updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user_profiles_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          const updatedUser = payload.new as User;
          setUsers(prevUsers =>
            prevUsers.map(u => {
              // Only update last_seen, preserve is_online status from presence
              const isOnline = onlineUsers.has(u.user_id);
              return u.user_id === updatedUser.user_id
                ? { ...u, last_seen: updatedUser.last_seen, is_online: isOnline }
                : { ...u, is_online: onlineUsers.has(u.user_id) }; // Also update is_online for all users
            })
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, onlineUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setFormError("");
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.contactNo || !formData.email || !formData.password || !formData.confirmPassword) {
      setFormError("All fields are required.");
      return;
    }

    // First name validation
    if (formData.firstName.trim().length < 2) {
      setFormError("First name must be at least 2 characters long.");
      return;
    }

    // Last name validation
    if (formData.lastName.trim().length < 2) {
      setFormError("Last name must be at least 2 characters long.");
      return;
    }

    // Contact number validation
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(formData.contactNo.replace(/\s/g, ''))) {
      setFormError("Please enter a valid contact number.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setIsAddingUser(true);

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
        setFormError(signUpError.message || "Failed to create user. Please try again.");
        setIsAddingUser(false);
        return;
      }

      if (data.user) {
        // Wait a moment for the trigger to create the profile, then update it
        const updateProfile = async (retries = 5) => {
          for (let i = 0; i < retries; i++) {
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const { error: profileError } = await supabase
                .from('user_profiles')
                // @ts-ignore - Supabase type inference issue with update method
                .update({
                  user_name: fullName,
                  contact_no: formData.contactNo.trim()
                })
                .eq('user_id', data.user.id);

              if (!profileError) {
                return; // Success
              }

              // If profile doesn't exist yet, retry
              if (profileError.code === 'PGRST116' && i < retries - 1) {
                continue;
              }

              console.error('Error updating profile:', profileError);
            } catch (profileUpdateError) {
              console.error('Profile update error:', profileUpdateError);
            }
          }
        };

        await updateProfile();

        // Refresh users list
        const { data: updatedUsers, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!fetchError && updatedUsers) {
          setUsers(updatedUsers as User[]);
        }

        toast({
          title: "User created",
          description: `User ${fullName} has been created successfully.`,
        });

        // Reset form and close dialog
        setFormData({
          firstName: "",
          lastName: "",
          contactNo: "",
          email: "",
          password: "",
          confirmPassword: ""
        });
        setIsAddUserOpen(false);
      } else {
        setFormError("Failed to create user. Please try again.");
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId && !deleteUserEmail) return;

    setIsDeleting(true);
    try {
      // Find target user - either by user_id or email
      const targetUser = deleteUserId 
        ? users.find(u => u.user_id === deleteUserId)
        : users.find(u => u.email === deleteUserEmail);
      
      if (targetUser?.super_admin) {
        toast({
          title: "Cannot delete super admin",
          description: "Super admin users cannot be deleted.",
          variant: "destructive",
        });
        setIsDeleting(false);
        setDeleteUserId(null);
        setDeleteUserEmail("");
        return;
      }

      // Check if admin client is available
      if (!supabaseAdmin) {
        toast({
          title: "Service key required",
          description: "Service key is required to delete users. Please add VITE_SUPABASE_SERVICE_KEY to your .env file.",
          variant: "destructive",
        });
        setIsDeleting(false);
        return;
      }

      // Determine actual user_id
      let actualUserId: string | null = deleteUserId;
      
      // If we only have email, find user_id
      if (!actualUserId && deleteUserEmail) {
        // Try to find in user_profiles first
        const { data: profileByEmail } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id')
          .eq('email', deleteUserEmail)
          .maybeSingle() as { data: { user_id: string } | null };
        
        if (profileByEmail?.user_id) {
          actualUserId = profileByEmail.user_id;
        } else {
          // Try to find in auth.users by email
          try {
            const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
            const foundUser = authUsers?.users?.find((u: any) => u.email === deleteUserEmail);
            if (foundUser) {
              actualUserId = foundUser.id;
            }
          } catch (err) {
            console.warn('Error finding user by email:', err);
          }
        }
      }

      if (!actualUserId) {
        throw new Error('User ID not found. Cannot delete user.');
      }

      console.log('=== DELETING USER ===');
      console.log('User ID:', actualUserId);
      console.log('User Email:', deleteUserEmail || targetUser?.email);
      console.log('User Name:', deleteUserName);

      // Step 1: Delete from user_profiles first (using admin client)
      let profileDeleted = false;
      try {
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .delete()
          .eq('user_id', actualUserId);
        
        if (profileError) {
          console.error('Error deleting from user_profiles:', profileError);
          // If error is "not found", consider it deleted
          if (profileError.code !== 'PGRST116' && !profileError.message?.includes('not found')) {
            throw new Error(`Failed to delete from user_profiles: ${profileError.message}`);
          }
        }
        profileDeleted = true;
        console.log('Successfully deleted from user_profiles');
      } catch (profileErr: any) {
        console.error('Profile delete error:', profileErr);
        // Continue with auth deletion even if profile deletion fails
      }

      // Step 2: Delete from auth.users using Admin API (using admin client)
      let authDeleted = false;
      try {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(actualUserId);
        
        if (authError) {
          console.error('Error deleting from auth.users:', authError);
          // If error is "not found", user is already deleted
          if (authError.message && (
            authError.message.toLowerCase().includes('not found') ||
            authError.message.toLowerCase().includes('does not exist') ||
            authError.message.toLowerCase().includes('user not found')
          )) {
            authDeleted = true;
            console.log('User already deleted from auth.users');
          } else {
            throw new Error(`Failed to delete from auth.users: ${authError.message}`);
          }
        } else {
          authDeleted = true;
          console.log('Successfully deleted from auth.users');
        }
      } catch (authErr: any) {
        console.error('Auth delete error:', authErr);
        // If error is "not found", user is already deleted
        if (authErr?.message && (
          authErr.message.toLowerCase().includes('not found') ||
          authErr.message.toLowerCase().includes('does not exist')
        )) {
          authDeleted = true;
          console.log('User already deleted from auth.users (from exception)');
        } else {
          throw new Error(`Failed to delete from auth.users: ${authErr?.message || 'Unknown error'}`);
        }
      }

      // Step 3: Wait a moment for cascade operations to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Verify deletion
      let profileVerified = false;
      let authVerified = false;

      // Verify user_profiles deletion
      try {
        const { data: profileCheck } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('user_id', actualUserId)
          .maybeSingle();
        profileVerified = !profileCheck;
      } catch (err) {
        console.warn('Profile verification error:', err);
        profileVerified = profileDeleted; // Assume deleted if we got here
      }

      // Verify auth.users deletion
      try {
        const { data: authUser, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(actualUserId);
        if (authCheckError) {
          // If error contains "not found", user is deleted
          if (authCheckError.message.toLowerCase().includes('not found') || 
              authCheckError.message.toLowerCase().includes('does not exist')) {
            authVerified = true;
          }
        } else {
          authVerified = !authUser || !authUser.user;
        }
      } catch (err: any) {
        // If error is "not found", user is deleted
        if (err?.message?.toLowerCase().includes('not found') || 
            err?.message?.toLowerCase().includes('does not exist')) {
          authVerified = true;
        }
      }

      // Success if at least one deletion succeeded
      if (profileDeleted || authDeleted || profileVerified || authVerified) {
        // Remove user from local state
        setUsers(users.filter(u => 
          (deleteUserId && u.user_id === deleteUserId) || 
          (deleteUserEmail && u.email === deleteUserEmail) ||
          (actualUserId && u.user_id === actualUserId)
        ));
        
        toast({
          title: "User deleted successfully",
          description: `User ${deleteUserName} has been completely removed from the system.`,
        });

        setDeleteUserId(null);
        setDeleteUserEmail("");
        setDeleteUserName("");
      } else {
        throw new Error('Failed to verify user deletion. User may still exist in the system.');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'hold' | 'suspend') => {
    // Find target user
    const targetUser = users.find(u => u.user_id === userId);
    
    if (!targetUser) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }

    // Prevent status change if user is not approved or rejected
    if (targetUser.approval_status === 'pending') {
      toast({
        title: "Cannot change status",
        description: "User must be approved or rejected before changing status.",
        variant: "destructive",
      });
      return;
    }

    // Check if user is super admin
    if (targetUser?.super_admin && (newStatus === 'suspend' || newStatus === 'hold')) {
      toast({
        title: "Cannot modify super admin",
        description: "Super admin accounts cannot be suspended or put on hold.",
        variant: "destructive",
      });
      return;
    }

    // If status is not changing, don't show dialog
    if (targetUser.status === newStatus) {
      return;
    }

    // Open dialog to ask for reason
    setPendingStatusChange({
      userId,
      newStatus,
      userName: targetUser.user_name || targetUser.email || "User"
    });
    setStatusReason("");
    setIsStatusDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;

    if (!statusReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for the status change.",
        variant: "destructive",
      });
      return;
    }

    // Validate hold duration if status is "hold"
    if (pendingStatusChange.newStatus === 'hold') {
      if (holdDurationType === 'custom') {
        if (!customHoldDate || !customHoldTime) {
          toast({
            title: "Hold duration required",
            description: "Please select a custom date and time for hold duration.",
            variant: "destructive",
          });
          return;
        }
        
        // Validate custom date is in future
        const customDateTime = new Date(`${customHoldDate}T${customHoldTime}`);
        if (customDateTime <= new Date()) {
          toast({
            title: "Invalid date",
            description: "Hold end time must be in the future.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    try {
      const { userId, newStatus } = pendingStatusChange;
      
      console.log('=== HANDLE STATUS CHANGE ===');
      console.log('User ID:', userId);
      console.log('New Status:', newStatus);
      console.log('Reason:', statusReason);
      console.log('Hold Duration Type:', holdDurationType);
      console.log('Current logged-in user:', user?.id);
      
      // Verify current user is admin/super_admin
      if (!user?.id) {
        throw new Error('You must be logged in to update user status');
      }

      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('role, super_admin')
        .eq('user_id', user.id)
        .maybeSingle() as { data: { role: string; super_admin: boolean } | null };

      if (!currentUserProfile) {
        throw new Error('User profile not found');
      }

      const isAdmin = currentUserProfile.role === 'admin' || currentUserProfile.role === 'super_admin' || currentUserProfile.super_admin === true;
      
      if (!isAdmin) {
        throw new Error('Only administrators can update user status');
      }

      console.log('Current user is admin:', isAdmin);
      
      // Check if user is super admin
      const targetUser = users.find(u => u.user_id === userId);
      console.log('Target User:', targetUser);
      
      if (targetUser?.super_admin && (newStatus === 'suspend' || newStatus === 'hold')) {
        toast({
          title: "Cannot modify super admin",
          description: "Super admin accounts cannot be suspended or put on hold.",
          variant: "destructive",
        });
        setIsStatusDialogOpen(false);
        setPendingStatusChange(null);
        setStatusReason("");
        return;
      }

      // Use the profile id (primary key) instead of user_id for update
      const profileId = targetUser?.id;
      if (!profileId) {
        throw new Error('Profile ID not found');
      }

      // Calculate hold_end_time and hold_duration_days if status is "hold"
      let holdEndTime: string | null = null;
      let holdDurationDays: number | null = null;

      if (newStatus === 'hold') {
        const now = new Date();
        let endTime: Date;

        if (holdDurationType === '1day') {
          endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          holdDurationDays = 1;
        } else if (holdDurationType === '2days') {
          endTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
          holdDurationDays = 2;
        } else if (holdDurationType === '3days') {
          endTime = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          holdDurationDays = 3;
        } else {
          // custom
          endTime = new Date(`${customHoldDate}T${customHoldTime}`);
          const diffTime = endTime.getTime() - now.getTime();
          holdDurationDays = Math.ceil(diffTime / (24 * 60 * 60 * 1000));
        }

        holdEndTime = endTime.toISOString();
        console.log('Hold end time:', holdEndTime);
        console.log('Hold duration days:', holdDurationDays);
      } else {
        // Clear hold fields if status is not "hold"
        holdEndTime = null;
        holdDurationDays = null;
      }

      console.log('Calling supabase update with profile ID:', profileId);
      const updateData: any = { 
        status: newStatus,
        status_reason: statusReason.trim()
      };

      if (newStatus === 'hold') {
        updateData.hold_end_time = holdEndTime;
        updateData.hold_duration_days = holdDurationDays;
      } else {
        // Clear hold fields when status changes away from hold
        updateData.hold_end_time = null;
        updateData.hold_duration_days = null;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        // @ts-ignore - Supabase type inference issue with update method
        .update(updateData)
        .eq('id', profileId)
        .select();

      console.log('Update response - data:', data);
      console.log('Update response - error:', error);

      if (error) {
        console.error('Update error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('Update returned no rows. This might be an RLS policy issue.');
        console.warn('Trying alternative update method...');
        
        // Try updating by user_id as fallback
        const fallbackUpdateData: any = { 
          status: newStatus,
          status_reason: statusReason.trim()
        };

        if (newStatus === 'hold') {
          fallbackUpdateData.hold_end_time = holdEndTime;
          fallbackUpdateData.hold_duration_days = holdDurationDays;
        } else {
          fallbackUpdateData.hold_end_time = null;
          fallbackUpdateData.hold_duration_days = null;
        }

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_profiles')
          // @ts-ignore - Supabase type inference issue with update method
          .update(fallbackUpdateData)
          .eq('user_id', userId)
          .select();
        
        console.log('Fallback update response - data:', fallbackData);
        console.log('Fallback update response - error:', fallbackError);
        
        if (fallbackError || !fallbackData || fallbackData.length === 0) {
          throw new Error('Update failed: RLS policy may be blocking the update. Please check admin permissions in Supabase.');
        }
        
        // Use fallback data
        const updatedData = fallbackData;
        console.log('Fallback update succeeded');
      }

      // Refresh users list to get updated data from database
      const { data: updatedUsers, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchError && updatedUsers) {
        console.log('Refreshed users list:', updatedUsers.length);
        setUsers(updatedUsers as User[]);
      } else {
        console.warn('Failed to refresh users list, updating local state');
        // Fallback: update local state
        setUsers(users.map(u => 
          u.user_id === userId ? { ...u, status: newStatus, status_reason: statusReason.trim() } : u
        ));
      }

      toast({
        title: "Status updated",
        description: `User status changed to ${newStatus}`,
      });

      // Close dialog and reset form
      setIsStatusDialogOpen(false);
      setPendingStatusChange(null);
      setStatusReason("");
      setHoldDurationType('1day');
      setCustomHoldDate("");
      setCustomHoldTime("");
    } catch (error: any) {
      console.error('=== ERROR UPDATING STATUS ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: error.message || "Failed to update user status.",
        variant: "destructive",
      });
    }
  };

  // Function to generate next user ID in GRWK-XXX format
  const generateNextUserId = async (): Promise<string> => {
    try {
      // Fetch all users with employee_id (fetch all and filter in JavaScript)
      const { data: allUsers, error } = await supabase
        .from('user_profiles')
        .select('employee_id');

      if (error) {
        console.error('Error fetching users for ID generation:', error);
        throw error;
      }

      // Extract numbers from existing IDs that match GRWK-XXX format
      const existingNumbers: number[] = [];
      if (allUsers && allUsers.length > 0) {
        (allUsers as Array<{ employee_id?: string | null }>).forEach(user => {
          if (user.employee_id && typeof user.employee_id === 'string') {
            const match = user.employee_id.match(/^GRWK-(\d+)$/);
            if (match && match[1]) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num)) {
                existingNumbers.push(num);
              }
            }
          }
        });
      }

      // Find the next available number
      let nextNumber = 1;
      if (existingNumbers.length > 0) {
        const maxNumber = Math.max(...existingNumbers);
        nextNumber = maxNumber + 1;
      }

      // Format as GRWK-XXX (3 digits with leading zeros)
      return `GRWK-${nextNumber.toString().padStart(3, '0')}`;
    } catch (error: any) {
      console.error('Error generating user ID:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details
      });
      // Fallback: generate based on current timestamp if query fails
      const timestamp = Date.now();
      return `GRWK-${(timestamp % 1000).toString().padStart(3, '0')}`;
    }
  };

  const handleApprovalChange = async (userId: string, newApproval: 'pending' | 'approved' | 'rejected') => {
    try {
      console.log('=== HANDLE APPROVAL CHANGE ===');
      console.log('User ID:', userId);
      console.log('New Approval Status:', newApproval);
      
      // Check if user is super admin
      const targetUser = users.find(u => u.user_id === userId);
      console.log('Target User:', targetUser);
      
      if (targetUser?.super_admin && newApproval === 'rejected') {
        toast({
          title: "Cannot modify super admin",
          description: "Super admin accounts cannot be rejected.",
          variant: "destructive",
        });
        return;
      }

      // Prevent changing approval status if user is already approved
      if (targetUser?.approval_status === 'approved' && newApproval !== 'approved') {
        toast({
          title: "Cannot change approval status",
          description: "Approved users cannot have their approval status changed.",
          variant: "destructive",
        });
        return;
      }

      // Use the profile id (primary key) instead of user_id for update
      const profileId = targetUser?.id;
      if (!profileId) {
        throw new Error('Profile ID not found');
      }

      // If approving user and they don't have employee_id yet, assign one
      let updateData: any = { approval_status: newApproval };
      
      if (newApproval === 'approved' && targetUser && !targetUser.employee_id) {
        console.log('Generating employee ID...');
        const newEmployeeId = await generateNextUserId();
        updateData.employee_id = newEmployeeId;
        console.log('Generated Employee ID:', newEmployeeId);
      }

      console.log('Update data:', updateData);
      console.log('Calling supabase update with profile ID:', profileId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        // @ts-ignore - Supabase type inference issue with update method
        .update(updateData)
        .eq('id', profileId)
        .select();

      console.log('Update response - data:', data);
      console.log('Update response - error:', error);

      if (error) {
        console.error('Update error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('Update returned no rows. This might be an RLS policy issue.');
        console.warn('Trying alternative update method...');
        
        // Try updating by user_id as fallback
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_profiles')
          // @ts-ignore - Supabase type inference issue with update method
          .update(updateData)
          .eq('user_id', userId)
          .select();
        
        console.log('Fallback update response - data:', fallbackData);
        console.log('Fallback update response - error:', fallbackError);
        
        if (fallbackError || !fallbackData || fallbackData.length === 0) {
          throw new Error('Update failed: RLS policy may be blocking the update. Please check admin permissions.');
        }
        
        console.log('Fallback update succeeded');
      }

      // Refresh users list to get updated data
      console.log('Refreshing users list...');
      const { data: updatedUsers, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchError && updatedUsers) {
        console.log('Refreshed users list:', updatedUsers.length);
        setUsers(updatedUsers as User[]);
      } else {
        console.warn('Failed to refresh users list, updating local state');
        console.error('Fetch error:', fetchError);
        // Fallback: update local state
        setUsers(users.map(u => 
          u.user_id === userId ? { ...u, approval_status: newApproval, ...(updateData.employee_id ? { employee_id: updateData.employee_id } : {}) } : u
        ));
      }

      toast({
        title: "Approval updated",
        description: newApproval === 'approved' && updateData.employee_id 
          ? `User approved and assigned ID: ${updateData.employee_id}`
          : `User approval status changed to ${newApproval}`,
      });
    } catch (error: any) {
      console.error('=== ERROR UPDATING APPROVAL ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error.details);
      toast({
        title: "Error",
        description: error.message || "Failed to update approval status.",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === "all" || 
      (filterRole === "super_admin" && u.super_admin) ||
      (filterRole !== "super_admin" && u.role === filterRole && !u.super_admin);
    const matchesStatus = filterStatus === "all" || u.status === filterStatus;
    const matchesApproval = filterApproval === "all" || u.approval_status === filterApproval;

    return matchesSearch && matchesRole && matchesStatus && matchesApproval;
  });

  const {
    totalUsers: totalUsersCount,
    activeUsers,
    holdUsers,
    suspendedUsers,
    onlineCount,
    pendingApprovals,
  } = useMemo(() => {
    const summary = {
      totalUsers: users.length,
      activeUsers: 0,
      holdUsers: 0,
      suspendedUsers: 0,
      pendingApprovals: 0,
      onlineCount: onlineUsers.size,
    };

    users.forEach((u) => {
      if (u.status === 'active') summary.activeUsers += 1;
      if (u.status === 'hold') summary.holdUsers += 1;
      if (u.status === 'suspend') summary.suspendedUsers += 1;
      if (u.approval_status === 'pending') summary.pendingApprovals += 1;
    });

    return summary;
  }, [users, onlineUsers]);

  const statTiles = useMemo(
    () => [
      {
        label: 'Total Users',
        value: totalUsersCount,
        subtext: 'All registered accounts',
        icon: UsersIcon,
      },
      {
        label: 'Active',
        value: activeUsers,
        subtext: 'Currently active status',
        icon: UserCheck,
      },
      {
        label: 'On Hold',
        value: holdUsers,
        subtext: 'Temporarily paused',
        icon: Clock,
      },
      {
        label: 'Suspended',
        value: suspendedUsers,
        subtext: 'Awaiting review',
        icon: UserX,
      },
      {
        label: 'Pending',
        value: pendingApprovals,
        subtext: 'Awaiting approval',
        icon: UserPlus,
      },
      {
        label: 'Online',
        value: onlineCount,
        subtext: 'Active in last minute',
        icon: Activity,
      },
    ],
    [totalUsersCount, activeUsers, holdUsers, suspendedUsers, pendingApprovals, onlineCount],
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-700 border-green-200';
      case 'hold': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'suspend': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getApprovalColor = (approval: string) => {
    switch (approval) {
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getRoleColor = (role: string, superAdmin?: boolean) => {
    if (superAdmin) return 'bg-red-50 text-red-700 border-red-300 font-bold';
    switch (role) {
      case 'admin': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'user': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gradient-subtle">
        <Sidebar />
        <div className="flex-1 lg:ml-56">
          <Header />
          <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 lg:pb-6 animate-fade-in max-w-7xl">
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm sm:text-base">Loading users...</p>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-4 space-y-6 pb-24 lg:pb-8 animate-fade-in max-w-7xl">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-primary text-white ">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_55%)]" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="relative p-6 sm:p-8 space-y-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Control Center</p>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">User Management Dashboard</h1>
                    <p className="text-sm sm:text-base text-white/80 max-w-2xl">
                      Monitor access, update roles, and keep a pulse on your organisation's health with real-time insights.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsAddUserOpen(true)}
                    className="bg-white text-indigo-600 hover:bg-white/90 shadow-lg h-11 px-5 rounded-full font-semibold flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Add User
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                  {statTiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                      <div
                        key={tile.label}
                        className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur px-4 py-4 shadow-lg transition-transform duration-200 hover:-translate-y-1"
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/10" />
                        <div className="relative flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/25 shadow-inner">
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-white/70">{tile.label}</p>
                            <p className="text-lg font-semibold">{tile.value}</p>
                            <p className="text-[11px] text-white/70">{tile.subtext}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Card className="border outline-indigo-200 bg-white/90 backdrop-blur">
              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or employee ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-9 pr-4 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <Badge className="w-fit rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                    Showing {filteredUsers.length} of {totalUsersCount} users
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</Label>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value as any)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="all">All roles</option>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</Label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="hold">Hold</option>
                      <option value="suspend">Suspended</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval</Label>
                    <select
                      value={filterApproval}
                      onChange={(e) => setFilterApproval(e.target.value as any)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="all">All approvals</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Online</Label>
                    <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-600 ">
                      <span className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75"></span>
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        </span>
                        {onlineCount} users active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredUsers.map((userData) => (
                <Card
                  key={userData.id}
                  className="p-4 bg-card hover:shadow-lg transition-all duration-300 border-border/50 hover:scale-[1.02] flex flex-col"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 ">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-sm font-semibold text-white ]">
                          {userData.user_name?.charAt(0).toUpperCase() || userData.email?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="space-y-1 ">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                            {userData.employee_id || userData.user_id?.slice(0, 8) || '—'}
                          </p>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {userData.user_name || userData.email || "Unknown User"}
                            </h3>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-medium",
                                isUserCurrentlyOnline(userData) ? 'text-emerald-600' : 'text-slate-400'
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-block h-2.5 w-2.5 rounded-full ",
                                  isUserCurrentlyOnline(userData) ? 'bg-emerald-500' : 'bg-slate-300'
                                )}
                              />
                              {isUserCurrentlyOnline(userData)
                                ? 'Online'
                                : userData.last_seen
                                  ? `Offline · ${formatLastSeen(userData.last_seen)}`
                                  : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex pt-2 items-center gap-2 flex-wrap justify-end ">
                        <Badge className={cn("rounded-full px-3 py-1 text-xs", getRoleColor(userData.role, userData.super_admin))}>
                          {userData.super_admin ? 'Super Admin' : userData.role}
                        </Badge>
                        <Badge className={cn("rounded-full px-3 py-1 text-xs", getStatusColor(userData.status))}>
                          {userData.status}
                        </Badge>
                        <Badge className={cn("rounded-full px-3 py-1 text-xs", getApprovalColor(userData.approval_status))}>
                          {userData.approval_status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-border/30 pt-4 text-sm text-muted-foreground">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                        <span className="font-medium text-foreground">Email</span>
                        <span>{userData.email || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                        <span className="font-medium text-foreground">Phone</span>
                        <span>{userData.contact_no || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                        <span className="font-medium text-foreground">User ID</span>
                        <span>{userData.user_id || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-3">
                        <span className="font-medium text-foreground">Joined</span>
                        <span>{new Date(userData.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {userData.status_reason && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
                        <span className="font-semibold uppercase tracking-wide text-amber-800">Note:</span>
                        <span className="leading-relaxed">{userData.status_reason}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-border/30 pt-4">
                      {userData.super_admin ? (
                        <Badge variant="destructive" className="rounded-full text-xs">
                          Super admin · status locked
                        </Badge>
                      ) : (
                        <>
                         
                            
                            <select
                              value={userData.status}
                              onChange={(e) => handleStatusChange(userData.user_id, e.target.value as any)}
                              disabled={userData.approval_status === 'pending'}
                              className={cn(
                                "h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200",
                                userData.approval_status === 'pending' && 'cursor-not-allowed opacity-60'
                              )}
                              title={userData.approval_status === 'pending' ? 'User must be approved or rejected before changing status' : ''}
                            >
                              <option value="active">🟢 Active</option>
                              <option value="hold">🟡 Hold</option>
                              <option value="suspend">🔴 Suspend</option>
                            </select>
                          
                         
                            {userData.approval_status !== 'approved' && (
                              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px] text-slate-500 shadow-inner">
                                <span className="font-semibold text-slate-600">Approval</span>
                                <select
                                  value={userData.approval_status}
                                  onChange={(e) => handleApprovalChange(userData.user_id, e.target.value as any)}
                                  className={cn(
                                    "h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                  )}
                                >
                                  <option value="pending">⏳ Pending</option>
                                  <option value="approved">✅ Approved</option>
                                  <option value="rejected">❌ Rejected</option>
                                </select>
                              </div>
                            )}
                         
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (userData.user_id) {
                                setDeleteUserId(userData.user_id);
                                setDeleteUserEmail("");
                              } else {
                                setDeleteUserId(null);
                                setDeleteUserEmail(userData.email);
                              }
                              setDeleteUserName(userData.user_name || userData.email || "User");
                            }}
                            className="h-9 rounded-lg px-3 ml-2 text-xs font-semibold shadow-sm hover:shadow-md"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {filteredUsers.length === 0 && (
              <Card className="border-dashed border-2 border-slate-200 bg-white/80 py-12 shadow-inner text-center">
                <p className="text-sm text-slate-500">
                  No users match the current filters. Try adjusting your search criteria.
                </p>
              </Card>
            )}
          </div>
        </main>
      </div>

      <MobileNav />

      {/* Status Change Reason Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={(open) => {
        setIsStatusDialogOpen(open);
        if (!open) {
          setPendingStatusChange(null);
          setStatusReason("");
          setHoldDurationType('1day');
          setCustomHoldDate("");
          setCustomHoldTime("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Change User Status</DialogTitle>
            <DialogDescription>
              Please provide a reason for changing {pendingStatusChange?.userName}'s status to <strong>{pendingStatusChange?.newStatus}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="statusReason">Reason *</Label>
              <Textarea
                id="statusReason"
                placeholder="Enter the reason for this status change..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This reason will be visible to the user and stored in the system.
              </p>
            </div>

            {/* Hold Duration Options - Only show when status is "hold" */}
            {pendingStatusChange?.newStatus === 'hold' && (
              <div className="space-y-3">
                <Label>Hold Duration *</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="hold1day"
                      name="holdDuration"
                      value="1day"
                      checked={holdDurationType === '1day'}
                      onChange={(e) => setHoldDurationType(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="hold1day" className="font-normal cursor-pointer">1 Day</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="hold2days"
                      name="holdDuration"
                      value="2days"
                      checked={holdDurationType === '2days'}
                      onChange={(e) => setHoldDurationType(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="hold2days" className="font-normal cursor-pointer">2 Days</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="hold3days"
                      name="holdDuration"
                      value="3days"
                      checked={holdDurationType === '3days'}
                      onChange={(e) => setHoldDurationType(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="hold3days" className="font-normal cursor-pointer">3 Days</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="holdCustom"
                      name="holdDuration"
                      value="custom"
                      checked={holdDurationType === 'custom'}
                      onChange={(e) => setHoldDurationType(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="holdCustom" className="font-normal cursor-pointer">Custom Date & Time</Label>
                  </div>
                </div>

                {/* Custom Date/Time Inputs */}
                {holdDurationType === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="customHoldDate">Date *</Label>
                      <Input
                        id="customHoldDate"
                        type="date"
                        value={customHoldDate}
                        onChange={(e) => setCustomHoldDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customHoldTime">Time *</Label>
                      <Input
                        id="customHoldTime"
                        type="time"
                        value={customHoldTime}
                        onChange={(e) => setCustomHoldTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsStatusDialogOpen(false);
                setPendingStatusChange(null);
                setStatusReason("");
                setHoldDurationType('1day');
                setCustomHoldDate("");
                setCustomHoldTime("");
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={!statusReason.trim() || (pendingStatusChange?.newStatus === 'hold' && holdDurationType === 'custom' && (!customHoldDate || !customHoldTime))}
              className="w-full sm:w-auto"
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with all required information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser}>
            <div className="space-y-4 py-4">
              {formError && (
                <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm border border-red-100">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    disabled={isAddingUser}
                    placeholder="First name"
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    disabled={isAddingUser}
                    placeholder="Last name"
                    minLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNo">Contact Number *</Label>
                <Input
                  id="contactNo"
                  name="contactNo"
                  type="tel"
                  value={formData.contactNo}
                  onChange={handleInputChange}
                  required
                  disabled={isAddingUser}
                  placeholder="Enter contact number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={isAddingUser}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    disabled={isAddingUser}
                    placeholder="Enter password (min 6 characters)"
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                    disabled={isAddingUser}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    disabled={isAddingUser}
                    placeholder="Confirm your password"
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                    disabled={isAddingUser}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddUserOpen(false);
                  setFormData({
                    firstName: "",
                    lastName: "",
                    contactNo: "",
                    email: "",
                    password: "",
                    confirmPassword: ""
                  });
                  setFormError("");
                }}
                disabled={isAddingUser}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAddingUser} className="w-full sm:w-auto">
                {isAddingUser ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId || !!deleteUserEmail} onOpenChange={(open) => {
        if (!open) {
          setDeleteUserId(null);
          setDeleteUserEmail("");
          setDeleteUserName("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for{" "}
              <strong>{deleteUserName}</strong> and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Users;

