import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle, X, MoreVertical, Trash2, Ban, Image, Paperclip, Mic, Play, Pause, Loader2, Smile, ArrowLeft, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface UserProfile {
  user_id: string;
  user_name: string;
  employee_id?: string;
  email: string;
  last_seen?: string;
  is_online?: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  created_at: string;
  sender_name?: string;
  sender_employee_id?: string;
  receiver_name?: string;
  receiver_employee_id?: string;
  media_url?: string;
  media_type?: 'image' | 'file' | 'voice';
  message_type?: 'text' | 'media' | 'voice';
}

const Messaging = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState<string>("User");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [newMessageDialog, setNewMessageDialog] = useState<{
    open: boolean;
    sender: UserProfile | null;
    message: string;
  }>({ open: false, sender: null, message: "" });
  const [userProfileCache, setUserProfileCache] = useState<Map<string, { user_name: string; employee_id?: string }>>(new Map());
  const [clearChatDialog, setClearChatDialog] = useState<boolean>(false);
  const [blockUserDialog, setBlockUserDialog] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'file'; name?: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, { current: number; duration: number }>>({});
  const [isAdminOrSuperAdmin, setIsAdminOrSuperAdmin] = useState<boolean>(false);
  const [actionsOpen, setActionsOpen] = useState<boolean>(false);
  const recordingTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const progressIntervalRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const { toast } = useToast();
  const emojiList = [
    "😀","😂","😊","😍","😘","🤩","😉","🙌","👍","🙏",
    "🔥","💯","🎉","🥳","😎","🤔","😢","😭","😡","🤯",
    "😴","🤗","😇","😋","🤤","😜"
  ];

  // Check if user is currently online
  const isUserCurrentlyOnline = useCallback((userProfile: UserProfile): boolean => {
    if (!userProfile.last_seen) return false;
    const lastSeen = new Date(userProfile.last_seen).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - lastSeen) / (1000 * 60);
    return diffMinutes <= 1; // Online if last seen within 1 minute
  }, []);

  // Format last seen time
  const formatLastSeen = useCallback((lastSeen?: string): string => {
    if (!lastSeen) return "Never";
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  }, []);

  // Fetch user profile
  useEffect(() => {
    if (authLoading || !user?.id) return;

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("user_name, email, role, super_admin, approval_status, status, employee_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          window.location.href = "/login?error=account_deleted";
          return;
        }

        // Check if user is approved and active
        const isAdminOrSuperAdminCheck =
          (data as any).role === "admin" ||
          (data as any).role === "super_admin" ||
          (data as any).super_admin === true;

        setIsAdminOrSuperAdmin(isAdminOrSuperAdminCheck);

        if (!isAdminOrSuperAdminCheck) {
          if ((data as any).approval_status !== "approved") {
            navigate("/approval-pending");
            return;
          }
          if ((data as any).status === "hold") {
            navigate("/hold");
            return;
          }
          if ((data as any).status === "suspend") {
            navigate("/suspended");
            return;
          }
          if ((data as any).status === "rejected") {
            navigate("/rejected");
            return;
          }
        }

        setProfile(data as any);
        setDisplayName((data as any).user_name || "User");
      } catch (error: any) {
        console.error("Error fetching profile:", error);
        if (error?.code === "PGRST116") {
          window.location.href = "/login?error=account_deleted";
        }
      }
    };

    fetchProfile();
  }, [user?.id, authLoading, navigate]);

  // Fetch all users (excluding current user) and cache profiles
  useEffect(() => {
    if (!user?.id) return;

    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("user_id, user_name, employee_id, email, last_seen")
          .neq("user_id", user.id)
          .order("user_name", { ascending: true });

        if (error) throw error;

        if (data) {
          // Build profile cache
          const cache = new Map<string, { user_name: string; employee_id?: string }>();
          (data as any[]).forEach((u: any) => {
            cache.set(u.user_id, {
              user_name: u.user_name || "Unknown",
              employee_id: u.employee_id || undefined,
            });
          });
          setUserProfileCache(cache);

          const usersWithStatus = (data as any[]).map((u: any) => ({
            ...u,
            is_online: isUserCurrentlyOnline(u as UserProfile),
          }));
          setUsers(usersWithStatus as UserProfile[]);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();

    if (!user?.id) return;

    const channel = supabase
      .channel(`messaging_users_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
        },
        (payload) => {
          const updatedUser = payload.new as any;
          if (updatedUser.user_id !== user.id) {
            setUserProfileCache((prev) => {
              const next = new Map(prev);
              next.set(updatedUser.user_id, {
                user_name: updatedUser.user_name || "Unknown",
                employee_id: updatedUser.employee_id || undefined,
              });
              return next;
            });

            setUsers((prev) =>
              prev.map((u) =>
                u.user_id === updatedUser.user_id
                  ? {
                      ...u,
                      last_seen: updatedUser.last_seen,
                      is_online: isUserCurrentlyOnline(updatedUser),
                      user_name: updatedUser.user_name || u.user_name,
                      employee_id: updatedUser.employee_id || u.employee_id,
                    }
                  : u
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isUserCurrentlyOnline]);

  // Fetch pending message counts with real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const fetchPendingCounts = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("sender_id")
          .eq("receiver_id", user.id)
          .eq("is_read", false);

        if (error) throw error;

        const counts: Record<string, number> = {};
        (data as any[])?.forEach((msg: any) => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        });
        setPendingCounts(counts);
      } catch (error) {
        console.error("Error fetching pending counts:", error);
      }
    };

    fetchPendingCounts();

    if (!user?.id) return;

    const channel = supabase
      .channel(`messaging_counts_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchPendingCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Fetch messages for selected user - OPTIMIZED
  useEffect(() => {
    if (!user?.id || !selectedUser) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true })
          .limit(100); // Limit to last 100 messages for performance

        if (error) throw error;

        if (data) {
          // Enrich messages using cache (much faster)
          const enrichedMessages = (data as any[]).map((msg: any) => {
            const senderProfile = userProfileCache.get(msg.sender_id);
            const receiverProfile = userProfileCache.get(msg.receiver_id);

            return {
              ...msg,
              sender_name: senderProfile?.user_name || "Unknown",
              sender_employee_id: senderProfile?.employee_id || null,
              receiver_name: receiverProfile?.user_name || "Unknown",
              receiver_employee_id: receiverProfile?.employee_id || null,
            };
          });

          setMessages(enrichedMessages);

          // Mark messages as read (batch update)
          if (enrichedMessages.length > 0) {
            const unreadIds = enrichedMessages
              .filter((m) => m.receiver_id === user.id && !m.is_read)
              .map((m) => m.id);

            if (unreadIds.length > 0) {
              await supabase
                .from("messages")
                // @ts-ignore - Supabase type inference issue
                .update({ is_read: true, status: 'read' })
                .in("id", unreadIds);
              
              // Update status in local state
              setMessages((prev) =>
                prev.map((msg) =>
                  unreadIds.includes(msg.id)
                    ? { ...msg, is_read: true, status: 'read' as const }
                    : msg
                )
              );
            }
          }

          // Update pending counts
          setPendingCounts((prev) => {
            const updated = { ...prev };
            delete updated[selectedUser.user_id];
            return updated;
          });
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messaging_${user.id}_${selectedUser.user_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;

          if (
            (newMsg.sender_id === selectedUser.user_id && newMsg.receiver_id === user.id) ||
            (newMsg.sender_id === user.id && newMsg.receiver_id === selectedUser.user_id)
          ) {
            const senderProfile = userProfileCache.get(newMsg.sender_id);
            newMsg.sender_name = senderProfile?.user_name || "Unknown";
            newMsg.sender_employee_id = senderProfile?.employee_id || null;

            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMsg.id);
              if (exists) return prev;
              return [...prev, newMsg];
            });

            if (newMsg.receiver_id === user.id && !newMsg.is_read && selectedUser?.user_id === newMsg.sender_id) {
              (async () => {
                try {
                  await supabase
                    .from("messages")
                    // @ts-ignore
                    .update({ is_read: true, status: "read" })
                    .eq("id", newMsg.id);

                  setMessages((prev) =>
                    prev.map((m) => (m.id === newMsg.id ? { ...m, is_read: true, status: "read" as const } : m))
                  );

                  setPendingCounts((prev) => {
                    const updated = { ...prev };
                    if (updated[newMsg.sender_id]) {
                      updated[newMsg.sender_id] = Math.max(0, updated[newMsg.sender_id] - 1);
                      if (updated[newMsg.sender_id] === 0) {
                        delete updated[newMsg.sender_id];
                      }
                    }
                    return updated;
                  });
                } catch (err) {
                  console.error("Error marking message as read:", err);
                }
              })();
            } else if (
              newMsg.receiver_id === user.id &&
              newMsg.sender_id !== user.id &&
              newMsg.status !== "delivered" &&
              newMsg.status !== "read"
            ) {
              (async () => {
                try {
                  await supabase
                    .from("messages")
                    // @ts-ignore
                    .update({ status: "delivered" })
                    .eq("id", newMsg.id);

                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === newMsg.id && m.status !== "read" ? { ...m, status: "delivered" as const } : m
                    )
                  );
                } catch (err) {
                  console.error("Error updating message status:", err);
                }
              })();
            }

            if (
              newMsg.receiver_id === user.id &&
              newMsg.sender_id !== user.id &&
              selectedUser?.user_id === newMsg.sender_id &&
              newMsg.status === "sent"
            ) {
              (async () => {
                try {
                  await supabase
                    .from("messages")
                    // @ts-ignore
                    .update({ status: "delivered" })
                    .eq("id", newMsg.id);

                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === newMsg.id && m.status !== "read" ? { ...m, status: "delivered" as const } : m
                    )
                  );
                } catch (err) {
                  console.error("Error updating message status:", err);
                }
              })();
            }

            if (
              newMsg.receiver_id === user.id &&
              newMsg.sender_id !== user.id &&
              selectedUser?.user_id !== newMsg.sender_id
            ) {
              const sender = users.find((u) => u.user_id === newMsg.sender_id);
              if (sender) {
                setNewMessageDialog({
                  open: true,
                  sender,
                  message: newMsg.message,
                });

                toast({
                  title: `New message from ${sender.user_name}`,
                  description:
                    newMsg.message.length > 50 ? newMsg.message.substring(0, 50) + "..." : newMsg.message,
                });

                setPendingCounts((prev) => ({
                  ...prev,
                  [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1,
                }));
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          if (
            (updatedMsg.sender_id === user.id && updatedMsg.receiver_id === selectedUser.user_id) ||
            (updatedMsg.sender_id === selectedUser.user_id && updatedMsg.receiver_id === user.id)
          ) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMsg.id
                  ? {
                      ...msg,
                      ...updatedMsg,
                      status: updatedMsg.status || msg.status || "sent",
                    }
                  : msg
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Cleanup recording if component unmounts
      if (isRecording && mediaRecorderRef.current) {
        stopRecording();
      }
      // Only clear interval if not recording (to avoid clearing active timer)
      if (recordingIntervalRef.current && !isRecording) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [user?.id, selectedUser?.user_id, userProfileCache, users]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !selectedUser) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    // Create optimistic message with 'sending' status
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: selectedUser.user_id,
      message: messageText,
      is_read: false,
      status: 'sending',
      created_at: new Date().toISOString(),
      sender_name: profile?.user_name || "You",
      sender_employee_id: profile?.employee_id || null,
    };

    // Add optimistic message immediately
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase
        .from("messages")
        // @ts-ignore - Supabase type inference issue
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser.user_id,
          message: messageText,
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with real message
      if (data) {
        const senderProfile = userProfileCache.get((data as any).sender_id);
        const receiverProfile = userProfileCache.get((data as any).receiver_id);
        
        const realMessage: Message = {
          ...(data as any),
          sender_name: senderProfile?.user_name || "Unknown",
          sender_employee_id: senderProfile?.employee_id || null,
          receiver_name: receiverProfile?.user_name || "Unknown",
          receiver_employee_id: receiverProfile?.employee_id || null,
        };

        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? realMessage : msg))
        );
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setNewMessage(messageText); // Restore message text
      toast({
        title: "Error",
        description: error.message || "Failed to send message.",
        variant: "destructive",
      });
    }
  };

  // Get total pending count - memoized
  const totalPendingCount = useMemo(() => {
    return Object.values(pendingCounts).reduce((sum, count) => sum + count, 0);
  }, [pendingCounts]);

  // Clear chat handler
  const handleClearChat = async () => {
    if (!user?.id || !selectedUser) return;

    try {
      // First, fetch all messages with media files before deleting
      // Fetch messages where current user is sender
      const { data: messagesAsSender, error: fetchError1 } = await supabase
        .from("messages")
        .select("id, media_url, sender_id, receiver_id")
        .eq("sender_id", user.id)
        .eq("receiver_id", selectedUser.user_id);

      // Fetch messages where current user is receiver
      const { data: messagesAsReceiver, error: fetchError2 } = await supabase
        .from("messages")
        .select("id, media_url, sender_id, receiver_id")
        .eq("sender_id", selectedUser.user_id)
        .eq("receiver_id", user.id);

      const messagesToDelete = [
        ...(messagesAsSender || []),
        ...(messagesAsReceiver || [])
      ];

      if (fetchError1 || fetchError2) {
        console.error("Error fetching messages:", fetchError1 || fetchError2);
      }

      // Delete media files from storage bucket
      if (messagesToDelete && messagesToDelete.length > 0) {
        const currentUserFiles: string[] = [];
        const partnerUserFiles: string[] = [];

        messagesToDelete.forEach((msg: any) => {
          if (msg.media_url) {
            // Extract file path from media_url
            // URL format: https://[project].supabase.co/storage/v1/object/public/messages/[user-id]/[filename]
            try {
              const url = new URL(msg.media_url);
              const pathParts = url.pathname.split('/');
              const messagesIndex = pathParts.indexOf('messages');
              
              if (messagesIndex !== -1 && pathParts.length > messagesIndex + 1) {
                // Get path after 'messages/' (e.g., "user-id/filename")
                const filePath = pathParts.slice(messagesIndex + 1).join('/');
                const userId = filePath.split('/')[0]; // First part is user-id
                
                // Separate files by sender (current user vs chat partner)
                if (userId === user.id) {
                  currentUserFiles.push(filePath);
                } else if (userId === selectedUser.user_id) {
                  partnerUserFiles.push(filePath);
                } else {
                  // If sender_id doesn't match folder, use sender_id from message
                  if (msg.sender_id === user.id) {
                    currentUserFiles.push(filePath);
                  } else {
                    partnerUserFiles.push(filePath);
                  }
                }
              }
            } catch (urlError) {
              console.error("Error parsing media URL:", urlError, msg.media_url);
            }
          }
        });

        // Delete current user's files using regular client (RLS allows this)
        if (currentUserFiles.length > 0) {
          const { error: storageError1 } = await supabase.storage
            .from('messages')
            .remove(currentUserFiles);

          if (storageError1) {
            console.error("Error deleting current user's files from storage:", storageError1);
          }
        }

        // Delete chat partner's files using admin client (bypasses RLS)
        if (partnerUserFiles.length > 0 && supabaseAdmin) {
          const { error: storageError2 } = await supabaseAdmin.storage
            .from('messages')
            .remove(partnerUserFiles);

          if (storageError2) {
            console.error("Error deleting partner's files from storage:", storageError2);
            // Try with regular client as fallback (might work if RLS allows)
            const { error: fallbackError } = await supabase.storage
              .from('messages')
              .remove(partnerUserFiles);
            
            if (fallbackError) {
              console.error("Fallback deletion also failed:", fallbackError);
            }
          }
        } else if (partnerUserFiles.length > 0 && !supabaseAdmin) {
          console.warn("Admin client not available, cannot delete partner's files. Service key may be missing.");
          // Try with regular client as fallback
          const { error: fallbackError } = await supabase.storage
            .from('messages')
            .remove(partnerUserFiles);
          
          if (fallbackError) {
            console.error("Cannot delete partner's files without admin client:", fallbackError);
          }
        }
      }

      // Delete all messages where current user is sender
      const { error: error1 } = await supabase
        .from("messages")
        // @ts-ignore - Supabase type inference issue
        .delete()
        .eq("sender_id", user.id)
        .eq("receiver_id", selectedUser.user_id);

      // Delete all messages where current user is receiver
      const { error: error2 } = await supabase
        .from("messages")
        // @ts-ignore - Supabase type inference issue
        .delete()
        .eq("sender_id", selectedUser.user_id)
        .eq("receiver_id", user.id);

      if (error1) throw error1;
      if (error2) throw error2;

      // Store selected user ID before clearing
      const clearedUserId = selectedUser.user_id;

      // Clear messages and deselect user
      setMessages([]);
      setSelectedUser(null);
      setClearChatDialog(false);
      
      // Update pending counts
      setPendingCounts((prev) => {
        const updated = { ...prev };
        if (updated[clearedUserId]) {
          delete updated[clearedUserId];
        }
        return updated;
      });
      
      toast({
        title: "Chat Cleared",
        description: "All messages and media files have been deleted.",
      });
    } catch (error: any) {
      console.error("Error clearing chat:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear chat.",
        variant: "destructive",
      });
    }
  };

  // Block user handler
  const handleBlockUser = async () => {
    if (!user?.id || !selectedUser) return;

    try {
      // TODO: Implement block user functionality
      // This would typically involve:
      // 1. Adding user to blocked_users table or updating user_profiles
      // 2. Preventing future messages
      // 3. Optionally deleting existing messages

      setBlockUserDialog(false);
      toast({
        title: "User Blocked",
        description: `${selectedUser.user_name} has been blocked.`,
      });
    } catch (error: any) {
      console.error("Error blocking user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to block user.",
        variant: "destructive",
      });
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Clear any existing interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        toast({
          title: "Recording Error",
          description: "An error occurred while recording.",
          variant: "destructive",
        });
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      // Start timer - increment state directly to force re-render
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          recordingTimeRef.current = newTime;
          return newTime;
        });
      }, 1000);
    } catch (error: any) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      toast({
        title: "Error",
        description: error.message || "Failed to access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = (): Promise<void> => {
    return new Promise((resolve) => {
      // Stop timer first
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          // Stop stream tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          
          setIsRecording(false);
          recordingTimeRef.current = 0;
          resolve();
        };
        
        mediaRecorderRef.current.stop();
      } else {
        // Stop stream tracks even if recorder is not active
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setIsRecording(false);
        recordingTimeRef.current = 0;
        resolve();
      }
    });
  };

  const sendVoiceMessage = async () => {
    if (!user?.id || !selectedUser) {
      toast({
        title: "Error",
        description: "Please select a user to send the message.",
        variant: "destructive",
      });
      return;
    }

    // Wait for recording to stop and data to be available
    await stopRecording();

    // Wait a bit for all chunks to be collected
    await new Promise(resolve => setTimeout(resolve, 200));

    if (audioChunksRef.current.length === 0) {
      toast({
        title: "Error",
        description: "No audio recorded. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Upload to Supabase Storage
      const fileName = `voice_${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('messages')
        .upload(`${user.id}/${fileName}`, audioBlob, {
          contentType: 'audio/webm',
        });

      if (uploadError) {
        // If bucket doesn't exist, show helpful error
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          toast({
            title: "Storage Setup Required",
            description: "Please create a 'messages' bucket in Supabase Storage with public access.",
            variant: "destructive",
          });
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('messages')
        .getPublicUrl(`${user.id}/${fileName}`);

      // Send message with voice
      const { data, error } = await supabase
        .from("messages")
        // @ts-ignore
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser.user_id,
          message: "Voice message",
          message_type: 'voice',
          media_url: urlData.publicUrl,
          media_type: 'voice',
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Clear recording
      audioChunksRef.current = [];
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      setIsUploading(false);

      toast({
        title: "Voice message sent",
        description: "Your voice message has been sent.",
      });
    } catch (error: any) {
      console.error("Error sending voice message:", error);
      setIsUploading(false);
      toast({
        title: "Error",
        description: error.message || "Failed to send voice message.",
        variant: "destructive",
      });
    }
  };

  // Media upload functions
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview({ url, type: 'image' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File must be less than 50MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setMediaPreview({ url: '', type: 'file', name: file.name });
  };

  const sendMediaMessage = async () => {
    if (!user?.id || !selectedUser || !selectedFile) return;

    try {
      setIsUploading(true);
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const fileType = selectedFile.type.startsWith('image/') ? 'image' : 'file';

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('messages')
        .upload(`${user.id}/${fileName}`, selectedFile, {
          contentType: selectedFile.type,
        });

      if (uploadError) {
        // If bucket doesn't exist, show helpful error
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          toast({
            title: "Storage Setup Required",
            description: "Please create a 'messages' bucket in Supabase Storage with public access.",
            variant: "destructive",
          });
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('messages')
        .getPublicUrl(`${user.id}/${fileName}`);

      // Send message with media
      const { data, error } = await supabase
        .from("messages")
        // @ts-ignore
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser.user_id,
          message: newMessage.trim() || (fileType === 'image' ? 'Image' : selectedFile.name),
          message_type: 'media',
          media_url: urlData.publicUrl,
          media_type: fileType,
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Clear media
      setSelectedFile(null);
      setMediaPreview(null);
      setNewMessage("");
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';

      toast({
        title: "Media sent",
        description: "Your media has been sent.",
      });
    } catch (error: any) {
      console.error("Error sending media:", error);
      setIsUploading(false);
      toast({
        title: "Error",
        description: error.message || "Failed to send media.",
        variant: "destructive",
      });
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAudioTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle voice message play/pause
  const handleVoicePlayPause = (msgId: string, audioUrl: string) => {
    // Stop any currently playing audio
    if (playingAudioId && playingAudioId !== msgId) {
      const currentAudio = audioRefs.current[playingAudioId];
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        const interval = progressIntervalRefs.current[playingAudioId];
        if (interval) {
          clearInterval(interval);
          delete progressIntervalRefs.current[playingAudioId];
        }
      }
      setPlayingAudioId(null);
    }

    // Get or create audio element
    let audio = audioRefs.current[msgId];
    if (!audio) {
      audio = new Audio(audioUrl);
      audioRefs.current[msgId] = audio;
      audio.preload = 'metadata'; // Load metadata immediately

      // Set up event listeners
      const handleLoadedMetadata = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setAudioProgress((prev) => ({
            ...prev,
            [msgId]: {
              current: prev[msgId]?.current || 0,
              duration: audio.duration,
            },
          }));
        }
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('durationchange', handleLoadedMetadata);
      audio.addEventListener('canplay', () => {
        if (audio.duration && isFinite(audio.duration)) {
          setAudioProgress((prev) => ({
            ...prev,
            [msgId]: {
              current: prev[msgId]?.current || 0,
              duration: audio.duration,
            },
          }));
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.paused) {
          setAudioProgress((prev) => ({
            ...prev,
            [msgId]: {
              current: audio.currentTime,
              duration: prev[msgId]?.duration || (audio.duration && isFinite(audio.duration) ? audio.duration : 0),
            },
          }));
        }
      });

      audio.addEventListener('ended', () => {
        setPlayingAudioId(null);
        setAudioProgress((prev) => ({
          ...prev,
          [msgId]: {
            current: 0,
            duration: prev[msgId]?.duration || 0,
          },
        }));
        const interval = progressIntervalRefs.current[msgId];
        if (interval) {
          clearInterval(interval);
          delete progressIntervalRefs.current[msgId];
        }
      });

      audio.addEventListener('error', () => {
        setPlayingAudioId(null);
        toast({
          title: "Error",
          description: "Failed to play audio message.",
          variant: "destructive",
        });
      });

      // Try to load metadata immediately
      try {
        audio.load();
      } catch (err) {
        console.error(`Error loading audio for message ${msgId}:`, err);
      }
    }

    // If duration is not loaded yet, try loading it
    if (!audioProgress[msgId]?.duration && audio.readyState >= 1 && audio.duration && isFinite(audio.duration)) {
      setAudioProgress((prev) => ({
        ...prev,
        [msgId]: {
          current: prev[msgId]?.current || 0,
          duration: audio.duration,
        },
      }));
    }

    // Toggle play/pause
    if (playingAudioId === msgId) {
      // Pause
      audio.pause();
      setPlayingAudioId(null);
      const interval = progressIntervalRefs.current[msgId];
      if (interval) {
        clearInterval(interval);
        delete progressIntervalRefs.current[msgId];
      }
    } else {
      // Play
      audio.play().catch((error) => {
        console.error("Error playing audio:", error);
        toast({
          title: "Error",
          description: "Failed to play audio message.",
          variant: "destructive",
        });
      });
      setPlayingAudioId(msgId);

      // Start progress tracking using timeupdate event (more reliable)
      // The timeupdate event is already handled above, but we keep interval as backup
      const interval = setInterval(() => {
        if (audio && !audio.paused && audio.readyState >= 2) {
          setAudioProgress((prev) => ({
            ...prev,
            [msgId]: {
              current: audio.currentTime,
              duration: prev[msgId]?.duration || audio.duration || 0,
            },
          }));
        }
      }, 100);
      progressIntervalRefs.current[msgId] = interval;
    }
  };

  // Preload audio metadata for all voice messages - runs immediately when messages change
  useEffect(() => {
    if (messages.length === 0) return;

    const loadAudioMetadata = async (msg: Message) => {
      if (!msg.media_url || msg.message_type !== 'voice') {
        return;
      }

      // Get or create audio element
      let audio = audioRefs.current[msg.id];
      if (!audio) {
        audio = new Audio(msg.media_url);
        audio.preload = 'metadata';
        audioRefs.current[msg.id] = audio;

        const updateDuration = () => {
          if (audio && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            // Force state update by always creating a new object
            setAudioProgress((prev) => {
              const currentDuration = prev[msg.id]?.duration || 0;
              // Always update if current duration is 0 or significantly different
              if (currentDuration === 0 || Math.abs(currentDuration - audio.duration) > 0.1) {
                // Create a completely new object to force React re-render
                const newProgress = {
                  ...prev,
                  [msg.id]: {
                    current: prev[msg.id]?.current || 0,
                    duration: audio.duration,
                  },
                };
                return newProgress;
              }
              // Even if duration hasn't changed, return a new object to ensure React sees the update
              return {
                ...prev,
                [msg.id]: {
                  current: prev[msg.id]?.current || 0,
                  duration: prev[msg.id]?.duration || audio.duration,
                },
              };
            });
          }
        };

        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('durationchange', updateDuration);
        audio.addEventListener('canplay', updateDuration);
        audio.addEventListener('loadeddata', updateDuration);
        audio.addEventListener('progress', updateDuration);

        audio.addEventListener('error', (e) => {
          console.error(`Failed to load audio metadata for message ${msg.id}:`, e);
        });

        // Trigger metadata load immediately
        try {
          audio.load();
        } catch (err) {
          console.error(`Error loading audio for message ${msg.id}:`, err);
        }
      }

      // Always check duration for existing audio elements too
      if (audio) {
        // Immediate check if duration is already available
        const checkAndUpdateDuration = () => {
          if (audio && audio.readyState >= 1 && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setAudioProgress((prev) => {
              const currentDuration = prev[msg.id]?.duration || 0;
              if (currentDuration === 0 || Math.abs(currentDuration - audio.duration) > 0.1) {
                // Always create a new object to force React re-render
                return {
                  ...prev,
                  [msg.id]: {
                    current: prev[msg.id]?.current || 0,
                    duration: audio.duration,
                  },
                };
              }
              // Return new object even if duration hasn't changed
              return {
                ...prev,
                [msg.id]: {
                  current: prev[msg.id]?.current || 0,
                  duration: prev[msg.id]?.duration || audio.duration,
                },
              };
            });
          }
        };

        // Check immediately
        checkAndUpdateDuration();

        // Multiple fallback checks with increasing delays
        const checkDuration = (delay: number) => {
          setTimeout(() => {
            checkAndUpdateDuration();
          }, delay);
        };

        // Check at multiple intervals - more aggressive for immediate display
        checkDuration(50);
        checkDuration(100);
        checkDuration(200);
        checkDuration(300);
        checkDuration(500);
        checkDuration(1000);
        checkDuration(2000);
      }
    };

    // Load metadata for all voice messages immediately
    messages.forEach((msg) => {
      loadAudioMetadata(msg);
    });

    // Immediate check for all voice messages
    setTimeout(() => {
      messages.forEach((msg) => {
        if (msg.media_url && msg.message_type === 'voice') {
          const audio = audioRefs.current[msg.id];
          if (audio && audio.readyState >= 1 && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setAudioProgress((prev) => {
              const currentDuration = prev[msg.id]?.duration || 0;
              if (currentDuration === 0 || Math.abs(currentDuration - audio.duration) > 0.1) {
                // Always create a new object to force React re-render
                return {
                  ...prev,
                  [msg.id]: {
                    current: prev[msg.id]?.current || 0,
                    duration: audio.duration,
                  },
                };
              }
              // Return new object even if duration hasn't changed
              return {
                ...prev,
                [msg.id]: {
                  current: prev[msg.id]?.current || 0,
                  duration: prev[msg.id]?.duration || audio.duration,
                },
              };
            });
          }
        }
      });
    }, 100);

    // Periodic check for all voice messages (runs every 500ms for faster updates)
    const intervalId = setInterval(() => {
      messages.forEach((msg) => {
        if (msg.media_url && msg.message_type === 'voice') {
          const audio = audioRefs.current[msg.id];
          if (audio && audio.readyState >= 1 && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setAudioProgress((prev) => {
              const currentDuration = prev[msg.id]?.duration || 0;
              if (currentDuration === 0 || Math.abs(currentDuration - audio.duration) > 0.1) {
                // Always create a new object to force React re-render
                return {
                  ...prev,
                  [msg.id]: {
                    current: prev[msg.id]?.current || 0,
                    duration: audio.duration,
                  },
                };
              }
              // Return new object even if duration hasn't changed
              return {
                ...prev,
                [msg.id]: {
                  current: prev[msg.id]?.current || 0,
                  duration: prev[msg.id]?.duration || audio.duration,
                },
              };
            });
          }
        }
      });
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [messages]);

  // Cleanup audio refs on unmount
  useEffect(() => {
    return () => {
      // Stop all audio
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      // Clear all intervals
      Object.values(progressIntervalRefs.current).forEach((interval) => {
        clearInterval(interval);
      });
    };
  }, []);

  // Persist selected chat to localStorage so widget can restore it on other routes
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (selectedUser) {
      const data = {
        selectedUser,
        isMinimized: location.pathname === '/messaging' ? false : true,
        chatOpen: true,
      };
      localStorage.setItem(`chat_widget_${user.id}`, JSON.stringify(data));
    } else {
      localStorage.removeItem(`chat_widget_${user.id}`);
    }
  }, [selectedUser, user?.id, location.pathname]);

  // Detect mobile viewport
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 768);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-56">
        {(!isMobile || !selectedUser) && <Header />}
        <main className="flex-1 overflow-hidden pt-0 pb-[65px] lg:pb-0">
          <div className="w-full h-full">
            <div className="bg-card h-full flex flex-col">
              <div className="flex h-full">
                {/* Users List - Modern Design */}
                {(isMobile ? !selectedUser : true) && (
                  <div className="w-full md:w-80 border-r border-border/50 flex flex-col bg-gradient-to-b from-card to-muted/10">
                    <div className="p-4 md:p-5 border-b border-border/50 bg-card/80 backdrop-blur-sm">
                      <h2 className="text-xl font-bold flex items-center gap-2 bg-gradient-primary bg-clip-text text-transparent">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        Messages
                        {totalPendingCount > 0 && (
                          <Badge variant="destructive" className="ml-2 animate-pulse">
                            {totalPendingCount}
                          </Badge>
                        )}
                      </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {users.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No users found</p>
                        </div>
                      ) : (
                        users.map((userProfile) => (
                          <div
                            key={userProfile.user_id}
                            onClick={() => setSelectedUser(userProfile)}
                            className={`p-3 md:p-4 border-b border-border/30 cursor-pointer transition-all duration-200 ${
                              selectedUser?.user_id === userProfile.user_id
                                ? "bg-primary/10 border-l-4 border-l-primary shadow-sm"
                                : "hover:bg-muted/30 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-base shadow-md transition-transform ${
                                  selectedUser?.user_id === userProfile.user_id
                                    ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground scale-105"
                                    : "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
                                }`}>
                                  {userProfile.user_name
                                    ? userProfile.user_name.charAt(0).toUpperCase()
                                    : "U"}
                                </div>
                                {isUserCurrentlyOnline(userProfile) && (
                                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card shadow-sm animate-pulse"></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-sm truncate">
                                    {userProfile.user_name}
                                  </p>
                                  {isUserCurrentlyOnline(userProfile) ? (
                                    <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                      Online
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {formatLastSeen(userProfile.last_seen)}
                                    </span>
                                  )}
                                </div>
                                {userProfile.employee_id && (
                                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                    <span className="opacity-60">ID:</span>
                                    {userProfile.employee_id}
                                  </p>
                                )}
                              </div>
                              {(pendingCounts[userProfile.user_id] > 0) && (
                                <Badge variant="destructive" className="shrink-0 h-5 min-w-5 px-1.5 text-xs font-bold animate-pulse">
                                  {pendingCounts[userProfile.user_id]}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Messages Area */}
                {(isMobile ? !!selectedUser : true) && (
                  <div className="flex-1 flex flex-col">
                    {selectedUser ? (
                      <>
                        <div className="p-4 md:p-5 border-b border-border/50 bg-gradient-to-r from-card to-card/50 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              {isMobile && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-full hover:bg-muted"
                                  onClick={() => setSelectedUser(null)}
                                >
                                  <ArrowLeft className="h-4 w-4" />
                                </Button>
                              )}
                              <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-semibold text-lg shadow-md">
                                  {selectedUser.user_name
                                    ? selectedUser.user_name.charAt(0).toUpperCase()
                                    : "U"}
                                </div>
                                {isUserCurrentlyOnline(selectedUser) && (
                                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card shadow-sm animate-pulse"></div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-base">
                                  {selectedUser.user_name}
                                </p>
                                {selectedUser.employee_id && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="opacity-60">ID:</span>
                                    {selectedUser.employee_id}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  {isUserCurrentlyOnline(selectedUser) ? (
                                    <>
                                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                      <span className="text-green-500 font-medium">Online</span>
                                    </>
                                  ) : (
                                    <>Last seen: {formatLastSeen(selectedUser.last_seen)}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => setClearChatDialog(true)}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Clear Chat
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setBlockUserDialog(true)}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Block User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gradient-to-b from-background to-muted/20">
                          {messages.map((msg, index) => {
                            const isOwn = msg.sender_id === user?.id;
                            const isSending = msg.status === 'sending';
                            
                            // Simplified status logic: check status field directly
                            // Priority: read > delivered > sent
                            const isRead = msg.status === 'read';
                            const isDelivered = msg.status === 'delivered';
                            const isSent = msg.status === 'sent' && !isDelivered && !isRead;
                            
                            return (
                              <div
                                key={`${msg.id}-${index}`}
                                className={`flex flex-col ${isOwn ? "items-end" : "items-start"} group mb-1`}
                              >
                                <div
                                  className={`max-w-[80%] md:max-w-[60%] rounded-xl p-3 md:p-4 shadow-sm transition-all duration-200 ${
                                    isOwn
                                      ? "bg-gradient-to-br from-primary/10 via-primary/20 to-primary/10 text-primary"
                                      : "bg-muted text-foreground"
                                  } ${isSending ? "opacity-70" : ""}`}
                                >
                                  {msg.media_url && msg.message_type === 'media' ? (
                                    msg.media_type === 'image' ? (
                                      <img
                                        src={msg.media_url}
                                        alt="Shared image"
                                        className="rounded-md max-w-[220px] cursor-pointer"
                                        onClick={() => window.open(msg.media_url!, '_blank')}
                                      />
                                    ) : (
                                      <a
                                        href={msg.media_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors text-sm"
                                      >
                                        <Paperclip className="h-4 w-4" />
                                        <span className="truncate max-w-[160px]">{msg.message || 'File'}</span>
                                      </a>
                                    )
                                  ) : msg.media_url && msg.message_type === 'voice' ? (
                                    <div className="mb-2 flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-full shrink-0"
                                        onClick={() => handleVoicePlayPause(msg.id, msg.media_url!)}
                                      >
                                        {playingAudioId === msg.id ? (
                                          <Pause className="h-5 w-5" />
                                        ) : (
                                          <Play className="h-5 w-5" />
                                        )}
                                      </Button>
                                      <div className="flex-1 min-w-0">
                                        <div 
                                          className="h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
                                          onClick={(e) => {
                                            const audio = audioRefs.current[msg.id];
                                            if (audio && audioProgress[msg.id]) {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              const clickX = e.clientX - rect.left;
                                              const percentage = clickX / rect.width;
                                              const newTime = percentage * audioProgress[msg.id].duration;
                                              audio.currentTime = newTime;
                                              setAudioProgress((prev) => ({
                                                ...prev,
                                                [msg.id]: {
                                                  current: newTime,
                                                  duration: prev[msg.id]?.duration || 0,
                                                },
                                              }));
                                            }
                                          }}
                                        >
                                          <div 
                                            className="h-full bg-primary/50 transition-all duration-100"
                                            style={{ 
                                              width: audioProgress[msg.id]?.duration 
                                                ? `${(audioProgress[msg.id].current / audioProgress[msg.id].duration) * 100}%` 
                                                : '0%' 
                                            }}
                                          ></div>
                                        </div>
                                        <div className="flex items-center justify-between mt-1.5">
                                          <p className="text-xs text-muted-foreground">Voice message</p>
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                                            <span key={`current-${msg.id}-${audioProgress[msg.id]?.current || 0}`}>
                                              {formatAudioTime(audioProgress[msg.id]?.current || 0)}
                                            </span>
                                            <span>/</span>
                                            <span key={`duration-${msg.id}-${audioProgress[msg.id]?.duration || 0}`}>
                                              {audioProgress[msg.id]?.duration && audioProgress[msg.id].duration > 0
                                                ? formatAudioTime(audioProgress[msg.id].duration)
                                                : '0:00'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : msg.message ? (
                                    <p className="text-sm break-words">
                                      {msg.message}
                                    </p>
                                  ) : null}
                                </div>
                                {/* Time and Status Dots - Below Bubble */}
                                {isOwn && (
                                  <div className={`flex items-center gap-1.5 mt-1 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    <p className="text-[10px] text-gray-400">
                                      {new Date(msg.created_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                    {isSending ? (
                                      <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-400" />
                                    ) : (
                                      <>
                                        {/* Priority: read > delivered > sent */}
                                        {isRead ? (
                                          <>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                          </>
                                        ) : isDelivered ? (
                                          <>
                                            {/* 2 grey dots = delivered (user received it) */}
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                          </>
                                        ) : isSent ? (
                                          <>
                                            {/* 1 grey dot = sent (message sent from sender) */}
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                          </>
                                        ) : null}
                                      </>
                                    )}
                                  </div>
                                )}
                                {/* Time for received messages */}
                                {!isOwn && (
                                  <div className="flex items-center gap-1.5 mt-1 px-1">
                                    <p className="text-[10px] text-gray-400">
                                      {new Date(msg.created_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                        {/* Media Preview */}
                        {mediaPreview && (
                          <div className="px-4 pt-4 border-t border-border/50">
                            <div className="relative inline-block">
                              {mediaPreview.type === 'image' ? (
                                <img
                                  src={mediaPreview.url}
                                  alt="Preview"
                                  className="max-w-xs max-h-48 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                  <Paperclip className="h-5 w-5" />
                                  <span className="text-sm">{mediaPreview.name}</span>
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                  setMediaPreview(null);
                                  setSelectedFile(null);
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                  if (imageInputRef.current) imageInputRef.current.value = '';
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Voice Recording UI */}
                        {isRecording && (
                          <div className="px-4 pt-4 border-t border-border/50">
                            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse"></div>
                                <span className="text-sm font-medium">Recording...</span>
                                <span className="text-sm text-muted-foreground font-mono min-w-[3rem]">
                                  {formatRecordingTime(recordingTime)}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    await stopRecording();
                                    audioChunksRef.current = [];
                                    setRecordingTime(0);
                                    recordingTimeRef.current = 0;
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={sendVoiceMessage}
                                  disabled={isUploading}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    "Send"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="p-3 md:p-4 border-t border-border/50 bg-card/50 backdrop-blur-sm mb-0">
                          <div className="flex items-end gap-1.5 md:gap-2">
                            {/* Hidden file inputs */}
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageSelect}
                            />
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="hidden"
                              onChange={handleFileSelect}
                            />

                            {/* Action Buttons */}
                            <div className="flex gap-1">
                              {isMobile ? (
                                <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-full hover:bg-primary/10"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48 p-2">
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-full hover:bg-primary/10"
                                        onClick={() => {
                                          imageInputRef.current?.click();
                                          setActionsOpen(false);
                                        }}
                                        disabled={isRecording || isUploading}
                                      >
                                        <Image className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-full hover:bg-primary/10"
                                        onClick={() => {
                                          fileInputRef.current?.click();
                                          setActionsOpen(false);
                                        }}
                                        disabled={isRecording || isUploading}
                                      >
                                        <Paperclip className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-9 w-9 rounded-full ${
                                          isRecording
                                            ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                            : "hover:bg-primary/10"
                                        }`}
                                        onClick={async () => {
                                          if (isRecording) {
                                            await stopRecording();
                                          } else {
                                            await startRecording();
                                          }
                                          setActionsOpen(false);
                                        }}
                                        disabled={isUploading}
                                      >
                                        <Mic className="h-4 w-4" />
                                      </Button>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 rounded-full hover:bg-primary/10"
                                          >
                                            <Smile className="h-4 w-4" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 grid grid-cols-6 gap-2 p-2">
                                          {emojiList.map((emoji) => (
                                            <button
                                              key={emoji}
                                              type="button"
                                              className="text-xl hover:scale-110 transition-transform"
                                              onClick={() => {
                                                setNewMessage((prev) => prev + emoji);
                                                setActionsOpen(false);
                                              }}
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-primary/10"
                                    onClick={() => imageInputRef.current?.click()}
                                    disabled={isRecording || isUploading}
                                  >
                                    <Image className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full hover:bg-primary/10"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isRecording || isUploading}
                                  >
                                    <Paperclip className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 rounded-full ${
                                      isRecording
                                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                        : "hover:bg-primary/10"
                                    }`}
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isUploading}
                                  >
                                    <Mic className="h-4 w-4" />
                                  </Button>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-full hover:bg-primary/10"
                                      >
                                        <Smile className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 grid grid-cols-6 gap-2 p-2">
                                      {emojiList.map((emoji) => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          className="text-xl hover:scale-110 transition-transform"
                                          onClick={() => {
                                            setNewMessage((prev) => prev + emoji);
                                            if (isMobile) {
                                              setActionsOpen(false);
                                            }
                                          }}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </PopoverContent>
                                  </Popover>
                                </>
                              )}
                            </div>

                            {/* Message Input */}
                            <div className="flex-1 relative">
                              <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey && !isRecording) {
                                    e.preventDefault();
                                    if (selectedFile) {
                                      sendMediaMessage();
                                    } else {
                                      handleSendMessage();
                                    }
                                  }
                                }}
                                placeholder={isRecording ? "Recording voice message..." : "Type a message..."}
                                className="border-0 focus:border-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 h-9 md:h-10"
                                disabled={isRecording || isUploading}
                              />
                            </div>

                            {/* Send Button */}
                            <Button
                              onClick={() => {
                                if (selectedFile) {
                                  sendMediaMessage();
                                } else {
                                  handleSendMessage();
                                }
                              }}
                              disabled={(!newMessage.trim() && !selectedFile) || isRecording || isUploading}
                              className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                              size="icon"
                            >
                              {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a user to start messaging
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
        <MobileNav />
      </div>

      {/* New Message Popup */}
      <Dialog
        open={newMessageDialog.open}
        onOpenChange={(open) =>
          setNewMessageDialog({ ...newMessageDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              {newMessageDialog.sender && (
                <div className="mt-2">
                  <p className="font-semibold">
                    {newMessageDialog.sender.user_name}
                  </p>
                  {newMessageDialog.sender.employee_id && (
                    <p className="text-xs text-muted-foreground">
                      {newMessageDialog.sender.employee_id}
                    </p>
                  )}
                  <p className="mt-2 text-sm">{newMessageDialog.message}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() =>
                setNewMessageDialog({ ...newMessageDialog, open: false })
              }
            >
              Close
            </Button>
            {newMessageDialog.sender && (
              <Button
                onClick={() => {
                  setSelectedUser(newMessageDialog.sender);
                  setNewMessageDialog({ ...newMessageDialog, open: false });
                }}
              >
                Open Chat
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Chat Dialog */}
      <AlertDialog open={clearChatDialog} onOpenChange={setClearChatDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all messages with {selectedUser?.user_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block User Dialog */}
      <AlertDialog open={blockUserDialog} onOpenChange={setBlockUserDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block {selectedUser?.user_name}? You will not be able to receive messages from them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Block User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Messaging;

