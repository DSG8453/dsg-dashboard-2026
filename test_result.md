# DSG Transport LLC Management Portal - Test Plan

## Application Overview
A full-stack management portal for DSG Transport LLC with:
- FastAPI backend with MongoDB
- React frontend with glassmorphism UI
- JWT authentication with 2-Step Verification (2SV)
- Encrypted credential storage
- Complex role-based access control (Super Admin > Admin > User)
- **Browser Extension for Secure Auto-Login with Auto-Submit** (ENHANCED)

## Test Credentials
- **Super Admin:** info@dsgtransport.net / admin123 (2SV currently disabled for testing)
- **Admin:** admin@dsgtransport.com / admin123 (no 2SV)
- **User:** testuser@dsgtransport.com / user123

## Backend API Base URL
Use REACT_APP_BACKEND_URL from /app/frontend/.env with /api prefix

## Features to Test

### PRIORITY 1: Security Enhancements (NEW)
- [ ] Backend: /api/secure-access/decrypt-payload has rate limiting (10 req/min)
- [ ] Backend: /api/secure-access/decrypt-payload blocks requests from non-extension origins
- [ ] Backend: Admin/User CANNOT see credentials in GET /api/tools response
- [ ] Backend: Super Admin CAN see credentials in GET /api/tools response

### PRIORITY 2: Enhanced Auto-Login Extension
- [ ] Extension: Auto-fills credentials on tool login page
- [ ] Extension: Auto-clicks login button after filling credentials
- [ ] Extension: Shows loading overlay while signing in
- [ ] Extension: Hides overlay after successful login
- [ ] Frontend: Toast shows "Auto-login in progress" message

### PRIORITY 3: Credential Visibility Test
- [ ] API Test: Login as Admin, fetch tools, verify NO credentials field
- [ ] API Test: Login as User, fetch tools, verify NO credentials field  
- [ ] API Test: Login as Super Admin, fetch tools, verify credentials present
- [ ] UI Test: Admin dashboard shows "Open Tool" but no Edit button
- [ ] UI Test: Super Admin dashboard shows Edit button with credentials form

### 1. Activity Log - Super Admin Only
- [x] Backend: GET /api/activity-logs returns 403 for Admin (verified via curl)
- [x] Frontend: Activity Logs tab hidden from Admin navbar (verified via screenshot)
- [x] Frontend: Admin redirected to Dashboard when accessing /activity-logs directly
- [ ] Backend: GET /api/activity-logs returns data for Super Admin
- [ ] Frontend: Super Admin can see Activity Logs tab

### 2. Authentication
- [x] Login with valid credentials (admin)
- [x] 2SV OTP sent to Super Admin email on login
- [ ] Login with invalid credentials (should fail)
- [ ] Logout functionality
- [ ] Token persistence across page refreshes
- [ ] 2SV OTP verification flow

### 3. Dashboard
- [x] Tools load from database
- [x] User count displays correctly
- [ ] Add new tool functionality
- [ ] Delete tool functionality (Super Admin only)

### 4. User Management
- [x] List all users
- [ ] Create new user (Super Admin only)
- [x] Change user role (Super Admin only) - VERIFIED via UI and API
- [ ] Assign users to Admin (Super Admin only)
- [ ] Suspend user
- [ ] Reactivate user
- [ ] Delete user

### 5. Device Management (Super Admin only)
- [x] View devices - VERIFIED
- [x] Devices page loads correctly
- [ ] Approve/Reject devices
- [ ] Revoke devices

### 5. Credentials Management
- [ ] Add credentials for a tool
- [ ] View credentials (password masked)
- [ ] Reveal password (decrypted from backend)
- [ ] Update credentials
- [ ] Delete credentials

### 6. IP Management (Super Admin)
- [ ] View IP whitelist
- [ ] Add IP to whitelist
- [ ] Remove IP from whitelist

### 7. Device Management
- [ ] View devices
- [ ] Approve/Reject devices
- [ ] Suspend/Activate devices

## Testing Protocol
- Run backend tests in /app/backend/tests/
- Use pytest for backend testing
- Use Playwright for frontend E2E testing

## Incorporate User Feedback
- Activity Log should be visible to Super Admin ONLY (implemented)
- Credentials must NEVER be visible to Admin/User (implemented)
- Auto-login should auto-click login button (implemented)

## Last Test Result
- Security Enhancement - IMPLEMENTED:
  1. Added rate limiting to /api/secure-access/decrypt-payload (10 req/min)
  2. Added origin validation - blocks requests from non-extension origins
  3. Verified Admin/User cannot see credentials in API responses
  4. Verified Super Admin CAN see credentials
  
- Enhanced Auto-Login Extension - IMPLEMENTED:
  1. Extension now auto-clicks login button after filling credentials
  2. Loading overlay shows "Signing you into [tool]..." during process
  3. Overlay hides after successful login redirect
  4. Toast message updated to "Auto-login in progress"
  
- Users Created:
  1. info@dsgtransport.net (Super Administrator) - Super Admin
  2. info@dsgtransport.com (User) - User role as requested
  3. admin@dsgtransport.com (Administrator) - Admin role as requested
