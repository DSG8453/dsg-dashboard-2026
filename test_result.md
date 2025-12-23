# DSG Transport LLC Management Portal - Test Plan

## Application Overview
A full-stack management portal for DSG Transport LLC with:
- FastAPI backend with MongoDB
- React frontend with glassmorphism UI
- JWT authentication with 2-Step Verification (2SV)
- Encrypted credential storage
- Complex role-based access control (Super Admin > Admin > User)

## Test Credentials
- **Super Admin:** info@dsgtransport.net / admin123 (requires 2SV OTP via email)
- **Admin:** testadmin@dsgtransport.com / admin123 (no 2SV)
- **User:** testuser@dsgtransport.com / user123

## Backend API Base URL
Use REACT_APP_BACKEND_URL from /app/frontend/.env with /api prefix

## Features to Test

### 1. Activity Log - Super Admin Only (NEW - PRIORITY)
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

## Last Test Result
- Change Role Feature - VERIFIED:
  1. Added missing handleChangeRole function in UsersPage.jsx
  2. Tested via API: Successfully changed Test Admin from Administrator to User and back
  3. Tested via UI: Role dropdown works, shows "Admin" and "User" options, updates immediately
  
- Devices Page Error - FIXED:
  1. Error: canManageDevices is not defined
  2. Fix: Added `const canManageDevices = isSuperAdmin;` definition
  3. Devices page now loads correctly for Super Admin
  
- Users Created:
  1. info@dsgtransport.net (Super Administrator) - Super Admin
  2. info@dsgtransport.com (User) - User role as requested
  3. admin@dsgtransport.com (Administrator) - Admin role as requested
