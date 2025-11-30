import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          navigate('/?error=auth_failed');
          return;
        }

        if (session) {
          // Check if user has a profile
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
          }

          // If no profile exists (e.g., Google OAuth signup), create one
          if (!profileData) {
            const userMetadata = session.user.user_metadata || {};
            const fullName = userMetadata.full_name || 
                           `${userMetadata.first_name || ''} ${userMetadata.last_name || ''}`.trim() ||
                           session.user.email?.split('@')[0] || 
                           'User';
                           
            try {
              const { error: insertError } = await supabase
                .from('user_profiles')
                // @ts-ignore - Supabase type inference issue
                .insert({
                  user_id: session.user.id,
                  user_name: fullName,
                  email: session.user.email || '',
                  contact_no: userMetadata.contact_no || null,
                  role: 'user',
                  status: 'active',
                  approval_status: 'pending'
                });

              if (insertError) {
                console.error('AuthCallback: Error creating profile for OAuth user:', insertError);
              } else {
                console.log('AuthCallback: Profile created for OAuth user');
              }
            } catch (err) {
              console.error('AuthCallback: Exception creating profile:', err);
            }
          }

          // Fetch profile again after potential creation
          const { data: finalProfileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          // Redirect based on user profile status
          type UserProfile = {
            approval_status?: 'approved' | 'pending' | 'rejected' | string | null;
            status?: 'active' | 'hold' | 'suspend' | string | null;
          };

          const profile = finalProfileData as UserProfile | null;

          if (!profile) {
            // No profile found - redirect to approval pending (profile should be created during signup)
            navigate('/approval-pending');
          } else if (profile.approval_status === 'approved' && profile.status === 'active') {
            navigate('/dashboard');
          } else if (profile.approval_status === 'approved' && profile.status === 'hold') {
            navigate('/hold');
          } else if (profile.approval_status === 'approved' && profile.status === 'suspend') {
            navigate('/suspended');
          } else if (profile.approval_status === 'rejected') {
            navigate('/rejected');
          } else if (profile.approval_status === 'pending') {
            navigate('/approval-pending');
          } else {
            // Default fallback
            navigate('/approval-pending');
          }
        } else {
          navigate('/?error=no_session');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/?error=auth_failed');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;

