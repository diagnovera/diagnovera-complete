import io from 'socket.io-client';
import { config } from '../config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.callbacks = {};
  }

  connect() {
    this.socket = io(config.BACKEND_URL);
    
    this.socket.on('connected', () => {
      console.log('Connected to backend WebSocket');
    });

    this.socket.on('n8n_update', (data) => {
      if (this.callbacks.onN8nUpdate) {
        this.callbacks.onN8nUpdate(data);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from backend WebSocket');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  onN8nUpdate(callback) {
    this.callbacks.onN8nUpdate = callback;
  }
}

export default new WebSocketService();