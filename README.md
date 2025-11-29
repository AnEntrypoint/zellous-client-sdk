# Zellous SDK Integration Guide

## Overview

The Zellous SDK provides real-time collaboration features for Sequential Desktop applications. Apps can create rooms, share messages, files, and synchronize state across multiple users.

## Installation

Include the SDK in your app HTML:

```html
<script src="/zellous-sdk.js"></script>
```

## Basic Usage

### 1. Initialize the SDK

```javascript
const zellous = new ZellousSDK({
  serverUrl: 'ws://localhost:3000',
  autoReconnect: true,
  reconnectDelay: 3000
});
```

### 2. Connect to Server

```javascript
await zellous.connect();
console.log('Connected! Client ID:', zellous.clientId);
```

### 3. Join a Room

```javascript
const roomData = await zellous.joinRoom('flow-editor-room');
console.log('Joined room with users:', roomData.currentUsers);
```

### 4. Send Messages

```javascript
await zellous.sendMessage('Hello from Flow Editor!');

await zellous.sendImage('screenshot.png', base64Data, 'Check out my flow!');

await zellous.uploadFile('workflow.json', base64Data, '/flows/', 'My workflow export');
```

### 5. Listen for Events

```javascript
zellous.on('chat_message', (msg) => {
  console.log(`${msg.username}: ${msg.content}`);
});

zellous.on('user_presence', (data) => {
  if (data.type === 'joined') {
    console.log(`${data.user.username} joined`);
  } else {
    console.log(`User ${data.userId} left`);
  }
});

zellous.on('voice_presence', (data) => {
  if (data.type === 'joined') {
    console.log(`${data.user.username} started speaking`);
  }
});
```

### 6. Broadcast App State (Collaboration)

```javascript
zellous.on('app_state_broadcast', (data) => {
  if (data.appName === 'flow-editor') {
    updateLocalState(data.state);
  }
});

function syncState() {
  zellous.broadcastState('flow-editor', {
    currentFlow: flowData,
    selectedNode: selectedNodeId,
    cursorPosition: { x: 100, y: 200 }
  });
}
```

## Complete Example: Flow Editor with Collaboration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Collaborative Flow Editor</title>
  <script src="/zellous-sdk.js"></script>
</head>
<body>
  <div id="flow-canvas"></div>
  <div id="collaborators"></div>
  <div id="chat"></div>

  <script>
    const zellous = new ZellousSDK({
      serverUrl: 'ws://localhost:3000'
    });

    let currentFlow = {
      nodes: [],
      connections: []
    };

    let collaborators = new Map();

    async function initialize() {
      await zellous.connect();

      const roomId = `flow-${window.location.hash.slice(1) || 'default'}`;
      await zellous.joinRoom(roomId);

      zellous.on('user_presence', (data) => {
        if (data.type === 'joined') {
          collaborators.set(data.userId, data.user);
          updateCollaboratorsList();
        } else {
          collaborators.delete(data.userId);
          updateCollaboratorsList();
        }
      });

      zellous.on('app_state_broadcast', (data) => {
        if (data.appName === 'flow-editor') {
          mergeRemoteChanges(data.state, data.userId);
        }
      });

      zellous.on('chat_message', (msg) => {
        addChatMessage(msg);
      });

      broadcastMyState();
      setInterval(broadcastMyState, 2000);
    }

    function broadcastMyState() {
      zellous.broadcastState('flow-editor', {
        flow: currentFlow,
        selection: getSelectedNodes(),
        viewport: getViewportPosition()
      });
    }

    function mergeRemoteChanges(remoteState, userId) {
      const remoteCursor = remoteState.viewport;
      showRemoteCursor(userId, remoteCursor);

      if (hasConflict(remoteState.flow, currentFlow)) {
        resolveConflict(remoteState.flow);
      } else {
        currentFlow = mergeFlows(currentFlow, remoteState.flow);
        renderFlow();
      }
    }

    function updateCollaboratorsList() {
      const list = document.getElementById('collaborators');
      list.innerHTML = Array.from(collaborators.values())
        .map(u => `<div>${u.username}</div>`)
        .join('');
    }

    function addChatMessage(msg) {
      const chat = document.getElementById('chat');
      const div = document.createElement('div');
      div.textContent = `${msg.username}: ${msg.content}`;
      chat.appendChild(div);
    }

    initialize();
  </script>
</body>
</html>
```

## API Reference

### Constructor Options

```javascript
new ZellousSDK({
  serverUrl: string,        // WebSocket server URL (default: 'ws://localhost:3000')
  autoReconnect: boolean,   // Auto-reconnect on disconnect (default: true)
  reconnectDelay: number    // Reconnect delay in ms (default: 3000)
})
```

### Methods

#### `connect(token?: string): Promise<{ clientId, user }>`
Connect to the Zellous server. Optional token for authentication.

#### `disconnect(): void`
Disconnect from the server and stop auto-reconnect.

#### `joinRoom(roomId: string): Promise<{ roomId, currentUsers }>`
Join a collaboration room. Creates room if it doesn't exist.

#### `sendMessage(content: string): Promise<{ success }>`
Send a text message to the current room.

#### `sendImage(filename: string, base64Data: string, caption?: string): Promise<{ success }>`
Send an image with optional caption.

#### `uploadFile(filename: string, base64Data: string, path?: string, description?: string): Promise<{ success }>`
Upload a file to the room's file storage.

#### `getMessages(limit?: number, before?: timestamp): Promise<Message[]>`
Retrieve message history from the current room.

#### `getFiles(path?: string): Promise<File[]>`
List files in the room's file storage.

#### `broadcastState(appName: string, state: object): Promise<void>`
Broadcast app-specific state to all room members.

#### `on(event: string, handler: Function): Function`
Listen for events. Returns unsubscribe function.

#### `once(event: string, handler: Function): Function`
Listen for an event once. Auto-unsubscribes after first trigger.

#### `off(event: string, handler: Function): void`
Remove an event listener.

#### `getState(): { connected, clientId, roomId, user }`
Get current SDK state.

### Events

- `connected` - Connected to server
- `disconnected` - Disconnected from server
- `error` - WebSocket error occurred
- `connection_established` - Initial connection established (provides clientId and user)
- `room_joined` - Successfully joined a room
- `chat_message` - Received text/image/file message
- `user_presence` - User joined or left room
- `voice_presence` - User started/stopped speaking
- `app_state_broadcast` - Received app state broadcast from another user
- `message` - Any message received (catch-all)

### Message Structure

```javascript
// Text Message
{
  type: 'text_message',
  id: string,
  userId: number,
  username: string,
  content: string,
  timestamp: number
}

// Image Message
{
  type: 'image_message',
  id: string,
  userId: number,
  username: string,
  content: string,
  metadata: { filename, size, caption },
  timestamp: number
}

// File Shared
{
  type: 'file_shared',
  id: string,
  userId: number,
  username: string,
  content: string,
  metadata: { filename, path, description, size },
  timestamp: number
}

// User Presence
{
  type: 'joined' | 'left',
  user: { username, displayName },
  userId: number
}

// App State Broadcast
{
  type: 'app_state_broadcast',
  appName: string,
  state: object,
  timestamp: number,
  userId: number
}
```

## Integration Patterns

### Pattern 1: Chat Integration

```javascript
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

chatInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    await zellous.sendMessage(chatInput.value.trim());
    chatInput.value = '';
  }
});

zellous.on('chat_message', (msg) => {
  const div = document.createElement('div');
  div.className = msg.userId === zellous.clientId ? 'my-message' : 'other-message';
  div.innerHTML = `<strong>${msg.username}:</strong> ${msg.content}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
```

### Pattern 2: Real-time Cursor Sharing

```javascript
const cursors = new Map();

document.addEventListener('mousemove', (e) => {
  zellous.broadcastState('my-app', {
    cursor: { x: e.clientX, y: e.clientY },
    viewport: { scroll: window.scrollY }
  });
});

zellous.on('app_state_broadcast', (data) => {
  if (data.appName === 'my-app' && data.userId !== zellous.clientId) {
    updateRemoteCursor(data.userId, data.state.cursor);
  }
});
```

### Pattern 3: Operational Transformation (Conflict Resolution)

```javascript
let documentVersion = 0;
let pendingOps = [];

function applyLocalEdit(operation) {
  applyOperation(operation);
  documentVersion++;

  zellous.broadcastState('my-app', {
    operation,
    version: documentVersion,
    baseVersion: documentVersion - 1
  });
}

zellous.on('app_state_broadcast', (data) => {
  if (data.appName === 'my-app') {
    const transformed = transformOperation(
      data.state.operation,
      pendingOps,
      data.state.baseVersion
    );
    applyOperation(transformed);
    documentVersion++;
  }
});
```

## Best Practices

1. **Room Naming**: Use descriptive room IDs like `${appName}-${documentId}`
2. **State Throttling**: Broadcast state updates every 1-2 seconds, not on every change
3. **Conflict Resolution**: Implement OT or CRDT for concurrent editing
4. **Presence Awareness**: Show active collaborators with avatars/cursors
5. **Graceful Degradation**: Handle disconnect/reconnect gracefully
6. **Local-first**: Apply changes locally first, then broadcast

## Debugging

```javascript
// Enable SDK logging
zellous.on('message', (msg) => {
  console.log('[Zellous]', msg.type, msg);
});

// Check connection state
console.log(zellous.getState());

// Monitor room activity
zellous.on('user_presence', console.log);
zellous.on('voice_presence', console.log);
```
