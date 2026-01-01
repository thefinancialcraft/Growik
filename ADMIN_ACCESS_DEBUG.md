# Admin Access Debugging Guide

## Problem

Admin aur Super Admin users ko "Users" page sidebar mein show nahi ho raha hai.

## Solution Steps

### 1. Debug Page Access Karein

Application mein login karke yeh URL open karein:

```
http://localhost:5173/role-debug
```

Yeh page aapko dikhayega:

- ✅ Aapka current role database mein kya hai
- ✅ Super admin flag set hai ya nahi
- ✅ Aapko admin access milna chahiye ya nahi
- ✅ Cache clear karne ka option

### 2. Browser Console Check Karein

1. Browser mein F12 press karein (Developer Tools)
2. Console tab open karein
3. Sidebar load hone par yeh logs dikhenge:
   ```
   [Sidebar] Checking access for "Users": {
     profileExists: true,
     role: "admin",  // Ya "super_admin" ya "user"
     super_admin: false,
     isAdmin: true,
     isSuperAdminRole: false,
     isSuperAdminFlag: false,
     hasAccess: true,  // Yeh true hona chahiye admin/super_admin ke liye
     adminOnly: true
   }
   ```

### 3. Database Mein Role Check Karein

Supabase dashboard mein jaake `user_profiles` table check karein:

- `role` column: `'admin'` ya `'super_admin'` hona chahiye
- `super_admin` column: `true` ya `false`

### 4. Cache Clear Karein

Agar database mein role sahi hai lekin phir bhi Users page nahi dikh raha:

**Option A: Debug Page Se**

1. `/role-debug` page par jaayein
2. "Clear All Profile Caches & Reload" button click karein

**Option B: Browser Console Se**

```javascript
// Sabhi profile caches clear karein
Object.keys(localStorage).forEach((key) => {
  if (key.includes("profile")) {
    localStorage.removeItem(key);
    console.log("Cleared:", key);
  }
});
location.reload();
```

**Option C: Manual**

1. Browser Settings → Privacy → Clear Browsing Data
2. "Cached images and files" aur "Cookies and site data" select karein
3. Clear data
4. Page reload karein

### 5. Expected Behavior

**Admin/Super Admin Users:**

- ✅ Sidebar mein "Users" menu item dikhna chahiye
- ✅ `/users` page access kar sakte hain
- ✅ Console mein `hasAccess: true` dikhna chahiye

**Regular Users:**

- ❌ Sidebar mein "Users" menu item NAHI dikhna chahiye
- ❌ `/users` page access nahi kar sakte
- ❌ Console mein `hasAccess: false` dikhna chahiye

## Access Conditions

Users page dikhega agar koi bhi ek condition true ho:

1. `profile.role === 'admin'` ✓
2. `profile.role === 'super_admin'` ✓
3. `profile.super_admin === true` ✓

## Files Modified

1. `src/components/Sidebar.tsx` - Debug logging added
2. `src/pages/RoleDebug.tsx` - New debug page created
3. `src/App.tsx` - Added /role-debug route
4. `debug-role.js` - Browser console debug script

## Troubleshooting

### Issue: Role database mein sahi hai lekin access nahi mil raha

**Solution:** Cache clear karein (Step 4 dekhen)

### Issue: Console mein "profileExists: false" dikh raha hai

**Solution:**

- Logout karein
- Login karein
- Agar phir bhi issue ho toh database mein `user_profiles` table check karein

### Issue: Database mein role 'user' hai

**Solution:**

- Supabase dashboard mein jaayein
- `user_profiles` table open karein
- Apne user ka row find karein
- `role` column ko `'admin'` ya `'super_admin'` set karein
- Cache clear karein aur reload karein

## Quick Fix Command

Browser console mein paste karein:

```javascript
// Force cache clear aur reload
localStorage.clear();
sessionStorage.clear();
location.reload();
```
