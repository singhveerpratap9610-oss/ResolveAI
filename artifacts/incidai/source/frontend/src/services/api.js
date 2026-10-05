/**
 * API Service
 * 
 * Handles all HTTP requests to the Django backend
 * Uses axios for HTTP client
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API service object
const apiService = {
  // Health check
  healthCheck: () => api.get('/health/'),

  // Tickets
  getTickets: (params) => api.get('/tickets/', { params }),
  getTicket: (id) => api.get(`/tickets/${id}/`),
  createTicket: (data) => api.post('/tickets/', data),
  updateTicket: (id, data) => api.patch(`/tickets/${id}/`, data),
  deleteTicket: (id) => api.delete(`/tickets/${id}/`),
  generateResolution: (id, data) => api.post(`/tickets/${id}/generate_resolution/`, data),

  // Categories
  getCategories: () => api.get('/categories/'),

  // AI predictions
  predictCategory: (data) => api.post('/predict/', data),
  semanticSearch: (data, k = 5) => api.post(`/search/?k=${k}`, data),
  generateResolution: (data) => api.post('/resolve/', data),
  analyzeTicket: (data) => api.post('/analyze/', data),

  // Dashboard stats
  getStats: () => api.get('/stats/'),
};

export default apiService;
