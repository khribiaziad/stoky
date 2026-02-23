import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api'),
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const changePassword = (data) => api.post('/auth/change-password', data);
export const updateStoreName = (data) => api.patch('/auth/update-store', data);

// Products
export const getProducts = () => api.get('/products');
export const createProduct = (data) => api.post('/products', data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);
export const addVariant = (productId, data) => api.post(`/products/${productId}/variants`, data);
export const updateVariant = (variantId, data) => api.put(`/products/variants/${variantId}`, data);
export const deleteVariant = (variantId) => api.delete(`/products/variants/${variantId}`);

// Packs
export const getPacks = () => api.get('/packs');
export const createPack = (data) => api.post('/packs', data);
export const updatePack = (id, data) => api.put(`/packs/${id}`, data);
export const deletePack = (id) => api.delete(`/packs/${id}`);
export const addPackPreset = (packId, data) => api.post(`/packs/${packId}/presets`, data);
export const deletePackPreset = (presetId) => api.delete(`/packs/presets/${presetId}`);

// Stock
export const getStockArrivals = () => api.get('/stock/arrivals');
export const addBulkStockArrival = (data) => api.post('/stock/arrivals', data);
export const getBrokenStock = () => api.get('/stock/broken');
export const addBrokenStock = (data) => api.post('/stock/broken', data);

// Orders
export const getOrders = (status) => api.get('/orders', { params: status ? { status } : {} });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const uploadPickupPDF = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/orders/upload-pickup', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const uploadReturnPDF = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/orders/upload-return', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const bulkCreateOrders = (orders) => api.post('/orders/bulk-create', { orders });
export const processReturns = (returns) => api.post('/orders/process-returns', { returns });
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);
export const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, null, { params: { status } });
export const bulkUpdateOrderStatus = (order_ids, status) => api.post('/orders/bulk-status', { order_ids, status });
export const updateOrderNotes = (id, notes) => api.patch(`/orders/${id}/notes`, { notes });
export const deleteOrder = (id) => api.delete(`/orders/${id}`);

// Team
export const getTeam = () => api.get('/team');
export const createTeamMember = (data) => api.post('/team', data);
export const updateTeamMember = (id, data) => api.put(`/team/${id}`, data);
export const deleteTeamMember = (id) => api.delete(`/team/${id}`);
export const createConfirmerAccount = (memberId, data) => api.post(`/team/${memberId}/create-account`, data);
export const getMemberStats = (memberId, params) => api.get(`/team/${memberId}/stats`, { params });
export const toggleMemberAccount = (memberId) => api.post(`/team/${memberId}/toggle-account`);

// Expenses
export const getFixedExpenses = () => api.get('/expenses/fixed');
export const createFixedExpense = (data) => api.post('/expenses/fixed', data);
export const updateFixedExpense = (id, data) => api.put(`/expenses/fixed/${id}`, data);
export const toggleFixedExpense = (id) => api.patch(`/expenses/fixed/${id}/toggle`);
export const deleteFixedExpense = (id) => api.delete(`/expenses/fixed/${id}`);
export const getWithdrawals = () => api.get('/expenses/withdrawals');
export const createWithdrawal = (data) => api.post('/expenses/withdrawals', data);
export const deleteWithdrawal = (id) => api.delete(`/expenses/withdrawals/${id}`);

// Legacy (used by Team.jsx reports section)
export const getFacebookAds = () => api.get('/expenses/facebook-ads');
export const createFacebookAd = (data) => api.post('/expenses/facebook-ads', data);

// Ad Platforms
export const getAdPlatforms = () => api.get('/expenses/platforms');
export const createAdPlatform = (data) => api.post('/expenses/platforms', data);
export const deleteAdPlatform = (id) => api.delete(`/expenses/platforms/${id}`);

// Ad Campaigns
export const createAdCampaign = (data) => api.post('/expenses/campaigns', data);
export const updateAdCampaign = (id, data) => api.put(`/expenses/campaigns/${id}`, data);
export const deleteAdCampaign = (id) => api.delete(`/expenses/campaigns/${id}`);

// Cost per order
export const getAdCostPerOrder = (start, end) => api.get('/expenses/cost-per-order', { params: { start, end } });

// Reports
export const getReportSummary = (params) => api.get('/reports/summary', { params });
export const getMyStats = (params) => api.get('/reports/my-stats', { params });
export const getTopProducts = (params) => api.get('/reports/top-products', { params });
export const getTopCities = (params) => api.get('/reports/top-cities', { params });
export const getCities = () => api.get('/reports/cities');

// Settings
export const getSetting = (key) => api.get(`/settings/${key}`);
export const setSetting = (key, value) => api.post(`/settings/${key}`, null, { params: { value } });

// City management (CRUD)
export const getCityList = () => api.get('/cities');
export const createCity = (data) => api.post('/cities', data);
export const updateCity = (id, data) => api.put(`/cities/${id}`, data);
export const deleteCity = (id) => api.delete(`/cities/${id}`);
export const uploadCityPDF = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/cities/upload-pdf', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getCityPdfJob = (jobId) => api.get(`/cities/pdf-job/${jobId}`);
