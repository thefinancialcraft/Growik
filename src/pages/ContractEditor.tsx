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
import ReactQuill from 'react-quill';
import Quill from 'quill';
import 'react-quill/dist/quill.snow.css';

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
  const quillRef = useRef<ReactQuill>(null);
  const { toast } = useToast();

  // Register custom fonts with Quill
  useEffect(() => {
    const Font = Quill.import('formats/font');
    Font.whitelist = [
      'roboto',
      'open-sans',
      'lato',
      'montserrat',
      'raleway',
      'playfair-display',
      'merriweather',
      'source-sans-pro',
      'poppins',
      'nunito',
      'inter',
      'ubuntu',
      'crimson-text',
      'lora',
      'pt-serif'
    ];
    Quill.register(Font, true);
  }, []);

  // Register custom variable button handler and update editor content when contract loads
  useEffect(() => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const toolbar = quill.getModule('toolbar');
      if (toolbar) {
        toolbar.addHandler('variable', () => {
          setIsVariableDialogOpen(true);
        });
      }
      
      // Update editor content when contractContent changes (for editing existing contracts)
      if (contractContent && contractId) {
        const currentContent = quill.root.innerHTML;
        if (currentContent !== contractContent) {
          quill.root.innerHTML = contractContent;
        }
      }
    }
  }, [contractContent, contractId]);

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

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection(true);
    if (!range) {
      toast({
        title: "Error",
        description: "Please click in the editor to set cursor position.",
        variant: "destructive",
      });
      return;
    }

    // Insert variable placeholder in format {{variable_key}}
    const variablePlaceholder = `{{${variableKey.trim()}}}`;
    quill.insertText(range.index, variablePlaceholder, 'user');
    
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

  // Quill editor modules configuration with custom variable button
  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': ['roboto', 'open-sans', 'lato', 'montserrat', 'raleway', 'playfair-display', 'merriweather', 'source-sans-pro', 'poppins', 'nunito', 'inter', 'ubuntu', 'crimson-text', 'lora', 'pt-serif'] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'direction': 'rtl' }],
        [{ 'align': [] }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean'],
        ['variable'] // Custom variable button
      ],
      handlers: {
        'variable': () => {
          setIsVariableDialogOpen(true);
        }
      }
    },
  }), []);

  const quillFormats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'direction', 'align',
    'blockquote', 'code-block',
    'link', 'image', 'video'
  ];

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-24 lg:pb-6 animate-fade-in max-w-7xl">
          {/* Header */}
          <div className="bg-gradient-primary rounded-xl p-4 md:p-6 text-white shadow-glow mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-1">
                  {contractId ? 'Edit Contract' : 'Contract Editor'}
                </h2>
                <p className="text-white/80 text-sm">
                  {contractId ? 'Edit your contract document' : 'Create and edit your contract document'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/contract')}
                  disabled={isSaving || isSavingDraft}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveDraft}
                  disabled={isSaving || isSavingDraft || !contractName.trim()}
                  className="bg-yellow-500/20 border-yellow-500/30 text-yellow-100 hover:bg-yellow-500/30"
                >
                  {isSavingDraft ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save as Draft"
                  )}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || isSavingDraft || !contractName.trim() || !contractContent.trim()}
                  className="bg-white text-primary hover:bg-white/90"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save Contract"
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Editor Content */}
          {isLoadingContract ? (
            <div className="bg-card rounded-lg border border-border/50 p-8 flex flex-col items-center justify-center min-h-[600px]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground text-lg">Loading contract...</p>
              <p className="text-muted-foreground text-sm mt-2">Please wait while we fetch the contract data</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border/50 p-4 md:p-6 space-y-6">
              {/* Contract Name Input */}
              <div className="space-y-2">
                <Label htmlFor="contractName" className="text-base font-semibold">Contract Name *</Label>
                <Input
                  id="contractName"
                  type="text"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="Enter contract name"
                  disabled={isSaving || isSavingDraft}
                  required
                  className="w-full h-12 text-base"
                />
              </div>

              {/* Contract Description Input */}
              <div className="space-y-2">
                <Label htmlFor="contractDescription" className="text-base font-semibold">Description</Label>
                <textarea
                  id="contractDescription"
                  value={contractDescription}
                  onChange={(e) => setContractDescription(e.target.value)}
                  placeholder="Enter contract description (optional)"
                  disabled={isSaving || isSavingDraft || isLoadingContract}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">
                  Brief description of the contract (optional)
                </p>
              </div>

              {/* Document Editor */}
              <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="contractContent" className="text-base font-semibold">Contract Document *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsVariableDialogOpen(true)}
                          disabled={isSaving || isSavingDraft}
                          className="flex items-center gap-2"
                          title="Add Variable (Ctrl+Shift+H)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Variable
                          <kbd className="ml-2 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
                            Ctrl+Shift+H
                          </kbd>
                        </Button>
                      </div>
                <div className="bg-background rounded-md border border-input overflow-hidden">
                  <ReactQuill
                    key={contractId || 'new-contract'}
                    ref={quillRef}
                    theme="snow"
                    value={contractContent}
                    onChange={setContractContent}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Start writing your contract here...

You can format text, add headings, lists, links, images, and more using the toolbar above."
                    readOnly={isSaving || isSavingDraft}
                    className="min-h-[500px]"
                    style={{
                      minHeight: '500px'
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the toolbar above to format your contract. You can add headings, bold/italic text, lists, links, images, and more. Click the "+ Add Variable" button to add custom variables.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <MobileNav />

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

