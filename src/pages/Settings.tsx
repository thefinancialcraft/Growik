import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  user_name?: string;
  email?: string;
  contact_no?: string;
  employee_id?: string;
}

const Settings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    employeeId: "",
  });

  // Parse name into first and last name
  const parseName = (fullName?: string) => {
    if (!fullName) return { first: "", last: "" };
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return { first: parts[0], last: "" };
    const first = parts[0];
    const last = parts.slice(1).join(" ");
    return { first, last };
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id) {
        try {
          const { getUserProfile } = await import('@/lib/userProfile');
          const data = await getUserProfile(user.id);

          if (data) {
            setProfile(data);
            const { first, last } = parseName(data.user_name || '');
            setFormData({
              firstName: first || user.user_metadata?.first_name || "",
              lastName: last || user.user_metadata?.last_name || "",
              email: data.email || user.email || "",
              phone: data.contact_no || user.user_metadata?.contact_no || "",
              employeeId: data.employee_id || "",
            });
          } else {
            // If no profile, use user metadata
            setFormData({
              firstName: user.user_metadata?.first_name || "",
              lastName: user.user_metadata?.last_name || "",
              email: user.email || "",
              phone: user.user_metadata?.contact_no || "",
              employeeId: "",
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Fallback to user metadata
          setFormData({
            firstName: user.user_metadata?.first_name || "",
            lastName: user.user_metadata?.last_name || "",
            email: user.email || "",
            phone: user.user_metadata?.contact_no || "",
            employeeId: "",
          });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    try {
      if (user?.id && profile) {
        const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
        const { updateUserProfile } = await import('@/lib/userProfile');
        const updated = await updateUserProfile(user.id, {
            user_name: fullName || profile.user_name,
            contact_no: formData.phone || profile.contact_no,
            email: formData.email || profile.email,
        } as any);

        if (!updated) {
          throw new Error('Failed to update profile');
        }

        // Update local profile state
        setProfile(updated);

        toast({
          title: "Settings saved",
          description: "Your profile has been updated successfully",
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getInitials = () => {
    if (formData.firstName) {
      return formData.firstName.charAt(0).toUpperCase();
    }
    if (profile?.user_name) {
      return profile.user_name.charAt(0).toUpperCase();
    }
    const email = formData.email || user?.email || "";
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex min-h-screen bg-gradient-subtle">
      <Sidebar />
      
      <div className="flex-1 lg:ml-56">
        <Header />
        <main className="container mx-auto px-4 py-4 space-y-4 pb-24 lg:pb-6 animate-fade-in max-w-7xl">
          <div>
            <h1 className="text-xl md:text-2xl font-bold mb-1">Settings</h1>
            <p className="text-muted-foreground text-sm">Manage your account and application preferences</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className="bg-card border border-border/50">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading profile...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xl font-bold shadow-glow">
                          {getInitials()}
                        </div>
                        <div>
                          <Button variant="outline" className="mb-1 h-8 text-xs">Change Photo</Button>
                          <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max size 2MB</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input 
                            id="firstName" 
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input 
                            id="lastName" 
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                          id="phone" 
                          type="tel" 
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="employeeId">Employee ID</Label>
                        <Input 
                          id="employeeId" 
                          value={formData.employeeId}
                          onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                          placeholder="Your Employee ID"
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </>
                  )}

                  <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90 shadow-md">
                    Save Changes
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Change Password</h4>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input id="currentPassword" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input id="confirmPassword" type="password" />
                      </div>
                      <Button className="bg-gradient-primary hover:opacity-90 shadow-md">
                        Update Password
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <h4 className="font-semibold mb-3 text-sm">Two-Factor Authentication</h4>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                      <div className="flex-1">
                        <p className="font-medium text-sm">Enable 2FA</p>
                        <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                      </div>
                      <Switch />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <h4 className="font-semibold mb-3 text-sm">Active Sessions</h4>
                    <div className="space-y-2">
                      {[
                        { device: "Chrome on Windows", location: "New York, US", time: "Active now" },
                        { device: "Safari on iPhone", location: "New York, US", time: "2 hours ago" },
                      ].map((session, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                          <div>
                            <p className="font-medium text-sm">{session.device}</p>
                            <p className="text-xs text-muted-foreground">{session.location} • {session.time}</p>
                          </div>
                          <Button variant="outline" size="sm" className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive">
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <MobileNav />
    </div>
  );
};

export default Settings;
