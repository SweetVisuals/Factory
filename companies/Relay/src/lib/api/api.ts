import axios from 'axios';
import { supabase } from '../supabase';

const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const defaultBaseURL = isDevelopment ? 'http://localhost:3000/api' : 'https://api.relaysolutions.net/api';

let configuredURL = import.meta.env.VITE_API_URL || defaultBaseURL;
if (configuredURL && !configuredURL.endsWith('/api')) {
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

export { api };

