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
  
  getMe: () => fetchAPI('/api/auth/me'),
  
  logout: () => fetchAPI('/api/auth/logout', { method: 'POST' }),
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

export default {
  auth: authAPI,
  users: usersAPI,
  tools: toolsAPI,
  credentials: credentialsAPI,
  issues: issuesAPI,
  settings: settingsAPI,
};
