const AUTH_TOKEN_KEY = "reports_admin_token";

export const getStoredToken = () => {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
};

export const storeToken = (token) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};
