import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, updateUserProfile, updateLastSeen, UserProfile } from '@/lib/userProfile';

/**
 * Hook to get and manage current user's profile
 */
export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userProfile = await getUserProfile(user.id);
      setProfile(userProfile);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch profile');
      console.error('useUserProfile: Error fetching profile', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user?.id) return null;

    try {
      const updated = await updateUserProfile(user.id, updates);
      if (updated) {
        setProfile(updated);
      }
      return updated;
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
      console.error('useUserProfile: Error updating profile', err);
      return null;
    }
  }, [user?.id]);

  const refreshProfile = useCallback(() => {
    return fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Auto-update last_seen when user is active
  useEffect(() => {
    if (!user?.id) return;

    const updateLastSeenInterval = setInterval(() => {
      updateLastSeen(user.id);
    }, 60000); // Every minute

    return () => clearInterval(updateLastSeenInterval);
  }, [user?.id]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile,
  };
}

/**
 * Hook to get a specific user's profile by user_id
 */
export function useUserProfileById(userId: string | null | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getUserProfile(userId)
      .then((userProfile) => {
        setProfile(userProfile);
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to fetch profile');
        console.error('useUserProfileById: Error', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  return { profile, loading, error };
}

