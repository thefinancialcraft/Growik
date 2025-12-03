import { supabase } from "@/lib/supabase";

export interface UserProfile {
  id: string;
  user_id: string;
  user_name: string | null;
  email: string;
  contact_no?: string | null;
  role: 'user' | 'admin' | 'super_admin' | null;
  status: 'active' | 'hold' | 'suspend' | null;
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  super_admin: boolean;
  created_at: string;
  updated_at: string;
  employee_id?: string | null;
  status_reason?: string | null;
  hold_duration_days?: number | null;
  hold_end_time?: string | null;
  last_seen?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_landmark?: string | null;
  address_city?: string | null;
  address_pincode?: string | null;
  address_country?: string | null;
}

interface ProfileCache {
  profile: UserProfile | null;
  timestamp: number;
  userId: string;
}

// In-memory cache
const profileCache = new Map<string, ProfileCache>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const LAST_SEEN_UPDATE_INTERVAL = 60 * 1000; // 1 minute

// Track last_seen update timestamps
const lastSeenUpdates = new Map<string, number>();

/**
 * Get user profile from cache or database
 */
export async function getUserProfile(userId: string | null | undefined): Promise<UserProfile | null> {
  if (!userId) return null;

  // Check in-memory cache first
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.profile;
  }

  // Check localStorage cache
  const storageKey = `profile_cache_${userId}`;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const parsed: ProfileCache = JSON.parse(stored);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        // Update in-memory cache
        profileCache.set(userId, parsed);
        return parsed.profile;
      }
    } catch (e) {
      // Invalid cache, continue to fetch
    }
  }

  // Fetch from database
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('getUserProfile: Error fetching profile', error);
      return null;
    }

    const profile = data as UserProfile | null;
    
    // Update cache
    const cacheEntry: ProfileCache = {
      profile,
      timestamp: Date.now(),
      userId,
    };
    profileCache.set(userId, cacheEntry);
    localStorage.setItem(storageKey, JSON.stringify(cacheEntry));

    return profile;
  } catch (error) {
    console.error('getUserProfile: Exception', error);
    return null;
  }
}

/**
 * Update user profile in cache and database
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      // @ts-ignore - Supabase type inference issue with update method
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('updateUserProfile: Error updating profile', error);
      return null;
    }

    const profile = data as UserProfile;
    
    // Update cache
    const cacheEntry: ProfileCache = {
      profile,
      timestamp: Date.now(),
      userId,
    };
    profileCache.set(userId, cacheEntry);
    localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(cacheEntry));

    return profile;
  } catch (error) {
    console.error('updateUserProfile: Exception', error);
    return null;
  }
}

/**
 * Update last_seen timestamp (debounced)
 */
export async function updateLastSeen(userId: string | null | undefined): Promise<void> {
  if (!userId) return;

  const now = Date.now();
  const lastUpdate = lastSeenUpdates.get(userId) || 0;

  // Only update if more than 1 minute has passed
  if (now - lastUpdate < LAST_SEEN_UPDATE_INTERVAL) {
    return;
  }

  lastSeenUpdates.set(userId, now);

  try {
    await supabase
      .from('user_profiles')
      // @ts-ignore - Supabase type inference issue with update method
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', userId);

    // Update cache if exists
    const cached = profileCache.get(userId);
    if (cached && cached.profile) {
      cached.profile.last_seen = new Date().toISOString();
      cached.timestamp = Date.now();
      profileCache.set(userId, cached);
      localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(cached));
    }
  } catch (error) {
    console.error('updateLastSeen: Error', error);
  }
}

/**
 * Get multiple user profiles (for user lists)
 */
export async function getUserProfiles(userIds: string[]): Promise<UserProfile[]> {
  if (!userIds.length) return [];

  const profiles: UserProfile[] = [];
  const uncachedIds: string[] = [];

  // Check cache for each user
  for (const userId of userIds) {
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      if (cached.profile) profiles.push(cached.profile);
    } else {
      uncachedIds.push(userId);
    }
  }

  // Fetch uncached profiles
  if (uncachedIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .in('user_id', uncachedIds);

      if (error) {
        console.error('getUserProfiles: Error fetching profiles', error);
      } else if (data) {
        const fetchedProfiles = data as UserProfile[];
        profiles.push(...fetchedProfiles);

        // Update cache
        fetchedProfiles.forEach((profile) => {
          const cacheEntry: ProfileCache = {
            profile,
            timestamp: Date.now(),
            userId: profile.user_id,
          };
          profileCache.set(profile.user_id, cacheEntry);
          localStorage.setItem(`profile_cache_${profile.user_id}`, JSON.stringify(cacheEntry));
        });
      }
    } catch (error) {
      console.error('getUserProfiles: Exception', error);
    }
  }

  return profiles;
}

/**
 * Get all user profiles (for admin views)
 */
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getAllUserProfiles: Error', error);
      return [];
    }

    const profiles = (data || []) as UserProfile[];

    // Update cache for all fetched profiles
    profiles.forEach((profile) => {
      const cacheEntry: ProfileCache = {
        profile,
        timestamp: Date.now(),
        userId: profile.user_id,
      };
      profileCache.set(profile.user_id, cacheEntry);
      localStorage.setItem(`profile_cache_${profile.user_id}`, JSON.stringify(cacheEntry));
    });

    return profiles;
  } catch (error) {
    console.error('getAllUserProfiles: Exception', error);
    return [];
  }
}

/**
 * Search user profiles
 */
export async function searchUserProfiles(query: string): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .or(`user_name.ilike.%${query}%,email.ilike.%${query}%,employee_id.ilike.%${query}%`)
      .limit(50);

    if (error) {
      console.error('searchUserProfiles: Error', error);
      return [];
    }

    return (data || []) as UserProfile[];
  } catch (error) {
    console.error('searchUserProfiles: Exception', error);
    return [];
  }
}

/**
 * Clear cache for a specific user
 */
export function clearProfileCache(userId: string): void {
  profileCache.delete(userId);
  localStorage.removeItem(`profile_cache_${userId}`);
}

/**
 * Clear all profile caches
 */
export function clearAllProfileCache(): void {
  profileCache.clear();
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith('profile_cache_')) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Invalidate cache (force refresh on next fetch)
 */
export function invalidateProfileCache(userId: string): void {
  clearProfileCache(userId);
}

