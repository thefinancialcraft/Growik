import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, Minimize2, Maximize2, Loader2, Image, Paperclip, Smile } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  media_url?: string;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'file'; name?: string } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMinimizedRef = useRef<boolean>(isMinimized);
  const isMobileRef = useRef<boolean>(false);
  const emojiList = [
    "😀","😂","😊","😍","😘","🤩","😉","🙌","👍","🙏",
    "🔥","💯","🎉","🥳","😎","🤔","😢","😭","😡","🤯",
    "😴","🤗","😇","😋","🤤","😜"
  ];

  // Load widget state from localStorage (check immediately when not on messaging page)
  useEffect(() => {
    if (isMobile) {
      setSelectedUser(null);
      return;
    }

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
  }, [user?.id, location.pathname, isMobile]);

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

  }, [user?.id, selectedUser, isMobile]);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  useEffect(() => {
    const updateIsMobile = () => {
      const mobile = typeof window !== "undefined" && window.innerWidth < 768;
      setIsMobile(mobile);
      isMobileRef.current = mobile;
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);

    return () => {
      window.removeEventListener("resize", updateIsMobile);
    };
  }, []);

  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized]);

  // Listen for localStorage changes (when Messaging component updates widget state)
  useEffect(() => {
    if (!user?.id || isMobile) return;

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
  }, [user?.id, selectedUser, location.pathname, isMobile]);

  useEffect(() => {
    return () => {
      if (mediaPreview?.url && mediaPreview.type === 'image') {
        URL.revokeObjectURL(mediaPreview.url);
      }
    };
  }, [mediaPreview]);

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

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (mediaPreview?.url && mediaPreview.type === 'image') {
      URL.revokeObjectURL(mediaPreview.url);
    }
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const sendMediaMessage = async () => {
    if (!user?.id || !selectedUser || !selectedFile) return;

    try {
      setIsUploading(true);
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const fileType = selectedFile.type.startsWith('image/') ? 'image' : 'file';

      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(`${user.id}/${fileName}`, selectedFile, {
          contentType: selectedFile.type,
        });

      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found')) {
          toast({
            title: "Storage Setup Required",
            description: "Please create a 'messages' bucket in Supabase Storage with public access.",
            variant: "destructive",
          });
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('messages')
        .getPublicUrl(`${user.id}/${fileName}`);

      const { error } = await supabase
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
        });

      if (error) throw error;

      clearSelectedFile();
      setNewMessage('');
      toast({
        title: "Media sent",
        description: "Your media has been sent.",
      });
    } catch (error: any) {
      console.error("Error sending media:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send media.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = () => {
    if (selectedFile) {
      sendMediaMessage();
    } else {
      handleSendMessage();
    }
  };

  // Don't show widget if on messaging page or no selectedUser
  if (isMobile || location.pathname === '/messaging') {
    return null;
  }

  if (!selectedUser || !user?.id) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        isMinimized ? 'w-72 h-14' : 'w-80 h-96'
      }`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      <div className="bg-card border border-border/50 rounded-lg shadow-2xl overflow-hidden h-full flex flex-col">
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
                isMinimizedRef.current = newMinimized;
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
            <div className="bg-card flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
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
                        {msg.media_url && msg.message_type === 'media' ? (
                          msg.media_type === 'image' ? (
                            <img
                              src={msg.media_url}
                              alt="Shared image"
                              className="rounded-md max-w-[180px] cursor-pointer"
                              onClick={() => window.open(msg.media_url, '_blank')}
                            />
                          ) : (
                            <a
                              href={msg.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline"
                            >
                              {msg.message || 'File'}
                            </a>
                          )
                        ) : msg.message && msg.message_type !== 'voice' ? (
                          <p className="break-words">
                            {msg.message.length > 50
                              ? msg.message.substring(0, 50) + "..."
                              : msg.message}
                          </p>
                        ) : msg.message_type === 'voice' ? (
                          <p className="text-muted-foreground italic">Voice message</p>
                        ) : null}
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
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Widget Footer */}
            <div className="p-2 border-t border-border/50 bg-card">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isSending && !isUploading && !selectedFile) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={isSending}
                  className="focus:border-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  onClick={handleSend}
                  disabled={(!newMessage.trim() && !selectedFile) || isSending || isUploading}
                  className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 p-0"
                  size="icon"
                >
                  {isSending || isUploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-primary/10"
                        disabled={isSending || isUploading}
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 grid grid-cols-6 gap-2 p-3">
                      {emojiList.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="text-xl hover:scale-110 transition-transform"
                          onClick={() => setNewMessage((prev) => prev + emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-primary/10"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isSending || isUploading}
                  >
                    <Image className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-primary/10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isUploading}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {mediaPreview && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {mediaPreview.type === 'image' ? (
                      <div className="flex items-center gap-2">
                        <span>Image ready to send</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => mediaPreview.url && window.open(mediaPreview.url, '_blank')}
                        >
                          Open
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[120px]">{mediaPreview.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            if (selectedFile) {
                              const fileUrl = URL.createObjectURL(selectedFile);
                              window.open(fileUrl, '_blank');
                              // No revoke here to keep file accessible; will be cleared on removal
                            }
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full"
                      onClick={clearSelectedFile}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
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

