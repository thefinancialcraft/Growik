import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function RoleDebugPage() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setError('No user logged in');
        setLoading(false);
        return;
      }

      try {
        // Direct fetch from database
        const { data, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setProfileData(data);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  const clearAllCaches = () => {
    // Clear all profile caches
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.includes('profile')) {
        localStorage.removeItem(key);
        console.log('Cleared:', key);
      }
    });
    alert('All profile caches cleared! Reloading page...');
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Role Debug Page</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <div className="space-y-2">
            <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
            <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {profileData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Profile Data from Database</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Role</p>
                  <p className="text-lg font-semibold text-blue-600">{profileData.role || 'null'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Super Admin Flag</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {profileData.super_admin ? 'true' : 'false'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Employee ID</p>
                  <p className="text-lg font-semibold">{profileData.employee_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-semibold">{profileData.status || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Approval Status</p>
                  <p className="text-lg font-semibold">{profileData.approval_status || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Access Check</h2>
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded">
              <p className="font-semibold mb-2">Should have admin access?</p>
              <p className="text-lg">
                {profileData?.role === 'admin' || 
                 profileData?.role === 'super_admin' || 
                 profileData?.super_admin === true ? (
                  <span className="text-green-600 font-bold">✓ YES - Should see Users page</span>
                ) : (
                  <span className="text-red-600 font-bold">✗ NO - Should NOT see Users page</span>
                )}
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded">
              <p className="font-semibold mb-2">Conditions:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>role === 'admin': {profileData?.role === 'admin' ? '✓' : '✗'}</li>
                <li>role === 'super_admin': {profileData?.role === 'super_admin' ? '✓' : '✗'}</li>
                <li>super_admin === true: {profileData?.super_admin === true ? '✓' : '✗'}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <button
            onClick={clearAllCaches}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Clear All Profile Caches & Reload
          </button>
          <p className="text-sm text-gray-600 mt-2">
            This will clear all cached profile data and reload the page
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h3 className="text-yellow-800 font-semibold mb-2">📝 Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-800">
            <li>Check the "Profile Data from Database" section above</li>
            <li>Verify your role is set correctly in the database</li>
            <li>If role is correct but Users page still not showing, click "Clear All Profile Caches & Reload"</li>
            <li>Open browser console (F12) to see detailed logs from Sidebar component</li>
          </ol>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Full Profile JSON</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(profileData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
