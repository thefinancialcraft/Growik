# User Profile Utility - Usage Guide

यह utility function सभी `user_profiles` table access को centralize करता है और caching provide करता है।

## ✅ Benefits

1. **Database Load कम**: Caching से repeated queries avoid होती हैं
2. **Centralized Access**: सभी profile access एक जगह से
3. **Automatic Caching**: 5 minutes cache duration
4. **Debounced Updates**: `last_seen` updates debounced (1 minute interval)

## 📖 Usage

### 1. Hook का उपयोग (Recommended)

```typescript
import { useUserProfile } from '@/hooks/useUserProfile';

function MyComponent() {
  const { profile, loading, error, updateProfile, refreshProfile } = useUserProfile();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>Hello {profile?.user_name}</div>;
}
```

### 2. Direct Function Calls

```typescript
import { getUserProfile, updateUserProfile, updateLastSeen } from '@/lib/userProfile';

// Get profile
const profile = await getUserProfile(userId);

// Update profile
const updated = await updateUserProfile(userId, { user_name: 'New Name' });

// Update last_seen (debounced)
await updateLastSeen(userId);
```

### 3. Multiple Users

```typescript
import { getUserProfiles, getAllUserProfiles } from '@/lib/userProfile';

// Get multiple profiles
const profiles = await getUserProfiles([userId1, userId2]);

// Get all profiles (admin)
const allProfiles = await getAllUserProfiles();
```

## 🔄 Migration Guide

### Before (Old Code):
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('user_id', user.id)
  .single();
```

### After (New Code):
```typescript
import { getUserProfile } from '@/lib/userProfile';

const profile = await getUserProfile(user.id);
```

## 📝 Files Updated

- ✅ `src/components/Sidebar.tsx`
- ✅ `src/components/Header.tsx`
- ⏳ Other files को gradually update करें

## 🚀 Next Steps

अन्य files में भी यह utility use करें:
- `src/pages/Users.tsx`
- `src/pages/Login.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Settings.tsx`
- etc.

## ⚙️ Configuration

Cache duration को change करने के लिए `src/lib/userProfile.ts` में:
```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

Last seen update interval:
```typescript
const LAST_SEEN_UPDATE_INTERVAL = 60 * 1000; // 1 minute
```

