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
export const googleLogin = (data) => api.post('/auth/google', data);
export const changePassword = (data) => api.post('/auth/change-password', data);
export const updateStoreName = (data) => api.patch('/auth/update-store', data);
export const updateUsername = (data) => api.patch('/auth/update-username', data);
export const forgotPassword = (data) => api.post('/auth/forgot-password', data);
export const resetPassword = (data) => api.post('/auth/reset-password', data);

// Products
export const getProducts = () => api.get('/products');
export const createProduct = (data) => api.post('/products', data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const uploadProductImage = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/products/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const deleteProduct = (id) => api.delete(`/products/${id}`);
export const addVariant = (productId, data) => api.post(`/products/${productId}/variants`, data);
export const updateVariant = (variantId, data) => api.put(`/products/variants/${variantId}`, data);
export const deleteVariant = (variantId) => api.delete(`/products/variants/${variantId}`);

// Packs
export const getPacks = () => api.get('/packs');
export const createPack = (data) => api.post('/packs', data);
export const updatePack = (id, data) => api.put(`/packs/${id}`, data);
export const togglePack = (id) => api.patch(`/packs/${id}/toggle`);
export const deletePack = (id) => api.delete(`/packs/${id}`);
export const addPackPreset = (packId, data) => api.post(`/packs/${packId}/presets`, data);
export const deletePackPreset = (presetId) => api.delete(`/packs/presets/${presetId}`);

// Offers
export const getOffers = () => api.get('/offers');
export const createOffer = (data) => api.post('/offers', data);
export const updateOffer = (id, data) => api.put(`/offers/${id}`, data);
export const toggleOffer = (id) => api.patch(`/offers/${id}/toggle`);
export const deleteOffer = (id) => api.delete(`/offers/${id}`);

// Promo Codes
export const getPromoCodes = () => api.get('/promo-codes');
export const createPromoCode = (data) => api.post('/promo-codes', data);
export const updatePromoCode = (id, data) => api.put(`/promo-codes/${id}`, data);
export const togglePromoCode = (id) => api.patch(`/promo-codes/${id}/toggle`);
export const deletePromoCode = (id) => api.delete(`/promo-codes/${id}`);

// Stock
export const getStockArrivals = () => api.get('/stock/arrivals');
export const addBulkStockArrival = (data) => api.post('/stock/arrivals', data);
export const getBrokenStock = () => api.get('/stock/broken');
export const addBrokenStock = (data) => api.post('/stock/broken', data);
export const updateBrokenStock = (id, data) => api.put(`/stock/broken/${id}`, data);
export const deleteBrokenStock = (id) => api.delete(`/stock/broken/${id}`);
export const deleteArrival = (id) => api.delete(`/stock/arrivals/${id}`);
export const adjustStock = (variantId, stock) => api.put(`/stock/variants/${variantId}/stock`, { stock });

// Orders
export const getOrders = (params = {}) => api.get('/orders', { params });
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
export const sendToOlivraison = (id) => api.post(`/olivraison/send/${id}`);

// Team
export const getTeam = () => api.get('/team');
export const createTeamMember = (data) => api.post('/team', data);
export const updateTeamMember = (id, data) => api.put(`/team/${id}`, data);
export const deleteTeamMember = (id) => api.delete(`/team/${id}`);
export const createConfirmerAccount = (memberId, data) => api.post(`/team/${memberId}/create-account`, data);
export const getMemberStats = (memberId, params) => api.get(`/team/${memberId}/stats`, { params });
export const toggleMemberAccount     = (memberId) => api.post(`/team/${memberId}/toggle-account`);
export const updateMemberPermissions = (memberId, permissions) => api.patch(`/team/${memberId}/permissions`, { permissions });

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

// Ad Platforms (read-only, used by Expenses page)
export const getAdPlatforms = () => api.get('/expenses/platforms');

// Cost per order
export const getAdCostPerOrder = (start, end) => api.get('/expenses/cost-per-order', { params: { start, end } });

// Meta Ads
export const getMetaStatus = () => api.get('/meta/status');
export const getMetaAdAccounts = (token) => api.get('/meta/adaccounts', { params: { token } });
export const connectMeta = (data) => api.post('/meta/connect', data);
export const disconnectMeta = () => api.delete('/meta/disconnect');
export const getMetaCampaigns = () => api.get('/meta/campaigns');
export const pauseMetaCampaign = (id) => api.post(`/meta/campaigns/${id}/pause`);
export const resumeMetaCampaign = (id) => api.post(`/meta/campaigns/${id}/resume`);
export const createMetaCampaign = (data) => api.post('/meta/campaigns', data);
export const getMetaSpend = (start, end) => api.get('/meta/spend', { params: { start, end } });
export const getMetaPages = () => api.get('/meta/pages');
export const searchMetaInterests = (q) => api.get('/meta/interests', { params: { q } });
export const uploadMetaImage = (file) => { const form = new FormData(); form.append('file', file); return api.post('/meta/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } }); };
export const uploadMetaVideo = (file) => { const form = new FormData(); form.append('file', file); return api.post('/meta/upload-video', form, { headers: { 'Content-Type': 'multipart/form-data' } }); };
export const createFullCampaign = (data) => api.post('/meta/full-campaign', data);

// Google Ads
export const getGoogleStatus = () => api.get('/google/status');
export const connectGoogle = (data) => api.post('/google/connect', data);
export const disconnectGoogle = () => api.delete('/google/disconnect');
export const getGoogleCampaigns = () => api.get('/google/campaigns');
export const pauseGoogleCampaign = (id) => api.post(`/google/campaigns/${id}/pause`);
export const resumeGoogleCampaign = (id) => api.post(`/google/campaigns/${id}/resume`);
export const getGoogleSpend = (start, end) => api.get('/google/spend', { params: { start, end } });

// TikTok Ads
export const getTikTokStatus = () => api.get('/tiktok/status');
export const connectTikTok = (data) => api.post('/tiktok/connect', data);
export const disconnectTikTok = () => api.delete('/tiktok/disconnect');
export const getTikTokCampaigns = () => api.get('/tiktok/campaigns');
export const pauseTikTokCampaign = (id) => api.post(`/tiktok/campaigns/${id}/pause`);
export const resumeTikTokCampaign = (id) => api.post(`/tiktok/campaigns/${id}/resume`);
export const getTikTokSpend = (start, end) => api.get('/tiktok/spend', { params: { start, end } });

// Snapchat Ads
export const getSnapchatStatus = () => api.get('/snapchat/status');
export const connectSnapchat = (data) => api.post('/snapchat/connect', data);
export const disconnectSnapchat = () => api.delete('/snapchat/disconnect');
export const getSnapchatCampaigns = () => api.get('/snapchat/campaigns');
export const pauseSnapchatCampaign = (id) => api.post(`/snapchat/campaigns/${id}/pause`);
export const resumeSnapchatCampaign = (id) => api.post(`/snapchat/campaigns/${id}/resume`);
export const getSnapchatSpend = (start, end) => api.get('/snapchat/spend', { params: { start, end } });

// Pinterest Ads
export const getPinterestStatus = () => api.get('/pinterest/status');
export const connectPinterest = (data) => api.post('/pinterest/connect', data);
export const disconnectPinterest = () => api.delete('/pinterest/disconnect');
export const getPinterestCampaigns = () => api.get('/pinterest/campaigns');
export const pausePinterestCampaign = (id) => api.post(`/pinterest/campaigns/${id}/pause`);
export const resumePinterestCampaign = (id) => api.post(`/pinterest/campaigns/${id}/resume`);
export const getPinterestSpend = (start, end) => api.get('/pinterest/spend', { params: { start, end } });
export const getAdsSpendSummary = (start, end) => api.get('/ads/spend-summary', { params: { start, end } });

// Reports
export const getReportSummary = (params) => api.get('/reports/summary', { params });
export const getMyStats = (params) => api.get('/reports/my-stats', { params });
export const getTopProducts = (params) => api.get('/reports/top-products', { params });
export const getTopCities = (params) => api.get('/reports/top-cities', { params });
export const getCities = () => api.get('/reports/cities');
export const getDashboardStats = (params) => api.get('/reports/dashboard', { params });
export const getDashboardAttention = () => api.get('/reports/attention');
export const getDashboardWeekSummary = () => api.get('/reports/week-summary');

// Settings
export const getSetting = (key) => api.get(`/settings/${key}`);
export const setSetting = (key, value) => api.post(`/settings/${key}`, null, { params: { value } });

// AI
export const explainError = (data) => api.post('/ai/explain-error', data);

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

// Suppliers
export const getSuppliers       = () => api.get('/suppliers');
export const createSupplier     = (data) => api.post('/suppliers', data);
export const updateSupplier     = (id, data) => api.put(`/suppliers/${id}`, data);
export const deleteSupplier     = (id) => api.delete(`/suppliers/${id}`);
export const getSupplierDetail  = (id) => api.get(`/suppliers/${id}/detail`);
export const addSupplierPayment = (id, data) => api.post(`/suppliers/${id}/payments`, data);
export const deleteSupplierPayment = (id) => api.delete(`/suppliers/payments/${id}`);

// Leads
export const getLeads          = ()    => api.get('/leads');
export const deleteLead        = (id)  => api.delete(`/leads/${id}`);
export const confirmLead       = (id)  => api.post(`/leads/${id}/confirm`);
export const confirmPickup     = (id)  => api.post(`/leads/${id}/confirm`);
export const cancelLead        = (id)  => api.post(`/leads/${id}/cancel`);
export const notAnsweringLead  = (id)  => api.post(`/leads/${id}/not-answering`);
export const reportLead        = (id, reported_date)  => api.post(`/leads/${id}/report`, null, { params: { reported_date } });
export const getApiKey         = ()    => api.get('/leads/api-key');
export const rotateApiKey      = ()    => api.post('/leads/api-key/rotate');

// Platform (super admin)
export const getPlatformStats        = () => api.get('/platform/stats');
export const getPlatformGrowth       = () => api.get('/platform/growth');
export const getPlatformStores       = () => api.get('/platform/stores');
export const createPlatformStore     = (data) => api.post('/platform/stores', data);
export const updateStoreStatus       = (storeId, isApproved) => api.patch(`/platform/stores/${storeId}/status`, { is_approved: isApproved });
export const updateStoreSubscription = (storeId, data) => api.patch(`/platform/stores/${storeId}/subscription`, data);
export const updateStoreNotes        = (storeId, data) => api.patch(`/platform/stores/${storeId}/notes`, data);
export const resetStorePassword      = (storeId, newPassword) => api.post(`/platform/stores/${storeId}/reset-password`, { new_password: newPassword });
export const getStorePayments        = (storeId) => api.get(`/platform/stores/${storeId}/payments`);
export const addStorePayment         = (storeId, data) => api.post(`/platform/stores/${storeId}/payments`, data);
export const deletePayment           = (paymentId) => api.delete(`/platform/payments/${paymentId}`);
export const getPlatformSettings     = () => api.get('/platform/settings');
export const savePlatformSetting     = (key, value) => api.post('/platform/settings', { key, value });
export const getStoreStorage         = (storeId) => api.get(`/platform/stores/${storeId}/storage`);
export const getPlatformExpenses     = (month) => api.get('/platform/expenses', { params: month ? { month } : {} });
export const createPlatformExpense   = (data) => api.post('/platform/expenses', data);
export const updatePlatformExpense   = (id, data) => api.patch(`/platform/expenses/${id}`, data);
export const deletePlatformExpense   = (id) => api.delete(`/platform/expenses/${id}`);
export const deleteStore             = (id) => api.delete(`/platform/stores/${id}`);
export const importStoreExcel        = (storeId, file) => { const form = new FormData(); form.append('file', file); return api.post(`/platform/stores/${storeId}/import-excel`, form, { headers: { 'Content-Type': 'multipart/form-data' } }); };

// Notifications
export const getNotifications        = () => api.get('/notifications');
export const markNotificationRead    = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');

// Auth extras
export const updateProfile = (data) => api.patch('/auth/update-profile', data);

// Olivraison extras
export const requestOlivRamassage    = () => api.post('/olivraison/ramassage');
export const syncAllOlivraison       = () => api.post('/olivraison/sync-all');

// Forcelog
export const sendToForcelog          = (orderId) => api.post(`/forcelog/send/${orderId}`);
export const getForcelogStatus       = (orderId) => api.get(`/forcelog/status/${orderId}`);
export const requestForcelogRamassage = () => api.post('/forcelog/ramassage');
export const syncAllForcelog         = () => api.post('/forcelog/sync-all');

// WhatsApp Bot
export const getBotStatus  = ()  => api.get('/bot/status');
export const getBotQR      = ()  => api.get('/bot/qr');
export const connectBot    = ()  => api.post('/bot/connect');
export const disconnectBot = ()  => api.delete('/bot/disconnect');

// Campaign Connections
export const getCampaignConnections    = ()                          => api.get('/campaign-connections');
export const saveCampaignConnection    = (data)                      => api.post('/campaign-connections', data);
export const deleteCampaignConnection  = (id)                        => api.delete(`/campaign-connections/${id}`);
export const getCampaignItemStats      = (item_type, item_id, start, end) => api.get('/campaign-connections/item-stats', { params: { item_type, item_id, start, end } });
export const getCampaignBulkStats      = (start, end)                => api.get('/campaign-connections/bulk-stats', { params: { start, end } });

// Warehouses
export const getWarehouses       = ()           => api.get('/warehouses');
export const createWarehouse     = (data)       => api.post('/warehouses', data);
export const updateWarehouse     = (id, data)   => api.put(`/warehouses/${id}`, data);
export const deleteWarehouse     = (id)         => api.delete(`/warehouses/${id}`);
export const syncWarehousePrices = ()           => api.post('/warehouses/sync-prices');
export const getWarehouseStock   = (id)         => api.get(`/warehouses/${id}/stock`);

// Utility
export const errorMessage = (e) => e?.response?.data?.detail || e?.message || 'An error occurred';

// Rex
export const askRex        = (data) => api.post('/rex/ask', data);
export const getRexInsight = ()     => api.get('/rex/insight');
export const getAiCosts    = ()     => api.get('/rex/ai-costs');
