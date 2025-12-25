// API Service - Centralized API calls with authentication
const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to get auth token
const getAuthHeader = () => {
  const token = localStorage.getItem('dsg_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Generic fetch wrapper with error handling
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }
  
  return response.json();
}

// Auth API
export const authAPI = {
  login: (email, password) => 
    fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  
  // Check if email has password login enabled
  checkPasswordAccess: (email) =>
    fetchAPI('/api/auth/check-password-access', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  
  verifyOtp: (data) =>
    fetchAPI('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  resendOtp: (tempToken) =>
    fetchAPI(`/api/auth/resend-otp?temp_token=${encodeURIComponent(tempToken)}`, {
      method: 'POST',
    }),
  
  // Google OAuth session verification
  googleSession: (sessionId) =>
    fetchAPI('/api/auth/google/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),
  
  getMe: () => fetchAPI('/api/auth/me'),
  
  logout: () => fetchAPI('/api/auth/logout', { method: 'POST' }),

  // Password management
  forgotPassword: (email) =>
    fetchAPI('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  
  resetPassword: (token, newPassword) =>
    fetchAPI('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
  
  changePassword: (currentPassword, newPassword) =>
    fetchAPI('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
};

// Users API
export const usersAPI = {
  getAll: () => fetchAPI('/api/users'),
  
  getById: (id) => fetchAPI(`/api/users/${id}`),
  
  create: (userData, sendEmail = false) => 
    fetchAPI(`/api/users?send_email=${sendEmail}`, {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  
  update: (id, userData) => 
    fetchAPI(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  
  delete: (id) => 
    fetchAPI(`/api/users/${id}`, { method: 'DELETE' }),
  
  suspend: (id) => 
    fetchAPI(`/api/users/${id}/suspend`, { method: 'POST' }),
  
  reactivate: (id) => 
    fetchAPI(`/api/users/${id}/reactivate`, { method: 'POST' }),
  
  resendInvitation: (id) => 
    fetchAPI(`/api/users/${id}/resend-invitation`, { method: 'POST' }),
  
  getToolAccess: (id) => 
    fetchAPI(`/api/users/${id}/tool-access`),
  
  updateToolAccess: (id, toolIds) => 
    fetchAPI(`/api/users/${id}/tool-access`, {
      method: 'PUT',
      body: JSON.stringify(toolIds),
    }),
  
  // Credentials management (Super Admin only)
  getAllCredentials: () => 
    fetchAPI('/api/users/credentials/all'),
  
  resetPassword: (id, newPassword) =>
    fetchAPI(`/api/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword }),
    }),
  
  sendPasswordReset: (id) =>
    fetchAPI(`/api/users/${id}/send-password-reset`, { method: 'POST' }),
  
  toggle2SV: (id, enabled) =>
    fetchAPI(`/api/users/${id}/toggle-2sv?enabled=${enabled}`, { method: 'PUT' }),
  
  // Toggle password login access for user
  togglePasswordLogin: (id, enabled) =>
    fetchAPI(`/api/users/${id}/toggle-password-login?enabled=${enabled}`, { method: 'PUT' }),
  
  // Set password for user (when enabling password login)
  setUserPassword: (id, password) =>
    fetchAPI(`/api/users/${id}/set-password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }),
  
  changeRole: (id, newRole) =>
    fetchAPI(`/api/users/${id}/change-role?new_role=${encodeURIComponent(newRole)}`, { method: 'PUT' }),
  
  // Assign users to an Admin (Super Admin only)
  assignUsersToAdmin: (adminId, userIds) =>
    fetchAPI(`/api/users/${adminId}/assign-users`, {
      method: 'PUT',
      body: JSON.stringify(userIds),
    }),
  
  // Get users assigned to an Admin
  getAssignedUsers: (adminId) =>
    fetchAPI(`/api/users/${adminId}/assigned-users`),
};

// Tools API
export const toolsAPI = {
  getAll: () => fetchAPI('/api/tools'),
  
  getById: (id) => fetchAPI(`/api/tools/${id}`),
  
  create: (toolData) => 
    fetchAPI('/api/tools', {
      method: 'POST',
      body: JSON.stringify(toolData),
    }),
  
  update: (id, toolData) => 
    fetchAPI(`/api/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toolData),
    }),
  
  delete: (id) => 
    fetchAPI(`/api/tools/${id}`, { method: 'DELETE' }),
  
  // Secure access - request one-time access token
  requestSecureAccess: (toolId) =>
    fetchAPI(`/api/secure-access/${toolId}/request-access`, { method: 'POST' }),
  
  // Gateway access - access tool through dashboard proxy
  startGatewaySession: (toolId) =>
    fetchAPI(`/api/gateway/start/${toolId}`, { method: 'POST' }),
  
  // Get credentials payload for browser extension
  getExtensionPayload: (toolId) =>
    fetchAPI(`/api/secure-access/${toolId}/extension-payload`, { method: 'POST' }),
  
  // Direct login - Server logs in and returns authenticated session (Bitwarden-style)
  directLogin: (toolId) =>
    fetchAPI(`/api/secure-access/${toolId}/direct-login`, { method: 'POST' }),
};

// Credentials API
export const credentialsAPI = {
  getByTool: (toolId) => fetchAPI(`/api/credentials/tool/${toolId}`),
  
  create: (credData) => 
    fetchAPI('/api/credentials', {
      method: 'POST',
      body: JSON.stringify(credData),
    }),
  
  update: (id, credData) => 
    fetchAPI(`/api/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(credData),
    }),
  
  delete: (id) => 
    fetchAPI(`/api/credentials/${id}`, { method: 'DELETE' }),
  
  reveal: (id) => fetchAPI(`/api/credentials/${id}/reveal`),
};

// Issues API
export const issuesAPI = {
  getAll: () => fetchAPI('/api/issues'),
  
  getById: (id) => fetchAPI(`/api/issues/${id}`),
  
  create: (issueData) => 
    fetchAPI('/api/issues', {
      method: 'POST',
      body: JSON.stringify(issueData),
    }),
  
  update: (id, issueData) => 
    fetchAPI(`/api/issues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(issueData),
    }),
  
  delete: (id) => 
    fetchAPI(`/api/issues/${id}`, { method: 'DELETE' }),
  
  analyze: (id) => 
    fetchAPI(`/api/issues/${id}/analyze`, { method: 'POST' }),
  
  resolve: (id, note) => 
    fetchAPI(`/api/issues/${id}/resolve?resolution_note=${encodeURIComponent(note)}`, { 
      method: 'POST' 
    }),
};

// Settings API
export const settingsAPI = {
  getSupport: () => fetchAPI('/api/settings/support'),
  
  updateSupport: (settingsData) => 
    fetchAPI('/api/settings/support', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    }),
};

// Devices API
export const devicesAPI = {
  getAll: () => fetchAPI('/api/devices'),
  
  getPending: () => fetchAPI('/api/devices/pending'),
  
  getMyDevices: () => fetchAPI('/api/devices/my-devices'),
  
  checkDevice: (fingerprint) => fetchAPI(`/api/devices/check/${fingerprint}`),
  
  register: (deviceData) => 
    fetchAPI('/api/devices/register', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    }),
  
  approve: (id) => 
    fetchAPI(`/api/devices/${id}/approve`, { method: 'PUT' }),
  
  reject: (id) => 
    fetchAPI(`/api/devices/${id}/reject`, { method: 'PUT' }),
  
  revoke: (id) => 
    fetchAPI(`/api/devices/${id}/revoke`, { method: 'PUT' }),
  
  delete: (id) => 
    fetchAPI(`/api/devices/${id}`, { method: 'DELETE' }),
};

// Activity Logs API
export const activityLogsAPI = {
  getAll: (limit = 50, activityType = null, userRole = null, userEmail = null) => {
    let url = `/api/activity-logs?limit=${limit}`;
    if (activityType && activityType !== 'all') {
      url += `&activity_type=${activityType}`;
    }
    if (userRole && userRole !== 'all') {
      url += `&user_role=${encodeURIComponent(userRole)}`;
    }
    if (userEmail) {
      url += `&user_email=${encodeURIComponent(userEmail)}`;
    }
    return fetchAPI(url);
  },
  
  create: (logData) => 
    fetchAPI('/api/activity-logs', {
      method: 'POST',
      body: JSON.stringify(logData),
    }),
  
  // Delete single log
  delete: (logId) =>
    fetchAPI(`/api/activity-logs/${logId}`, { method: 'DELETE' }),
  
  // Delete all logs for a specific user
  deleteUserLogs: (userEmail) =>
    fetchAPI(`/api/activity-logs/user/${encodeURIComponent(userEmail)}`, { method: 'DELETE' }),
  
  // Delete all logs
  deleteAll: () =>
    fetchAPI('/api/activity-logs/bulk/all', { method: 'DELETE' }),
  
  // Get users with logs (for filter dropdown)
  getUsersWithLogs: () =>
    fetchAPI('/api/activity-logs/users/list'),
};

// IP Management API
export const ipManagementAPI = {
  // Global whitelist
  getWhitelist: () => fetchAPI('/api/ip-management/whitelist'),
  
  addToWhitelist: (ipData) => 
    fetchAPI('/api/ip-management/whitelist', {
      method: 'POST',
      body: JSON.stringify(ipData),
    }),
  
  updateWhitelist: (id, ipData) => 
    fetchAPI(`/api/ip-management/whitelist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ipData),
    }),
  
  deleteFromWhitelist: (id) => 
    fetchAPI(`/api/ip-management/whitelist/${id}`, { method: 'DELETE' }),
  
  // User IP settings
  getUsersIPSettings: () => fetchAPI('/api/ip-management/users'),
  
  updateUserIPSettings: (userId, settings) => 
    fetchAPI(`/api/ip-management/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  
  addUserIP: (userId, ip) => 
    fetchAPI(`/api/ip-management/users/${userId}/add-ip?ip=${encodeURIComponent(ip)}`, {
      method: 'POST',
    }),
  
  removeUserIP: (userId, ip) => 
    fetchAPI(`/api/ip-management/users/${userId}/remove-ip/${encodeURIComponent(ip)}`, {
      method: 'DELETE',
    }),
};

export default {
  auth: authAPI,
  users: usersAPI,
  tools: toolsAPI,
  credentials: credentialsAPI,
  issues: issuesAPI,
  settings: settingsAPI,
  devices: devicesAPI,
  activityLogs: activityLogsAPI,
};
