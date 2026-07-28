import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://server-kasir-garmer.vercel.app',
});

export const API_URL = import.meta.env.VITE_API_URL || 'https://server-kasir-garmer.vercel.app';

export default api;
