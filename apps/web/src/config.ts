export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  cdnUrl: import.meta.env.VITE_CDN_URL || '',
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || ''
  }
};
