# MailFlow E2E Test Plan

## 📋 Overview

This document provides comprehensive end-to-end test scenarios for MailFlow, designed for both manual testing and automated test script generation. Each test includes preconditions, steps, expected results, and security validation points.

## 🎯 Test Environment Setup

### Prerequisites
- Docker and Docker Compose installed
- MailFlow instance running (development or production)
- Network access to test email providers (optional for full E2E)
- Test credentials for email accounts (Gmail App Passwords, etc.)

### Environment URLs
- **Development**: Frontend `http://localhost:5173`, Backend `http://localhost:3001`
- **Production**: Frontend `http://localhost:3000`, Backend `http://localhost:3000/api`

---

## 🔐 Security & Authentication Tests

### SEC-001: Unauthenticated Access Prevention
**Objective**: Verify all protected endpoints reject unauthenticated requests

**Test Steps**:
1. Start MailFlow instance
2. Make GET request to `/api/accounts` without Authorization header
3. Make GET request to `/api/emails` without Authorization header  
4. Make GET request to `/api/settings` without Authorization header
5. Make POST request to `/api/accounts` without Authorization header

**Expected Results**:
- All requests return `401 Unauthorized`
- Response body contains `{"error":"Authentication required","message":"No access token provided"}`
- No sensitive data exposed in error messages

**Script Generation**:
```bash
# Test unauthenticated access prevention
curl -s http://localhost:3001/api/accounts | jq '.error' # Should be "Authentication required"
curl -s http://localhost:3001/api/emails | jq '.error'   # Should be "Authentication required" 
curl -s http://localhost:3001/api/settings | jq '.error' # Should be "Authentication required"
```

### SEC-002: User Data Isolation
**Objective**: Verify users can only access their own data

**Prerequisites**: Two user accounts created (User A, User B)

**Test Steps**:
1. Login as User A, get JWT token
2. Create email account for User A
3. Login as User B, get JWT token
4. Attempt to access User A's accounts using User B's token
5. Attempt to access User A's emails using User B's token

**Expected Results**:
- User B cannot see User A's accounts
- User B cannot see User A's emails  
- All requests return only User B's data or empty arrays
- No cross-user data leakage

**Script Generation**:
```bash
# Login as User A and create account
USER_A_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@test.com","password":"TestPass123@"}' | jq -r '.accessToken')

# Create account for User A  
curl -s -X POST -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account":{"name":"User A Gmail","email":"usera@gmail.com"}}' \
  http://localhost:3001/api/accounts

# Login as User B
USER_B_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"userb@test.com","password":"TestPass123@"}' | jq -r '.accessToken')

# User B should not see User A's accounts
curl -s -H "Authorization: Bearer $USER_B_TOKEN" \
  http://localhost:3001/api/accounts | jq '.accounts | length' # Should be 0
```

---

## 🏗️ Setup & Authentication Flow Tests  

### SETUP-001: Initial Setup Wizard
**Objective**: Complete initial setup from fresh instance

**Prerequisites**: Fresh MailFlow instance (no setup completed)

**Test Steps**:
1. Access MailFlow frontend
2. Verify setup wizard appears
3. Navigate through setup steps:
   - Welcome screen
   - Admin account creation (email: `admin@mailflow.test`, password: `AdminTest123@`)
   - Configuration (optional)
   - Completion
4. Verify automatic login after setup
5. Verify setup cannot be repeated

**Expected Results**:
- Setup wizard displays correctly
- Strong password policy enforced
- Admin account created successfully  
- JWT tokens issued after setup
- Setup endpoints become protected after completion
- User redirected to main application

**Manual Test Checklist**:
- [ ] Setup wizard loads on first access
- [ ] Password policy validation works
- [ ] Setup completion redirects to main app
- [ ] Subsequent access goes directly to login (no setup)

### AUTH-001: Admin Login Flow
**Objective**: Verify admin can login with correct credentials

**Prerequisites**: Setup completed with admin account

**Test Steps**:
1. Access MailFlow login page
2. Enter admin credentials
3. Submit login form
4. Verify JWT tokens received
5. Verify redirect to main application
6. Verify user info display

**Expected Results**:
- Login form validates inputs
- Successful login returns access + refresh tokens
- Tokens stored securely in browser
- User redirected to email interface
- User info displayed correctly

**Script Generation**:
```bash
# Test admin login
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mailflow.test","password":"AdminTest123@"}')

# Verify response contains tokens
echo $RESPONSE | jq -e '.accessToken' # Should exist
echo $RESPONSE | jq -e '.refreshToken' # Should exist  
echo $RESPONSE | jq -e '.user.email' # Should be admin@mailflow.test
```

### AUTH-002: Invalid Login Attempts
**Objective**: Verify proper handling of invalid credentials

**Test Steps**:
1. Attempt login with invalid email
2. Attempt login with invalid password
3. Attempt login with malformed request
4. Verify no sensitive information leaked

**Expected Results**:
- All invalid attempts return `401 Unauthorized`
- Error messages are generic (no user enumeration)
- No tokens issued for failed attempts
- Failed attempts logged (if logging enabled)

---

## 📧 Email Account Management Tests

### ACCOUNT-001: Create Email Account  
**Objective**: Add new email account with auto-detection

**Prerequisites**: User authenticated

**Test Steps**:
1. Navigate to account management
2. Click "Add Account" 
3. Enter email: `test@gmail.com`
4. Verify auto-detection of Gmail settings:
   - IMAP: `imap.gmail.com:993 SSL/TLS`
   - SMTP: `smtp.gmail.com:587 STARTTLS`
5. Enter password and account name
6. Save account
7. Verify account appears in sidebar

**Expected Results**:
- Auto-detection fills correct settings
- Account saved with encrypted credentials
- Account immediately available for selection
- Settings stored securely in database

**Manual Test Checklist**:
- [ ] Add Account modal opens
- [ ] Email auto-detection works for Gmail/Outlook/Yahoo/iCloud
- [ ] Manual IMAP/SMTP configuration available
- [ ] Account appears in sidebar after creation
- [ ] Account color assigned automatically

### ACCOUNT-002: Edit Email Account
**Objective**: Modify existing email account settings

**Prerequisites**: Email account exists

**Test Steps**:
1. Select existing account
2. Open account settings
3. Modify account name and IMAP/SMTP settings
4. Save changes
5. Verify changes reflected immediately
6. Test connection with new settings

**Expected Results**:
- Settings modal pre-populated with current values
- Changes saved to database
- Updated settings applied immediately
- Connection test validates new settings

### ACCOUNT-003: Delete Email Account
**Objective**: Remove email account and associated data

**Prerequisites**: Email account with cached emails exists

**Test Steps**:
1. Select account to delete
2. Open account settings
3. Click delete account
4. Confirm deletion in modal
5. Verify account removed from sidebar
6. Verify cached emails deleted
7. Verify database cleanup

**Expected Results**:
- Confirmation dialog prevents accidental deletion
- Account and all associated emails removed
- Database properly cleaned up
- No orphaned data remains

---

## 📨 Email Operations Tests

### EMAIL-001: Email Caching and Display
**Objective**: Verify email synchronization and display

**Prerequisites**: Email account configured

**Test Steps**:
1. Select email account
2. Trigger email refresh/sync
3. Verify emails load in sidebar
4. Click on email to view content
5. Verify email content displays correctly
6. Check read/unread status updates

**Expected Results**:
- Emails load and display in chronological order
- Email preview shows sender, subject, date, preview text
- Full content loads when email selected
- Read status persists across sessions
- HTML and plain text emails render correctly

**Manual Test Checklist**:
- [ ] Email list loads in sidebar
- [ ] Email content displays in main area
- [ ] Read/unread status tracked correctly
- [ ] HTML emails render safely (no scripts)
- [ ] Attachments indicated (if supported)

### EMAIL-002: Email Composition
**Objective**: Create and send new emails

**Prerequisites**: Email account configured

**Test Steps**:
1. Click "Compose New Email"
2. Fill in recipient, subject, body
3. Apply text formatting (bold, italic, etc.)
4. Send email
5. Verify sent email confirmation
6. Check sent email appears in sent folder (if implemented)

**Expected Results**:
- Composer modal opens with empty form
- Text formatting tools work correctly
- Email validation prevents invalid recipients
- Send operation provides clear feedback
- Sent emails tracked appropriately

### EMAIL-003: Reply and Forward
**Objective**: Reply to and forward existing emails

**Prerequisites**: Received emails exist

**Test Steps**:
1. Select received email
2. Click "Reply" - verify original content quoted
3. Compose reply and send
4. Click "Reply All" - verify all recipients included
5. Click "Forward" - verify forwarded content formatted correctly

**Expected Results**:
- Reply automatically addresses sender
- Reply All includes all original recipients
- Original email content properly quoted
- Subject lines prefixed correctly (Re:, Fwd:)
- Forwarded content maintains formatting

---

## ⚙️ Settings & Configuration Tests

### SETTINGS-001: User Preferences
**Objective**: Modify and persist user settings

**Prerequisites**: User authenticated

**Test Steps**:
1. Open Settings modal
2. Modify settings:
   - Theme selection
   - Emails per page
   - Auto-refresh interval
3. Save settings
4. Refresh application
5. Verify settings persisted

**Expected Results**:
- Settings form shows current values
- Changes apply immediately when possible
- Settings persist across browser sessions
- Settings stored per-user in database

**Manual Test Checklist**:
- [ ] Settings modal opens with current values
- [ ] Theme change applies immediately
- [ ] Pagination settings affect email display
- [ ] Auto-refresh interval works
- [ ] Settings persist after browser refresh

### SETTINGS-002: Account Management
**Objective**: Manage multiple email accounts from settings

**Prerequisites**: Multiple email accounts configured

**Test Steps**:
1. Open Settings modal
2. Navigate to Accounts tab
3. View list of configured accounts
4. Edit account settings
5. Delete account
6. Add new account from settings

**Expected Results**:
- All user accounts listed correctly
- Account details editable inline
- Account deletion works with confirmation
- New accounts can be added from settings interface

---

## 📤 Import/Export Tests

### EXPORT-001: Data Export
**Objective**: Export user data for backup

**Prerequisites**: User with accounts and emails

**Test Steps**:
1. Open Settings → Export/Import
2. Click "Export Data"
3. Verify export file generated
4. Check export contains:
   - All user accounts (with credentials)
   - User settings
   - Timestamp
5. Verify export data format (JSON)

**Expected Results**:
- Export generates immediately
- All user data included in export
- Credentials properly included (for backup)
- Export format is valid JSON
- File downloads successfully

**Script Generation**:
```bash
# Test data export
EXPORT_DATA=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/export)

# Verify export structure
echo $EXPORT_DATA | jq -e '.accounts' # Should exist
echo $EXPORT_DATA | jq -e '.settings' # Should exist  
echo $EXPORT_DATA | jq -e '.timestamp' # Should exist
```

### IMPORT-001: Data Import
**Objective**: Import previously exported data

**Prerequisites**: Valid export file from another instance

**Test Steps**:
1. Open Settings → Export/Import
2. Select import file
3. Choose import options (replace existing vs merge)
4. Confirm import
5. Verify imported accounts appear
6. Verify imported settings applied
7. Test imported account functionality

**Expected Results**:
- Import file validation works
- Import options clearly explained
- Imported accounts immediately available
- Imported settings applied correctly
- No data corruption during import

---

## 🔄 Token Management Tests

### TOKEN-001: Access Token Expiration
**Objective**: Verify token refresh mechanism

**Prerequisites**: User authenticated

**Test Steps**:
1. Login and note token expiration (1 hour)
2. Wait for token to near expiration OR modify system time
3. Make API request that should trigger refresh
4. Verify new access token issued
5. Verify request succeeds with new token

**Expected Results**:
- Expired tokens automatically refreshed
- User remains logged in seamlessly
- API requests continue to work
- New tokens have extended expiration

### TOKEN-002: Refresh Token Expiration  
**Objective**: Verify logout when refresh token expires

**Prerequisites**: User authenticated

**Test Steps**:
1. Login and note refresh token expiration (7 days)
2. Wait for refresh token to expire OR simulate expiration
3. Attempt API request
4. Verify user logged out
5. Verify redirect to login page

**Expected Results**:
- Expired refresh token forces logout
- User redirected to login screen
- All tokens cleared from browser
- Fresh login required

---

## 🧪 Error Handling & Edge Cases

### ERROR-001: Network Connectivity Issues
**Objective**: Verify graceful handling of network problems

**Test Steps**:
1. Disconnect from internet during email operations
2. Attempt to add new account
3. Attempt to send email
4. Reconnect internet
5. Verify operations retry or show appropriate errors

**Expected Results**:
- Clear error messages for network issues
- Operations retry when connectivity restored
- No data loss during network interruptions
- User informed of connectivity status

### ERROR-002: Invalid Server Responses
**Objective**: Handle malformed or error responses

**Test Steps**:
1. Configure account with invalid IMAP settings
2. Attempt to connect and sync emails
3. Verify error handling
4. Provide correct settings
5. Verify successful connection

**Expected Results**:
- Connection errors displayed clearly
- Retry options available
- Invalid settings don't crash application
- Helpful troubleshooting information provided

---

## 🚀 Performance Tests

### PERF-001: Large Email Volume
**Objective**: Verify performance with many emails

**Test Steps**:
1. Configure account with large mailbox (1000+ emails)
2. Sync emails
3. Verify loading performance
4. Test email search functionality
5. Verify pagination works correctly

**Expected Results**:
- Email loading remains responsive
- Pagination prevents UI blocking
- Search results return quickly
- Memory usage stays reasonable

### PERF-002: Multiple Account Management
**Objective**: Verify performance with many accounts

**Test Steps**:
1. Add 10+ email accounts
2. Switch between accounts rapidly
3. Verify account switching performance
4. Test simultaneous email syncing
5. Verify UI remains responsive

**Expected Results**:
- Account switching is immediate
- UI remains responsive with multiple accounts
- Background syncing doesn't block interface
- Resource usage scales reasonably

---

## 🔧 Test Script Templates

### Automated Security Test Script
```bash
#!/bin/bash
# MailFlow Security Test Suite

BASE_URL="http://localhost:3001"
RESULTS_FILE="security_test_results.json"

echo "Running MailFlow Security Tests..."

# Test 1: Unauthenticated access prevention
echo "Testing unauthenticated access..."
ACCOUNTS_RESPONSE=$(curl -s $BASE_URL/api/accounts)
EMAILS_RESPONSE=$(curl -s $BASE_URL/api/emails)
SETTINGS_RESPONSE=$(curl -s $BASE_URL/api/settings)

# Verify all return authentication errors
if [[ $ACCOUNTS_RESPONSE == *"Authentication required"* ]]; then
  echo "✅ Accounts endpoint properly secured"
else
  echo "❌ Accounts endpoint security FAILED"
fi

# Test 2: Setup admin account
echo "Testing admin account creation..."
ADMIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/setup/admin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mailflow.local","password":"TestPass123@","confirmPassword":"TestPass123@"}')

if [[ $ADMIN_RESPONSE == *"accessToken"* ]]; then
  echo "✅ Admin account creation successful"
  TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.accessToken')
else
  echo "❌ Admin account creation FAILED"
  exit 1
fi

# Test 3: Authenticated access
echo "Testing authenticated access..."
AUTH_ACCOUNTS=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE_URL/api/accounts)
if [[ $AUTH_ACCOUNTS == *"accounts"* ]]; then
  echo "✅ Authenticated access works"
else
  echo "❌ Authenticated access FAILED"
fi

echo "Security tests completed!"
```

### Manual Test Checklist Template
```markdown
## Manual Test Session: [Date]
**Tester**: [Name]
**Environment**: [Development/Production]
**Version**: [Git Commit/Tag]

### Setup & Authentication
- [ ] Setup wizard completes successfully
- [ ] Password policy enforced
- [ ] Admin login works
- [ ] Invalid login properly rejected
- [ ] JWT tokens received and stored

### Email Account Management  
- [ ] Add account with auto-detection
- [ ] Manual IMAP/SMTP configuration
- [ ] Edit existing account
- [ ] Delete account with confirmation
- [ ] Multiple accounts supported

### Email Operations
- [ ] Email list loads correctly
- [ ] Email content displays properly
- [ ] Compose new email works
- [ ] Reply/Reply All functions
- [ ] Forward email works
- [ ] Read/unread status tracked

### Settings & Configuration
- [ ] User preferences save correctly
- [ ] Settings persist across sessions
- [ ] Account management in settings
- [ ] Import/export functionality

### Security Validation
- [ ] Unauthenticated requests rejected
- [ ] User data properly isolated
- [ ] Credentials stored encrypted
- [ ] No cross-user data access
- [ ] Token expiration handled

### Performance & Reliability
- [ ] Responsive with multiple accounts
- [ ] Handles large email volumes
- [ ] Network errors handled gracefully
- [ ] No memory leaks observed
- [ ] UI remains responsive

**Notes**:
- 
- 
- 

**Issues Found**:
- 
- 
- 
```

---

## 📊 Test Coverage Matrix

| Component | Security | Functionality | Performance | Error Handling |
|-----------|----------|---------------|-------------|----------------|
| Authentication | ✅ SEC-001, SEC-002 | ✅ AUTH-001, AUTH-002 | ✅ TOKEN-001, TOKEN-002 | ✅ ERROR-001 |
| Account Management | ✅ SEC-002 | ✅ ACCOUNT-001-003 | ✅ PERF-002 | ✅ ERROR-002 |
| Email Operations | ✅ SEC-002 | ✅ EMAIL-001-003 | ✅ PERF-001 | ✅ ERROR-001 |
| Settings | ✅ SEC-002 | ✅ SETTINGS-001-002 | ➖ | ➖ |
| Import/Export | ✅ SEC-002 | ✅ EXPORT-001, IMPORT-001 | ➖ | ➖ |

---

**Test Plan Version**: 1.0  
**Last Updated**: July 6, 2025  
**Compatible with**: MailFlow v1.0+ (Security Update)