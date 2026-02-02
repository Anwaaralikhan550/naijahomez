# Email Verification System

## Overview

The email verification system is designed to be backwards-compatible and intelligent, handling different user types appropriately:

## User Categories

### 1. **Existing Users (Legacy)**
- **Created before**: August 27, 2025 (today's implementation date)
- **Verification required**: ❌ NO
- **Reason**: Existing users shouldn't be locked out when new security features are added

### 2. **Google Sign-in Users**  
- **Provider**: google.com
- **Verification required**: ❌ NO
- **Reason**: Google has already verified their email addresses

### 3. **New Email/Password Users**
- **Created after**: August 27, 2025
- **Provider**: email/password
- **Verification required**: ✅ YES
- **Reason**: New users should verify their email for security

## Technical Implementation

### AuthContext Logic
```javascript
const shouldRequireEmailVerification = (firebaseUser, userData = {}) => {
  // Google users are pre-verified
  if (firebaseUser.providerData.some(provider => provider.providerId === 'google.com')) {
    return false;
  }
  
  // Explicit opt-out (for migrations)
  if (userData.requiresEmailVerification === false) {
    return false;
  }
  
  // Legacy users (created before today)
  const createdAt = userData.createdAt?.toDate?.() || 
                   new Date(firebaseUser.metadata.creationTime);
  
  if (createdAt && createdAt < new Date('2025-08-27')) {
    return false;
  }
  
  // New users need verification
  return !firebaseUser.emailVerified;
};
```

### User Object Properties
Each authenticated user now has:
- `emailVerified`: Boolean - Firebase auth status OR computed status
- `requiresEmailVerification`: Boolean - Whether this user needs verification
- `signInProvider`: String - How user signed in ('google.com', 'email', etc.)

### Protected Routes
- Uses `requiresEmailVerification` flag to determine if verification is needed
- Only blocks access for users who actually need verification
- Existing users and Google users pass through normally

### Visual Indicators
- Warning only shows for users with `requiresEmailVerification: true` AND `emailVerified: false`
- No annoying warnings for legacy users or Google users

## Migration Strategy

### For Existing Deployments
1. **Gradual Rollout**: Cutoff date set to deployment date
2. **Migration Script**: Optional script to explicitly mark legacy users
3. **Fallback Logic**: If creation date unknown, assume legacy user (be lenient)

### Migration Script Usage
```bash
# Optional: Run migration script for explicit marking
node scripts/migrate-existing-users.js
```

The script will:
- Find users created before cutoff date
- Mark them as `requiresEmailVerification: false`
- Set appropriate `signInProvider` values
- Mark Google users as `emailVerified: true`

## User Flows

### New User Registration (Email/Password)
1. User registers → Email verification sent automatically
2. Redirected to `/verify-email`
3. Must verify email to access protected pages
4. Gets verification reminders in UI

### Existing User Login
1. User logs in → No verification required
2. Direct access to all features
3. No verification warnings

### Google Sign-in (New or Existing)
1. User signs in with Google → No verification required
2. Google email is trusted
3. Direct access to all features

## Security Benefits

### For New Users
- ✅ Email verification prevents fake accounts
- ✅ Ensures user owns the email address
- ✅ Reduces spam and abuse

### For Existing Users  
- ✅ No disruption to existing workflows
- ✅ No forced email verification
- ✅ Maintains user experience

### For Google Users
- ✅ Leverages Google's email verification
- ✅ No redundant verification step
- ✅ Smoother onboarding

## Configuration

### Cutoff Date
Update in `AuthContext.js`:
```javascript
const verificationCutoffDate = new Date('2025-08-27');
```

### Disabling for Specific Users
Add to Firestore user document:
```javascript
{
  requiresEmailVerification: false
}
```

### Provider Detection
Automatic based on `firebaseUser.providerData`:
- `google.com` → No verification needed
- `password` → Verification needed (if new user)

## Testing

### Test Scenarios
1. **New email user** → Should require verification
2. **Existing email user** → Should not require verification  
3. **Google user (new)** → Should not require verification
4. **Google user (existing)** → Should not require verification
5. **Migrated user** → Should not require verification

### Verification Override
For testing, add to user document:
```javascript
// Force verification requirement
{ requiresEmailVerification: true }

// Disable verification requirement  
{ requiresEmailVerification: false }
```

## Monitoring

### Logs to Watch
- User authentication with verification status
- Verification requirement decisions
- Creation date fallbacks

### Metrics to Track
- New user verification rates
- Existing user login success (should be 100%)
- Google sign-in success (should be 100%)

## Troubleshooting

### "User locked out after update"
- Check user's `createdAt` date
- Verify `requiresEmailVerification` flag
- Run migration script if needed

### "Google user asked to verify email"
- Check `signInProvider` is set to 'google.com'
- Verify provider detection logic
- Check Firebase providerData

### "New user not required to verify"
- Check cutoff date configuration
- Verify user creation date
- Check Firestore user document

## Future Enhancements

### Possible Additions
- Grace period for new verification requirement
- Admin dashboard for user verification status
- Bulk verification status updates
- Custom verification email templates

### Security Hardening
- Rate limiting on verification emails
- Verification attempt tracking
- Suspicious account detection