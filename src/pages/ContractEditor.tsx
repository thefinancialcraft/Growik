import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import TiptapEditor, { MenuBar } from '@/components/TiptapEditor';
import type { Editor } from '@tiptap/react';

interface UserProfile {
  id: string;
  user_name: string;
  email: string;
  contact_no?: string;
  role: 'user' | 'admin' | 'super_admin';
  approval_status: 'pending' | 'approved' | 'rejected';
  status: 'active' | 'hold' | 'suspend';
  employee_id?: string;
  super_admin?: boolean;
  hold_end_time?: string;
  created_at: string;
  updated_at: string;
}

interface ContractData {
  id: string;
  contract_name: string;
  description?: string;
  content?: string;
  status: 'active' | 'inactive' | 'draft';
  created_by: string;
  assigned_to?: string;
  variables?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// Helper function to format time since last save
const formatTimeSince = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const ContractEditor = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string>("User");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contractName, setContractName] = useState<string>("");
  const [contractDescription, setContractDescription] = useState<string>("");
  const [contractContent, setContractContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isVariableDialogOpen, setIsVariableDialogOpen] = useState<boolean>(false);
  const [variableKey, setVariableKey] = useState<string>("");
  const [variableValue, setVariableValue] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [contractId, setContractId] = useState<string | null>(null);
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);
  const { toast } = useToast();
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save function with debouncing
  const autoSaveContract = useCallback(async () => {
    if (!user?.id || !contractId || !contractName.trim()) {
      return;
    }

    setIsAutoSaving(true);
    try {
      const { error } = await supabase
        .from('contracts')
        // @ts-ignore - Supabase type inference issue
        .update({
          contract_name: contractName.trim(),
          description: contractDescription.trim() || null,
          content: contractContent,
          variables: variables,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', contractId);

      if (error) {
        console.error('Auto-save error:', error);
      } else {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Auto-save exception:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [user?.id, contractId, contractName, contractDescription, contractContent, variables]);

  // Debounced auto-save effect
  useEffect(() => {
    // Only auto-save if we're editing an existing contract
    if (!contractId || !contractName.trim()) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveContract();
    }, 2000);

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [contractContent, contractName, contractDescription, variables, contractId, autoSaveContract]);

  // Update "time since" display every 10 seconds
  useEffect(() => {
    if (!lastSaved) return;

    const interval = setInterval(() => {
      // Force re-render to update the time display
      setLastSaved(new Date(lastSaved));
    }, 10000);

    return () => clearInterval(interval);
  }, [lastSaved]);

  // Keyboard shortcut for Add Variable (Ctrl+Shift+H)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+H
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'h') {
        // Prevent default browser behavior
        event.preventDefault();
        // Only open if not already saving/loading
        if (!isSaving && !isSavingDraft && !isLoadingContract) {
          setIsVariableDialogOpen(true);
        }
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSaving, isSavingDraft, isLoadingContract]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/");
      return;
    }

    // Update last_seen timestamp for current user (only when tab is visible and user is active)
    let activityTimeout: NodeJS.Timeout | null = null;
    let isActive = true;

    const updateLastSeen = async () => {
      if (document.visibilityState === 'hidden' || !isActive) {
        return;
      }

      if (!user?.id) return;
      try {
        await supabase
          .from('user_profiles')
          // @ts-ignore - last_seen column may not be in types
          .update({ last_seen: new Date().toISOString() })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('ContractEditor: Error updating last_seen:', error);
      }
    };

    const resetActivity = () => {
      isActive = true;
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
      
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      activityTimeout = setTimeout(() => {
        isActive = false;
        console.log('ContractEditor: User inactive for 1 minute, stopping last_seen updates');
      }, 1 * 60 * 1000);
    };

    const handleMouseMove = () => resetActivity();
    const handleKeyPress = () => resetActivity();
    const handleClick = () => resetActivity();
    const handleScroll = () => resetActivity();

    resetActivity();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && isActive) {
        updateLastSeen();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    const fetchProfile = async () => {
      if (!user?.id) return;

      const metaName = (user as any)?.user_metadata?.full_name as string | undefined;
      if (metaName && metaName.trim()) {
        setDisplayName(metaName.trim());
      }

      const cache = localStorage.getItem(`profile_sidebar_${user.id}`);
      if (cache) {
        try {
          const parsed = JSON.parse(cache);
          if (parsed?.user_name) setDisplayName(parsed.user_name);
        } catch {}
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_name, email, role, super_admin, approval_status, status, employee_id, updated_at, hold_end_time')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('ContractEditor: Error fetching profile:', error);
          if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('does not exist')) {
            console.log('ContractEditor: User profile not found, redirecting to login');
            try {
              await signOut();
            } catch (signOutError) {
              console.error('ContractEditor: Error signing out:', signOutError);
            }
            try {
              localStorage.removeItem(`profile_sidebar_${user.id}`);
              localStorage.removeItem(`profile_${user.id}`);
              localStorage.removeItem('currentUserRole');
              localStorage.removeItem('isSuperAdmin');
              localStorage.removeItem('isAuthenticated');
            } catch (e) {
              console.error('Error clearing cache:', e);
            }
            window.location.href = '/login?error=account_deleted';
            return;
          }
          return;
        }

        if (data) {
          const userProfile = data as UserProfile;
          setProfile(userProfile);
          setDisplayName(userProfile.user_name || metaName || userProfile.email?.split('@')[0] || 'User');

          try {
            localStorage.setItem(`profile_sidebar_${user.id}`, JSON.stringify({
              employee_id: userProfile.employee_id,
              updated_at: userProfile.updated_at,
              user_name: userProfile.user_name,
              email: userProfile.email,
              role: userProfile.role,
              super_admin: userProfile.super_admin,
              approval_status: userProfile.approval_status,
              status: userProfile.status,
              hold_end_time: userProfile.hold_end_time
            }));
          } catch (e) {
            console.error('Error updating cache:', e);
          }

          const isAdminOrSuperAdmin = userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.super_admin === true;
          
          if (!isAdminOrSuperAdmin) {
            const currentPath = location.pathname;
            
            if (userProfile.approval_status === 'rejected') {
              navigate('/rejected');
              return;
            }
            
            if (userProfile.status === 'suspend') {
              navigate('/suspended');
              return;
            }
            
            if (userProfile.status === 'hold') {
              navigate('/hold');
              return;
            }
            
            if (userProfile.approval_status !== 'approved') {
              navigate('/approval-pending');
              return;
            }
          }
        } else {
          console.log('ContractEditor: User profile not found, redirecting to login');
          try {
            await signOut();
          } catch (signOutError) {
            console.error('ContractEditor: Error signing out:', signOutError);
          }
          try {
            localStorage.removeItem(`profile_sidebar_${user.id}`);
            localStorage.removeItem(`profile_${user.id}`);
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('isSuperAdmin');
            localStorage.removeItem('isAuthenticated');
          } catch (e) {
            console.error('Error clearing cache:', e);
          }
          window.location.href = '/login?error=account_deleted';
          return;
        }
      } catch (error: any) {
        console.error('ContractEditor: Exception fetching profile:', error);
        if (error?.code === 'PGRST116' || error?.message?.toLowerCase().includes('not found') || error?.message?.toLowerCase().includes('does not exist')) {
          console.log('ContractEditor: User profile not found, redirecting to login');
          try {
            await signOut();
          } catch (signOutError) {
            console.error('ContractEditor: Error signing out:', signOutError);
          }
          try {
            localStorage.removeItem(`profile_sidebar_${user.id}`);
            localStorage.removeItem(`profile_${user.id}`);
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('isSuperAdmin');
            localStorage.removeItem('isAuthenticated');
          } catch (e) {
            console.error('Error clearing cache:', e);
          }
          window.location.href = '/login?error=account_deleted';
          return;
        }
        if (user.email) setDisplayName(user.email.split('@')[0]);
      }
    };

    fetchProfile();

    return () => {
      if (interval) clearInterval(interval);
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user?.id, authLoading, navigate, signOut, location.pathname]);

  // Load existing contract for editing
  const loadContract = useCallback(async (id: string) => {
    if (!user?.id) return;

    setIsLoadingContract(true);
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000;

    const fetchContract = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          // Retry logic for network errors
          if (retryCount < maxRetries && (error.code === 'PGRST301' || error.message?.includes('fetch'))) {
            retryCount++;
            console.log(`ContractEditor: Retrying fetch (attempt ${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
            return fetchContract();
          }
          throw error;
        }

        if (data) {
          const contractData = data as ContractData;
          // Check if user has access to this contract
          const isAdminOrSuperAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.super_admin === true;
          const hasAccess = isAdminOrSuperAdmin || contractData.created_by === user.id || contractData.assigned_to === user.id;

          if (!hasAccess) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to edit this contract.",
              variant: "destructive",
            });
            navigate('/contract');
            return;
          }

          setContractName(contractData.contract_name || '');
          setContractDescription((contractData as ContractData).description || '');
          setContractContent(contractData.content || '');
          setVariables(contractData.variables || {});
          setLastSaved(new Date(contractData.updated_at));
        } else {
          toast({
            title: "Contract Not Found",
            description: "The contract you're trying to edit doesn't exist.",
            variant: "destructive",
          });
          navigate('/contract');
        }
      } catch (error: any) {
        console.error('Error loading contract:', error);
        if (retryCount >= maxRetries) {
          toast({
            title: "Error",
            description: error.message || "Failed to load contract. Please try again.",
            variant: "destructive",
          });
          navigate('/contract');
        }
      } finally {
        setIsLoadingContract(false);
      }
    };

    fetchContract();
  }, [user?.id, profile, navigate, toast]);

  // Load existing contract for editing when URL has id parameter
  useEffect(() => {
    if (!user?.id || !profile) return;

    const urlParams = new URLSearchParams(location.search);
    const editContractId = urlParams.get('id');
    
    if (editContractId && !contractId) {
      setContractId(editContractId);
      loadContract(editContractId);
    }
  }, [user?.id, profile, location.search, contractId, loadContract]);

  const handleSave = async () => {
    if (!contractName.trim() || !contractContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in both contract name and content.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated. Please login again.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (contractId) {
        // Update existing contract
        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .update({
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: contractContent,
            status: 'active',
            variables: variables,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', contractId)
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        toast({
          title: "Contract Updated",
          description: `Contract "${contractName}" has been updated successfully.`,
        });
      } else {
        // Create new contract
        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .insert({
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: contractContent,
            status: 'active',
            created_by: user.id,
            variables: variables,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        toast({
          title: "Contract Saved",
          description: `Contract "${contractName}" has been saved successfully.`,
        });
      }
      
      // Navigate back to contracts page
      navigate('/contract');
    } catch (error: any) {
      console.error('Error saving contract:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!contractName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a contract name to save as draft.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated. Please login again.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      if (contractId) {
        // Update existing contract as draft
        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .update({
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: contractContent || '',
            status: 'draft',
            variables: variables,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', contractId)
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        toast({
          title: "Draft Updated",
          description: `Contract "${contractName}" has been saved as draft.`,
        });
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('contracts')
          // @ts-ignore - Supabase type inference issue
          .insert({
            contract_name: contractName.trim(),
            description: contractDescription.trim() || null,
            content: contractContent || '',
            status: 'draft',
            created_by: user.id,
            variables: variables,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }
        
        toast({
          title: "Draft Saved",
          description: `Contract "${contractName}" has been saved as draft.`,
        });
      }
      
      // Navigate back to contracts page
      navigate('/contract');
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Handle variable insertion
  const handleAddVariable = () => {
    if (!variableKey.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a variable key.",
        variant: "destructive",
      });
      return;
    }

    // Insert variable placeholder in format {{variable_key}}
    const variablePlaceholder = `<span style="background-color: #fef3c7; padding: 2px 4px; border-radius: 3px; font-weight: 500;">{{${variableKey.trim()}}}</span>`;
    
    // Append variable to the end of current content
    setContractContent(prev => prev + ' ' + variablePlaceholder + ' ');
    
    // Store variable in state
    setVariables(prev => ({
      ...prev,
      [variableKey.trim()]: variableValue.trim() || ''
    }));

    toast({
      title: "Variable Added",
      description: `Variable "${variableKey.trim()}" has been added to the document.`,
    });

    // Reset form and close dialog
    setVariableKey("");
    setVariableValue("");
    setIsVariableDialogOpen(false);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };


  return (
    <div className="flex min-h-screen bg-[#f5f5f7]">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        {/* Canva-style Top Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/contract')}
                disabled={isSaving || isSavingDraft}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {contractName || 'Untitled Contract'}
                </h2>
                <p className="text-xs text-gray-500">
                  {isAutoSaving ? (
                    <span className="flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : lastSaved && contractId ? (
                    <span>Saved {formatTimeSince(lastSaved)}</span>
                  ) : contractId ? (
                    'Editing'
                  ) : (
                    'Creating new contract'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isSavingDraft || !contractName.trim()}
                className="text-gray-600 hover:text-gray-900"
              >
                {isSavingDraft ? (
                  <>
                    <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Draft"
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || isSavingDraft || !contractName.trim() || !contractContent.trim()}
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-sm"
                size="sm"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar - Fixed below header with horizontal scrolling */}
        <div className="sticky top-[56px] z-20 bg-[#f8f9fa] border-b border-[#dadce0] shadow-sm overflow-x-auto scrollbar-hide">
          <div className="px-3 py-2">
            <MenuBar editor={editor} onVariableClick={() => setIsVariableDialogOpen(true)} />
          </div>
        </div>

        <main className="px-4 py-6 pb-24 lg:pb-8 animate-fade-in">

          {/* Editor Content */}
          {isLoadingContract ? (
            <div className="flex items-center justify-center min-h-[600px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b5cf6] mx-auto mb-4"></div>
                <p className="text-gray-600 text-lg">Loading contract...</p>
                <p className="text-gray-400 text-sm mt-2">Please wait while we fetch the contract data</p>
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              {/* Contract Name & Description - Floating above canvas */}
              <div className="mb-6 space-y-4">
                <div>
                  <Input
                    id="contractName"
                    type="text"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    placeholder="Untitled Contract"
                    disabled={isSaving || isSavingDraft}
                    required
                    className="text-2xl font-bold border-0 border-b border-transparent hover:border-gray-300 focus:border-[#8b5cf6] rounded-none px-0 h-auto py-2 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div>
                  <textarea
                    id="contractDescription"
                    value={contractDescription}
                    onChange={(e) => setContractDescription(e.target.value)}
                    placeholder="Add a description..."
                    disabled={isSaving || isSavingDraft || isLoadingContract}
                    rows={2}
                    className="w-full border-0 bg-transparent px-0 py-1 text-sm text-gray-600 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 resize-none"
                  />
                </div>
              </div>

              {/* Editor Container */}
              <div 
                className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden transition-transform duration-300 origin-top" 
                style={{ 
                  minHeight: '800px',
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center'
                }}
              >
                <TiptapEditor
                  content={contractContent}
                  onChange={setContractContent}
                  placeholder="Start writing your contract here...

Use the toolbar above to format text, add headings, lists, and more."
                  onEditorReady={setEditor}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <MobileNav />

      {/* Floating Zoom Controls - Bottom Left */}
      <div className="fixed bottom-8 left-8 lg:left-64 z-40 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={zoomLevel <= 50}
          className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </Button>
        <button
          onClick={handleResetZoom}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 min-w-[3.5rem] hover:bg-gray-100 rounded transition-colors"
          title="Reset Zoom"
        >
          {zoomLevel}%
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={zoomLevel >= 200}
          className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>

      {/* Variable Dialog */}
      <Dialog open={isVariableDialogOpen} onOpenChange={setIsVariableDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Custom Variable</DialogTitle>
            <DialogDescription>
              Add a variable placeholder that can be updated later. The variable will be inserted at the current cursor position in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="variableKey">Variable Key *</Label>
              <Input
                id="variableKey"
                type="text"
                value={variableKey}
                onChange={(e) => setVariableKey(e.target.value)}
                placeholder="e.g., client_name, contract_date"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && variableKey.trim()) {
                    handleAddVariable();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                The key will be used as a placeholder: {"{"}{"{"}key{"}"}{"}"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variableValue">Variable Value (Optional)</Label>
              <Input
                id="variableValue"
                type="text"
                value={variableValue}
                onChange={(e) => setVariableValue(e.target.value)}
                placeholder="Value will be updated later"
              />
              <p className="text-xs text-muted-foreground">
                You can set the value now or update it later.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsVariableDialogOpen(false);
                setVariableKey("");
                setVariableValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddVariable}
              disabled={!variableKey.trim()}
            >
              Add Variable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractEditor;

