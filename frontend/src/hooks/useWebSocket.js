// Notification types - kept for reference and potential future use
// Note: WebSocket functionality has been removed from the frontend.
// Authentication now relies solely on HTTP login, JWT tokens (stored in localStorage),
// and REST API calls. Dashboard updates use manual refresh via the refreshDashboard function.
export const NotificationType = {
  TOOL_ACCESS_UPDATED: 'tool_access_updated',
  TOOL_DELETED: 'tool_deleted',
  TOOL_CREATED: 'tool_created',
  ROLE_CHANGED: 'role_changed',
  USER_SUSPENDED: 'user_suspended',
  USER_REACTIVATED: 'user_reactivated',
  REFRESH_DASHBOARD: 'refresh_dashboard',
  CREDENTIALS_UPDATED: 'credentials_updated',
};

export default NotificationType;
