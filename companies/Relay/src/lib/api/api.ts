import axios from 'axios';
import { supabase } from '../supabase';

const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const defaultBaseURL = isDevelopment ? 'http://localhost:3001/api' : 'https://api.relaysolutions.net/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseURL,
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

