// Device fingerprinting utility
// Creates a unique identifier for the current device/browser

export const getDeviceFingerprint = async () => {
  const components = [];
  
  // Screen info
  components.push(window.screen.width);
  components.push(window.screen.height);
  components.push(window.screen.colorDepth);
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Language
  components.push(navigator.language);
  
  // Platform
  components.push(navigator.platform);
  
  // User agent
  components.push(navigator.userAgent);
  
  // Hardware concurrency (CPU cores)
  components.push(navigator.hardwareConcurrency || 'unknown');
  
  // Device memory (if available)
  components.push(navigator.deviceMemory || 'unknown');
  
  // Create a hash from components
  const fingerprint = await hashString(components.join('|'));
  return fingerprint;
};

// Simple hash function
const hashString = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 32); // Return first 32 chars
};

// Get browser name
export const getBrowser = () => {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Browser';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Trident')) return 'Internet Explorer';
  if (ua.includes('Edge')) return 'Edge (Legacy)';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  
  return 'Unknown Browser';
};

// Get OS name
export const getOS = () => {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  
  if (platform.includes('Win')) return 'Windows';
  if (platform.includes('Mac')) return 'macOS';
  if (platform.includes('Linux')) return 'Linux';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  
  return 'Unknown OS';
};

// Get device info
export const getDeviceInfo = async () => {
  const fingerprint = await getDeviceFingerprint();
  const browser = getBrowser();
  const os = getOS();
  
  return {
    fingerprint,
    browser,
    os,
    device_name: `${browser} on ${os}`,
    user_agent: navigator.userAgent,
    ip_address: '', // Will be set by server
  };
};

// Store device status in localStorage
export const getStoredDeviceStatus = () => {
  const stored = localStorage.getItem('dsg_device_status');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

export const setStoredDeviceStatus = (status) => {
  localStorage.setItem('dsg_device_status', JSON.stringify(status));
};

export const clearStoredDeviceStatus = () => {
  localStorage.removeItem('dsg_device_status');
};
