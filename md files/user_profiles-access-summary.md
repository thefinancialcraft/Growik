# User Profiles Table Access Summary

यह document बताता है कि `/rest/v1/user_profiles` endpoint कहाँ-कहाँ access हो रहा है।

## 📋 Files Accessing user_profiles Table

### 1. **Components** (सबसे ज्यादा frequent access)

#### `src/components/Sidebar.tsx`
- **Line 71**: `last_seen` update करने के लिए
- **Line 175**: User profile fetch करने के लिए
- **Line 224**: Profile cache से fetch
- **Line 249, 262**: Real-time updates के लिए

#### `src/components/Header.tsx`
- **Line 51**: Server status check के लिए
- **Line 100**: User profile fetch करने के लिए
- **Line 194**: User name और employee_id fetch
- **Line 238, 250**: Profile updates के लिए

#### `src/components/MobileNav.tsx`
- **Line 32**: User profile fetch

### 2. **Pages** (Main functionality)

#### `src/pages/Users.tsx` (सबसे ज्यादा queries)
- **Line 166**: All users fetch
- **Line 259**: User search
- **Line 277**: User filtering
- **Line 434**: User update
- **Line 462**: User status update
- **Line 535**: User delete (check)
- **Line 569**: User delete (execute)
- **Line 633**: User delete verification
- **Line 796, 884, 922, 942, 988, 1083, 1108, 1127**: Various user operations

#### `src/pages/Login.tsx`
- **Line 151**: Email check
- **Line 170**: User profile fetch
- **Line 189**: Profile verification
- **Line 352**: Post-login profile fetch
- **Line 553**: Profile completion check

#### `src/pages/AuthCallback.tsx`
- **Line 23**: OAuth callback के बाद profile check

#### `src/pages/Dashboard.tsx`
- **Line 68**: `last_seen` update
- **Line 162**: User profile fetch
- **Line 206, 219**: Profile updates

#### `src/pages/Settings.tsx`
- **Line 50**: User profile fetch
- **Line 99**: Profile update

#### `src/pages/SignupPage.tsx`
- **Line 111**: New user profile check

#### `src/pages/Contract.tsx`
- **Line 237, 331, 375, 388, 637, 747**: Contract operations में user info fetch

#### `src/pages/ContractEditor.tsx`
- **Line 1812, 1880**: Contract variable resolution में user data

#### `src/pages/Campaign.tsx`
- **Line 234**: Campaign users fetch

#### `src/pages/Messaging.tsx`
- **Line 144, 203**: User list fetch for messaging

#### `src/pages/Hold.tsx`
- **Line 55, 72, 124**: Hold status operations

#### `src/pages/Suspended.tsx`
- **Line 34**: Suspended user check

#### `src/pages/Rejected.tsx`
- **Line 34**: Rejected user check

#### `src/components/ApprovalPending.tsx`
- **Line 48**: Pending approval check

### 3. **Collaboration Pages**

#### `src/pages/Collaboration.tsx`
- **Line 1139**: Contract variable resolution में user data

#### `src/pages/CollaborationAssignment.tsx`
- **Line 852**: Contract variable resolution में user data

## 🔍 Access Patterns

### Most Frequent Access:
1. **Sidebar.tsx** - हर page load पर `last_seen` update
2. **Header.tsx** - हर page load पर profile fetch
3. **Users.tsx** - User management operations
4. **Login.tsx** - Authentication flow

### Access Types:
- **SELECT**: Profile data fetch
- **UPDATE**: `last_seen`, status, profile info updates
- **DELETE**: User deletion (Users.tsx)
- **INSERT**: New user creation (SignupPage.tsx)

## ⚠️ Performance Concerns

1. **Sidebar.tsx** और **Header.tsx** में बहुत frequent access हो रहा है
2. हर page navigation पर multiple queries
3. Real-time subscriptions (अब mostly removed हैं)

## 💡 Recommendations

1. **Caching**: Profile data को localStorage में cache करें
2. **Debouncing**: `last_seen` updates को debounce करें
3. **Batch Queries**: Multiple queries को combine करें
4. **RLS Policies**: Proper RLS policies ensure करें

## 📊 Total Access Points

- **Components**: ~15 access points
- **Pages**: ~40+ access points
- **Total**: ~55+ places where `/rest/v1/user_profiles` is accessed

