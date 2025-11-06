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
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
          }

          // Redirect based on user profile status
          if (!profile) {
            navigate('/profile-completion');
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
            navigate('/profile-completion');
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

