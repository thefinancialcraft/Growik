import { useState, useEffect } from "react";
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
import { supabase } from "@/lib/supabase";
// Admin client is not available on the client bundle; guard references
const supabaseAdmin = null as any;
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
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
          setUsers(data as User[]);
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
  }, [user, navigate, toast]);

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

      // Determine which identifier to use (user_id or email)
      const identifierToUse = deleteUserId || deleteUserEmail;
      const useEmail = !deleteUserId && !!deleteUserEmail;
      
      // First, find user_id if we only have email
      let actualUserId: string | null = deleteUserId;
      if (useEmail && supabaseAdmin) {
        // Try to find user_id by email in user_profiles
        const { data: profileByEmail } = await supabaseAdmin
          .from('user_profiles')
          .select('user_id')
          .eq('email', deleteUserEmail)
          .maybeSingle();
        
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

      // First, check where user exists (auth.users or user_profiles)
      let userExistsInAuth = false;
      let userExistsInProfile = false;
      
      if (supabaseAdmin) {
        // Check if user exists in auth.users (by user_id if available, or by email)
        try {
          if (actualUserId) {
            const { data: authUser, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(actualUserId);
            if (!authCheckError && authUser?.user) {
              userExistsInAuth = true;
            }
          } else if (deleteUserEmail) {
            // Try to find by email
            const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
            const foundUser = authUsers?.users?.find((u: any) => u.email === deleteUserEmail);
            if (foundUser) {
              userExistsInAuth = true;
              actualUserId = foundUser.id;
            }
          }
        } catch (err) {
          // User doesn't exist in auth
        }
        
        // Check if user exists in user_profiles (by user_id or email)
        try {
          let profileCheck;
          if (actualUserId) {
            const { data, error } = await supabaseAdmin
              .from('user_profiles')
              .select('id, user_id')
              .eq('user_id', actualUserId)
              .maybeSingle();
            profileCheck = data;
          } else if (deleteUserEmail) {
            const { data, error } = await supabaseAdmin
              .from('user_profiles')
              .select('id, user_id')
              .eq('email', deleteUserEmail)
              .maybeSingle();
            profileCheck = data;
            if (profileCheck?.user_id) {
              actualUserId = profileCheck.user_id;
            }
          }
          
          if (profileCheck) {
            userExistsInProfile = true;
          }
        } catch (err) {
          // User doesn't exist in profile
        }
      }

      // If user doesn't exist in either place, show success (already deleted)
      if (!userExistsInAuth && !userExistsInProfile) {
        setUsers(users.filter(u => 
          (deleteUserId && u.user_id === deleteUserId) || 
          (deleteUserEmail && u.email === deleteUserEmail)
        ));
        toast({
          title: "User already deleted",
          description: `User ${deleteUserName} was not found in either auth.users or user_profiles.`,
        });
        setDeleteUserId(null);
        setDeleteUserEmail("");
        setDeleteUserName("");
        setIsDeleting(false);
        return;
      }

      // Delete from user_profiles if it exists (by user_id or email)
      let profileDeleted = false;
      if (userExistsInProfile && supabaseAdmin) {
        try {
          let profileError;
          if (actualUserId) {
            const { error } = await supabaseAdmin
              .from('user_profiles')
              .delete()
              .eq('user_id', actualUserId);
            profileError = error;
          } else if (deleteUserEmail) {
            const { error } = await supabaseAdmin
              .from('user_profiles')
              .delete()
              .eq('email', deleteUserEmail);
            profileError = error;
          }
          
          if (!profileError) {
            profileDeleted = true;
          }
        } catch (profileErr) {
          console.warn('Profile delete error:', profileErr);
        }
      }

      // Also try with regular client (in case admin client has issues)
      if (!profileDeleted && userExistsInProfile) {
        try {
          let profileError;
          if (actualUserId) {
            const { error } = await supabase
              .from('user_profiles')
              .delete()
              .eq('user_id', actualUserId);
            profileError = error;
          } else if (deleteUserEmail) {
            const { error } = await supabase
              .from('user_profiles')
              .delete()
              .eq('email', deleteUserEmail);
            profileError = error;
          }
          
          if (!profileError) {
            profileDeleted = true;
          }
        } catch (profileErr) {
          console.warn('Profile delete error (regular client):', profileErr);
        }
      }

      // Now delete from auth.users using Admin API (only if user exists there)
      let authDeleted = false;
      let authAlreadyDeleted = !userExistsInAuth; // If user doesn't exist in auth, it's already deleted
      
      if (userExistsInAuth && supabaseAdmin && actualUserId) {
        try {
          const { error: adminError } = await supabaseAdmin.auth.admin.deleteUser(actualUserId);
          if (!adminError) {
            authDeleted = true;
          } else {
            // If error is "User not found", user is already deleted - that's success
            if (adminError.message && (
              adminError.message.toLowerCase().includes('not found') ||
              adminError.message.toLowerCase().includes('does not exist') ||
              adminError.message.toLowerCase().includes('user not found')
            )) {
              authAlreadyDeleted = true;
              authDeleted = true; // Consider as success
            } else {
              console.warn('Admin API delete failed:', adminError);
            }
          }
        } catch (adminErr: any) {
          // If error is "User not found", user is already deleted
          if (adminErr?.message && (
            adminErr.message.toLowerCase().includes('not found') ||
            adminErr.message.toLowerCase().includes('does not exist') ||
            adminErr.message.toLowerCase().includes('user not found')
          )) {
            authAlreadyDeleted = true;
            authDeleted = true;
          } else {
            console.warn('Admin API error:', adminErr);
          }
        }
      } else if (userExistsInAuth && supabaseAdmin && deleteUserEmail && !actualUserId) {
        // If we only have email, try to find and delete by email
        try {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = authUsers?.users?.find((u: any) => u.email === deleteUserEmail);
          if (foundUser) {
            const { error: adminError } = await supabaseAdmin.auth.admin.deleteUser(foundUser.id);
            if (!adminError) {
              authDeleted = true;
              actualUserId = foundUser.id;
            }
          }
        } catch (err) {
          console.warn('Error deleting by email:', err);
        }
      }

      // If Admin API didn't work and user exists in auth, try RPC function
      if (!authDeleted && !authAlreadyDeleted && userExistsInAuth && actualUserId) {
        // @ts-ignore - RPC function type inference issue
        const { data: deleteResult, error } = await supabase.rpc('delete_user', {
          user_uuid: actualUserId
        });

        if (error) {
          console.error('Delete error:', error);
          // If RPC also fails but profile was deleted, that's okay - we'll handle partial deletion
        } else if (deleteResult && (deleteResult as any).success) {
          authDeleted = true;
        }
      }

      // Wait a moment for cascade operations to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify deletion succeeded - check both tables before showing success
      let profileVerified = false;
      let authVerified = authDeleted || authAlreadyDeleted; // If we successfully deleted or it was already deleted
      
      // Verify user_profiles deletion using admin client
      if (supabaseAdmin) {
        try {
          let profileCheck;
          if (actualUserId) {
            const { data, error: profileCheckError } = await supabaseAdmin
              .from('user_profiles')
              .select('id')
              .eq('user_id', actualUserId)
              .maybeSingle();
            profileCheck = data;
          } else if (deleteUserEmail) {
            const { data, error: profileCheckError } = await supabaseAdmin
              .from('user_profiles')
              .select('id')
              .eq('email', deleteUserEmail)
              .maybeSingle();
            profileCheck = data;
          }
          
          profileVerified = !profileCheck; // true if profile doesn't exist (deleted)
        } catch (err) {
          console.warn('Profile verification exception:', err);
        }
      }
      
      // If profile still exists but auth is deleted, try to delete profile again
      if (!profileVerified && (authDeleted || authAlreadyDeleted) && supabaseAdmin) {
        // Try one more time to delete the profile
        let retryError;
        if (actualUserId) {
          const { error } = await supabaseAdmin
            .from('user_profiles')
            .delete()
            .eq('user_id', actualUserId);
          retryError = error;
        } else if (deleteUserEmail) {
          const { error } = await supabaseAdmin
            .from('user_profiles')
            .delete()
            .eq('email', deleteUserEmail);
          retryError = error;
        }
        
        if (!retryError) {
          // Wait a bit and verify again
          await new Promise(resolve => setTimeout(resolve, 500));
          let finalCheck;
          if (actualUserId) {
            const { data } = await supabaseAdmin
              .from('user_profiles')
              .select('id')
              .eq('user_id', actualUserId)
              .maybeSingle();
            finalCheck = data;
          } else if (deleteUserEmail) {
            const { data } = await supabaseAdmin
              .from('user_profiles')
              .select('id')
              .eq('email', deleteUserEmail)
              .maybeSingle();
            finalCheck = data;
          }
          profileVerified = !finalCheck;
        }
      }
      
      // Verify auth.users deletion (only if we haven't already verified)
      if (!authVerified && supabaseAdmin) {
        try {
          if (actualUserId) {
            const { data: authUser, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(actualUserId);
            
            if (authCheckError) {
              // If error contains "not found" or similar, user is deleted
              if (authCheckError.message.toLowerCase().includes('not found') || 
                  authCheckError.message.toLowerCase().includes('does not exist')) {
                authVerified = true;
              }
            } else if (!authUser || !authUser.user) {
              // No user returned means deleted
              authVerified = true;
            } else {
              // User still exists
              authVerified = false;
              console.warn('Auth user still exists:', authUser.user.id);
            }
          } else if (deleteUserEmail) {
            // Verify by email
            try {
              const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
              const foundUser = authUsers?.users?.find((u: any) => u?.email === deleteUserEmail);
              authVerified = !foundUser; // true if user not found (deleted)
            } catch (listErr) {
              console.warn('Error listing users:', listErr);
            }
          }
        } catch (err: any) {
          // If error is about user not found, that's good
          if (err?.message?.toLowerCase().includes('not found') || 
              err?.message?.toLowerCase().includes('does not exist')) {
            authVerified = true;
          } else {
            console.warn('Auth verification error:', err);
          }
        }
      }

      // Final check - show success if at least one is verified as deleted
      // If user exists in one place but not the other, delete from where it exists
      let finalSuccess = false;
      let successMessage = "";
      
      if (profileVerified && authVerified) {
        // Both deleted - full success
        finalSuccess = true;
        successMessage = `User ${deleteUserName} has been completely deleted from both auth.users and user_profiles.`;
      } else if (profileVerified && !userExistsInAuth) {
        // Profile deleted, auth was already deleted
        finalSuccess = true;
        successMessage = `User ${deleteUserName} has been deleted from user_profiles. (Already removed from auth.users)`;
      } else if (authVerified && !userExistsInProfile) {
        // Auth deleted, profile was already deleted
        finalSuccess = true;
        successMessage = `User ${deleteUserName} has been deleted from auth.users. (Already removed from user_profiles)`;
      } else if (profileDeleted && !userExistsInAuth) {
        // Profile deleted successfully, auth was not present
        finalSuccess = true;
        successMessage = `User ${deleteUserName} has been deleted from user_profiles. (Not found in auth.users)`;
      } else if (authDeleted && !userExistsInProfile) {
        // Auth deleted successfully, profile was not present
        finalSuccess = true;
        successMessage = `User ${deleteUserName} has been deleted from auth.users. (Not found in user_profiles)`;
      } else if (profileDeleted || authDeleted) {
        // At least one deletion succeeded
        finalSuccess = true;
        if (profileDeleted && authDeleted) {
          successMessage = `User ${deleteUserName} deleted successfully.`;
        } else if (profileDeleted) {
          successMessage = `User ${deleteUserName} deleted from user_profiles.`;
        } else {
          successMessage = `User ${deleteUserName} deleted from auth.users.`;
        }
      }

      // If we couldn't delete from either place, show error
      if (!finalSuccess) {
        throw new Error('Failed to delete user. User may not exist in either table.');
      }

      // Remove user from local state
      setUsers(users.filter(u => 
        (deleteUserId && u.user_id === deleteUserId) || 
        (deleteUserEmail && u.email === deleteUserEmail)
      ));
      
      toast({
        title: "User deleted successfully",
        description: successMessage,
      });

      setDeleteUserId(null);
      setDeleteUserEmail("");
      setDeleteUserName("");
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
          <main className="container mx-auto px-4 py-4 space-y-4 pb-24 lg:pb-6 animate-fade-in max-w-7xl">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading users...</p>
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
        <main className="container mx-auto px-4 py-4 space-y-4 pb-24 lg:pb-6 animate-fade-in max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold mb-1">User Management</h1>
              <p className="text-muted-foreground text-sm">Manage all users and their access permissions</p>
            </div>
            <Button
              onClick={() => setIsAddUserOpen(true)}
              className="h-9 px-4 text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Search by name, email, or employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10"
            />

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Role:</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as any)}
                  className="h-8 px-2 text-xs border border-border rounded-md bg-card"
                >
                  <option value="all">All</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="h-8 px-2 text-xs border border-border rounded-md bg-card"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="hold">Hold</option>
                  <option value="suspend">Suspended</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Approval:</label>
                <select
                  value={filterApproval}
                  onChange={(e) => setFilterApproval(e.target.value as any)}
                  className="h-8 px-2 text-xs border border-border rounded-md bg-card"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredUsers.map((userData) => (
              <Card key={userData.id} className="p-4 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {userData.user_name?.charAt(0).toUpperCase() || userData.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">
                          {userData.user_name || userData.email || "Unknown User"}
                        </h3>
                        <Badge className={`text-xs ${getRoleColor(userData.role, userData.super_admin)}`}>
                          {userData.super_admin ? 'Super Admin' : userData.role}
                        </Badge>
                        <Badge className={`text-xs ${getStatusColor(userData.status)}`}>
                          {userData.status}
                        </Badge>
                        <Badge className={`text-xs ${getApprovalColor(userData.approval_status)}`}>
                          {userData.approval_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {userData.email}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {userData.employee_id && (
                          <span className="font-semibold text-primary">ID: {userData.employee_id}</span>
                        )}
                        {userData.user_id && (
                          <span>User ID: {userData.user_id.slice(0, 8)}...</span>
                        )}
                        {userData.contact_no && (
                          <span>Phone: {userData.contact_no}</span>
                        )}
                        <span>Joined: {new Date(userData.created_at).toLocaleDateString()}</span>
                      </div>
                      {userData.status_reason && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <span className="font-semibold text-yellow-800">Status Reason: </span>
                          <span className="text-yellow-700">{userData.status_reason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {userData.super_admin ? (
                        <div className="text-xs text-muted-foreground italic">
                          Protected
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-1.5">
                            <select
                              value={userData.status}
                              onChange={(e) => handleStatusChange(userData.user_id, e.target.value as any)}
                              className="h-7 px-2 text-xs border border-border rounded-md bg-card"
                            >
                              <option value="active">Active</option>
                              <option value="hold">Hold</option>
                              <option value="suspend">Suspend</option>
                            </select>
                            <select
                              value={userData.approval_status}
                              onChange={(e) => handleApprovalChange(userData.user_id, e.target.value as any)}
                              className="h-7 px-2 text-xs border border-border rounded-md bg-card"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              // If user_id is null or empty, use email for deletion
                              if (userData.user_id) {
                                setDeleteUserId(userData.user_id);
                                setDeleteUserEmail("");
                              } else {
                                setDeleteUserId(null);
                                setDeleteUserEmail(userData.email);
                              }
                              setDeleteUserName(userData.user_name || userData.email || "User");
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No users found matching your filters.</p>
            </div>
          )}
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
                  <div className="grid grid-cols-2 gap-3 pt-2">
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
          <DialogFooter>
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
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              disabled={!statusReason.trim() || (pendingStatusChange?.newStatus === 'hold' && holdDurationType === 'custom' && (!customHoldDate || !customHoldTime))}
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

              <div className="grid grid-cols-2 gap-4">
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
            <DialogFooter>
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
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAddingUser}>
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

