// config.js or wherever you define your URLs
const config = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000',
  n8nUrl: process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:8080',
  n8nWebhookUrl: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'http://localhost:8080/webhook/medical-diagnosis',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000'
};

export default config;