import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, Minimize2, Maximize2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  user_id: string;
  user_name: string;
  employee_id?: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type?: 'text' | 'media' | 'voice';
  media_type?: 'image' | 'file' | 'voice';
  created_at: string;
}

const ChatWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  // Load widget state from localStorage (check immediately when not on messaging page)
  useEffect(() => {
    if (!user?.id || location.pathname === '/messaging') {
      setSelectedUser(null);
      return;
    }

    // Load from localStorage immediately
    const stored = localStorage.getItem(`chat_widget_${user.id}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.selectedUser) {
          setSelectedUser(data.selectedUser);
          setIsMinimized(data.isMinimized ?? true);
        }
      } catch (e) {
        console.error('Error loading chat widget:', e);
      }
    }
  }, [user?.id, location.pathname]);

  // Clear widget if localStorage is cleared
  useEffect(() => {
    if (!user?.id) return;
    
    const stored = localStorage.getItem(`chat_widget_${user.id}`);
    if (!stored && selectedUser) {
      setSelectedUser(null);
    }
  }, [user?.id, selectedUser]);

  // Fetch messages when selectedUser changes
  useEffect(() => {
    if (!user?.id || !selectedUser) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${user.id})`
          )
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) throw error;
        if (data) {
          setMessages(data.reverse() as Message[]);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();

    // Set up real-time subscription
    const channel = supabase
      .channel(`chat_widget_${user.id}_${selectedUser.user_id}`)
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
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMsg.id);
              if (exists) return prev;
              return [...prev, newMsg].slice(-5);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedUser]);

  // Listen for localStorage changes (when Messaging component updates widget state)
  useEffect(() => {
    if (!user?.id) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `chat_widget_${user.id}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.selectedUser) {
            setSelectedUser(data.selectedUser);
            setIsMinimized(data.isMinimized ?? true);
          }
        } catch (e) {
          console.error('Error handling storage change:', e);
        }
      } else if (e.key === `chat_widget_${user.id}` && !e.newValue) {
        setSelectedUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check localStorage periodically (for same-tab updates) - more frequent
    const interval = setInterval(() => {
      if (location.pathname === '/messaging') return; // Don't check on messaging page
      
      const stored = localStorage.getItem(`chat_widget_${user.id}`);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (data.selectedUser) {
            // Always update if localStorage has data (even if selectedUser exists)
            if (!selectedUser || selectedUser.user_id !== data.selectedUser.user_id) {
              setSelectedUser(data.selectedUser);
            }
            setIsMinimized(data.isMinimized ?? true);
          }
        } catch (e) {
          // Ignore
        }
      } else if (selectedUser) {
        setSelectedUser(null);
      }
    }, 200); // Check every 200ms for faster updates

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user?.id, selectedUser, location.pathname]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !selectedUser || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    try {
      const { error } = await supabase
        .from("messages")
        // @ts-ignore - Supabase type inference issue
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser.user_id,
          message: messageText,
          status: 'sent',
        });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
      toast({
        title: "Error",
        description: error.message || "Failed to send message.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Don't show widget if on messaging page or no selectedUser
  if (location.pathname === '/messaging') {
    return null;
  }

  if (!selectedUser || !user?.id) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        isMinimized ? 'w-72' : 'w-80'
      }`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      <div className="bg-card border border-border/50 rounded-lg shadow-2xl overflow-hidden">
        {/* Widget Header */}
        <div className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground p-3 flex items-center justify-between">
          <div
            className="flex items-center gap-2 flex-1 cursor-pointer"
            onClick={() => {
              if (isMinimized) {
                setIsMinimized(false);
                if (user?.id) {
                  localStorage.setItem(`chat_widget_${user.id}`, JSON.stringify({
                    selectedUser,
                    isMinimized: false,
                  }));
                }
              } else {
                navigate('/messaging');
              }
            }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
              {selectedUser.user_name
                ? selectedUser.user_name.charAt(0).toUpperCase()
                : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {selectedUser.user_name}
              </p>
              {selectedUser.employee_id && (
                <p className="text-xs opacity-90 truncate">
                  ID: {selectedUser.employee_id}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-white/20 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                const newMinimized = !isMinimized;
                setIsMinimized(newMinimized);
                if (user?.id) {
                  localStorage.setItem(`chat_widget_${user.id}`, JSON.stringify({
                    selectedUser,
                    isMinimized: newMinimized,
                  }));
                }
              }}
            >
              {isMinimized ? (
                <Maximize2 className="h-3.5 w-3.5" />
              ) : (
                <Minimize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-white/20 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedUser(null);
                if (user?.id) {
                  localStorage.removeItem(`chat_widget_${user.id}`);
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Widget Content */}
        {!isMinimized && (
          <>
            <div className="bg-card max-h-96 overflow-y-auto">
              <div className="p-3 space-y-2">
                {messages.map((msg, index) => {
                  const isOwn = msg.sender_id === user.id;
                  return (
                    <div
                      key={`${msg.id}-${index}`}
                      className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-2 text-xs ${
                          isOwn
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {msg.message && msg.message_type !== 'voice' && (
                          <p className="break-words">
                            {msg.message.length > 50
                              ? msg.message.substring(0, 50) + "..."
                              : msg.message}
                          </p>
                        )}
                        {msg.message_type === 'voice' && (
                          <p className="text-muted-foreground italic">Voice message</p>
                        )}
                        {msg.message_type === 'media' && (
                          <p className="text-muted-foreground italic">
                            {msg.media_type === 'image' ? 'Image' : 'File'}
                          </p>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No messages yet
                  </p>
                )}
              </div>
            </div>

            {/* Widget Footer */}
            <div className="p-2 border-t border-border/50 bg-card">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isSending) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 h-8 text-xs rounded-full border-2 focus:border-primary/50"
                  disabled={isSending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 p-0"
                  size="icon"
                >
                  {isSending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="mt-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigate('/messaging')}
                >
                  Open Full Chat
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatWidget;

