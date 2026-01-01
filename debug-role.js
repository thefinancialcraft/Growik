// Debug script to check user role in browser console
// Open browser console (F12) and paste this script

console.log('=== USER ROLE DEBUG ===');

// Check localStorage cache
const userId = localStorage.getItem('sb-vwvqgqxdtlwqkdqpgxvd-auth-token');
console.log('Auth Token:', userId);

// Find all profile caches
const allKeys = Object.keys(localStorage);
const profileKeys = allKeys.filter(key => key.includes('profile'));

console.log('\n=== All Profile Cache Keys ===');
profileKeys.forEach(key => {
  const value = localStorage.getItem(key);
  try {
    const parsed = JSON.parse(value);
    console.log(`\n${key}:`, parsed);
    if (parsed.role) {
      console.log('  → Role:', parsed.role);
      console.log('  → Super Admin:', parsed.super_admin);
    }
    if (parsed.profile) {
      console.log('  → Profile Role:', parsed.profile.role);
      console.log('  → Profile Super Admin:', parsed.profile.super_admin);
    }
  } catch (e) {
    console.log(`${key}: (not JSON)`, value);
  }
});

console.log('\n=== Clear All Profile Caches ===');
console.log('Run this to clear cache: localStorage.clear(); location.reload();');
