import axios from 'axios';
import { supabase } from '../supabase';

const defaultBaseURL = import.meta.env.DEV ? '/api' : 'https://data.relaysolutions.net/api';

let configuredURL = import.meta.env.VITE_API_URL || defaultBaseURL;
if (configuredURL && !configuredURL.endsWith('/api') && configuredURL !== '/api') {
  configuredURL = `${configuredURL.replace(/\/$/, '')}/api`;
}

const api = axios.create({
  baseURL: configuredURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error('Error setting auth session for API call:', error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 429) {
    const cooldownTime = Date.now() + 60000; // 60s cooldown indicator
    localStorage.setItem('ai_rate_limited_until', cooldownTime.toString());
    window.dispatchEvent(new Event('ai-rate-limit-updated'));
  }
  return Promise.reject(error);
});

export { api };

