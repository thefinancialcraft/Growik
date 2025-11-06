import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  user_name?: string;
  employee_id?: string;
}

const Header = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const userEmail = localStorage.getItem("userEmail") || "";
  
  // Get initials from name (first letter) or email (first 2 letters) as fallback
  // This will recalculate when profile changes
  const getInitials = (profileData: UserProfile | null) => {
    if (profileData?.user_name) {
      const name = profileData.user_name.trim();
      if (name) {
        return name.charAt(0).toUpperCase();
      }
    }
    const emailSource = userEmail || user?.email || "";
    if (emailSource) {
      return emailSource.slice(0, 2).toUpperCase();
    }
    return "U";
  };
  
  const initials = getInitials(profile);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id) {
        const cacheKey = `profile_${user.id}`;
        const sidebarCacheKey = `profile_sidebar_${user.id}`;
        
        // Check cache for immediate UI update
        const cached = localStorage.getItem(cacheKey) || localStorage.getItem(sidebarCacheKey);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            if (cachedData.user_name) {
              setProfile(cachedData);
            }
          } catch (e) {
            // Invalid cache, ignore
          }
        }

        // Always fetch fresh data from database
        try {
          console.log('Header: Fetching profile for user:', user.id);
          console.log('Header: Query: SELECT user_name, employee_id FROM user_profiles WHERE user_id =', user.id);
          
          const { data, error } = await supabase
            .from('user_profiles')
            .select('user_name, employee_id')
            .eq('user_id', user.id)
            .maybeSingle();
          
          console.log('Header: Query response - data:', data, 'error:', error);
          
          if (error) {
            console.error('Header: Error fetching profile:', error);
            console.error('Header: Error details:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            
            // Try alternative query to debug
            console.log('Header: Trying alternative query with all fields...');
            const { data: altData, error: altError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();
            console.log('Header: Alternative query result:', altData, altError);
            return;
          }
          // If no data by user_id, try fallback by email
          let profileRow = data as any;
          if (!profileRow && user.email) {
            console.log('Header: Trying fallback by email:', user.email);
            const { data: byEmail, error: byEmailErr } = await supabase
              .from('user_profiles')
              .select('user_name, employee_id')
              .eq('email', user.email)
              .maybeSingle();
            console.log('Header: Fallback by email result:', byEmail, byEmailErr);
            if (!byEmailErr) {
              profileRow = byEmail;
            }
          }

          if (profileRow) {
            console.log('Header: Profile data received:', data);
            console.log('Header: Employee ID:', profileRow.employee_id);
            setProfile(profileRow);
            // Update both cache keys
            localStorage.setItem(cacheKey, JSON.stringify(profileRow));
            // Also check sidebar cache and update if exists
            const sidebarCache = localStorage.getItem(sidebarCacheKey);
            if (sidebarCache) {
              try {
                const sidebarData = JSON.parse(sidebarCache);
                sidebarData.employee_id = profileRow.employee_id;
                sidebarData.user_name = profileRow.user_name;
                localStorage.setItem(sidebarCacheKey, JSON.stringify(sidebarData));
              } catch (e) {
                // Ignore cache update errors
              }
            }
          } else {
            console.warn('Header: No profile data found for user:', user.id);
            // Try to check if user exists in database at all
            console.log('Header: Checking if any profiles exist...');
            const { data: allProfiles, error: checkError } = await supabase
              .from('user_profiles')
              .select('id, user_id, user_name, employee_id')
              .limit(5);
            console.log('Header: Sample profiles in DB:', allProfiles);
            console.log('Header: Check error:', checkError);
          }
        } catch (error) {
          console.error('Header: Exception fetching profile:', error);
        }
      }
    };

    fetchProfile();
  }, [user?.id]); // Only depend on user.id, not the whole user object

  return (
    <header className="bg-card border-b border-border/50 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-card/95">
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between max-w-7xl">
        {/* Left: User Profile */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {profile?.user_name || (user as any)?.user_metadata?.full_name || user?.email?.split("@")[0] || userEmail.split("@")[0] || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Employee ID: {profile?.employee_id || "Not assigned"}
            </p>
          </div>
        </div>

        {/* Right: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
            <i className="fi fi-sr-signature text-primary text-xl"></i>
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-primary bg-clip-text text-transparent">
              Signify
            </h1>
            <p className="text-xs text-muted-foreground">Growwik Media</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
