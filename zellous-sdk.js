class ZellousSDK {
  constructor(options = {}) {
    this.options = {
      serverUrl: options.serverUrl || 'ws://localhost:3000',
      autoReconnect: options.autoReconnect !== false,
      reconnectDelay: options.reconnectDelay || 3000,
      ...options
    };

    this.ws = null;
    this.clientId = null;
    this.roomId = null;
    this.user = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.connected = false;
  }

  connect(token = null) {
    return new Promise((resolve, reject) => {
      const url = token ? `${this.options.serverUrl}?token=${token}` : this.options.serverUrl;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.emit('connected');
        console.log('[Zellous SDK] Connected to server');
      };

      this.ws.onmessage = async (event) => {
        const data = await this._unpack(event.data);
        this._handleMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error('[Zellous SDK] WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
        console.log('[Zellous SDK] Disconnected from server');

        if (this.options.autoReconnect && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect(token);
          }, this.options.reconnectDelay);
        }
      };

      this.once('connection_established', (data) => {
        this.clientId = data.clientId;
        this.user = data.user;
        resolve(data);
      });
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  async joinRoom(roomId) {
    await this.send({ type: 'join_room', roomId });
    this.roomId = roomId;
    return new Promise((resolve) => {
      this.once('room_joined', (data) => resolve(data));
    });
  }

  async sendMessage(content, type = 'text') {
    if (type === 'text') {
      await this.send({ type: 'text_message', content });
    }
    return { success: true };
  }

  async sendImage(filename, base64Data, caption = '') {
    await this.send({
      type: 'image_message',
      filename,
      data: base64Data,
      caption
    });
    return { success: true };
  }

  async uploadFile(filename, base64Data, path = '', description = '') {
    await this.send({
      type: 'file_upload_complete',
      filename,
      data: base64Data,
      path,
      description
    });
    return { success: true };
  }

  async getMessages(limit = 50, before = null) {
    await this.send({ type: 'get_messages', limit, before });
    return new Promise((resolve) => {
      this.once('message_history', (data) => resolve(data.messages));
    });
  }

  async getFiles(path = '') {
    await this.send({ type: 'get_files', path });
    return new Promise((resolve) => {
      this.once('file_list', (data) => resolve(data.files));
    });
  }

  async broadcastState(appName, state) {
    await this.send({
      type: 'app_state_broadcast',
      appName,
      state,
      timestamp: Date.now()
    });
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrappedHandler = (...args) => {
      this.off(event, wrappedHandler);
      handler(...args);
    };
    return this.on(event, wrappedHandler);
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    const handlers = this.listeners.get(event);
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    const handlers = this.listeners.get(event);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[Zellous SDK] Error in ${event} handler:`, error);
      }
    });
  }

  async send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const packed = await this._pack(message);
    this.ws.send(packed);
  }

  _handleMessage(msg) {
    console.log('[Zellous SDK] Received:', msg.type);

    this.emit(msg.type, msg);
    this.emit('message', msg);

    switch (msg.type) {
      case 'connection_established':
        this.clientId = msg.clientId;
        this.user = msg.user;
        break;
      case 'room_joined':
        this.roomId = msg.roomId;
        break;
      case 'text_message':
      case 'image_message':
      case 'file_shared':
        this.emit('chat_message', msg);
        break;
      case 'user_joined':
        this.emit('user_presence', { type: 'joined', user: msg.user, userId: msg.userId });
        break;
      case 'user_left':
        this.emit('user_presence', { type: 'left', userId: msg.userId });
        break;
      case 'speaker_joined':
        this.emit('voice_presence', { type: 'joined', userId: msg.userId, user: msg.user });
        break;
      case 'speaker_left':
        this.emit('voice_presence', { type: 'left', userId: msg.userId, user: msg.user });
        break;
    }
  }

  async _pack(obj) {
    return new Blob([JSON.stringify(obj)]);
  }

  async _unpack(blob) {
    if (blob instanceof Blob) {
      const text = await blob.text();
      return JSON.parse(text);
    }
    return JSON.parse(blob);
  }

  getState() {
    return {
      connected: this.connected,
      clientId: this.clientId,
      roomId: this.roomId,
      user: this.user
    };
  }
}

window.ZellousSDK = ZellousSDK;
