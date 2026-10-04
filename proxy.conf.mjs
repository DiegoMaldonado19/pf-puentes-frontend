// ng serve reenvía /api al backend; en Docker local API_URL apunta al host
export default {
  '/api': {
    target: process.env['API_URL'] ?? 'http://localhost:8080',
    changeOrigin: true,
  },
};
