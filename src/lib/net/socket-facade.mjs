//
// ESM 入口门面：与 lib/net/socket-facade.cjs 指向同一份运行时实例，
// 保证 CJS 与 ESM 两侧拿到的是同一个对象（module identity 一致）。
//
// 命名导出与内置运行时 wrapper.mjs 的导出面逐项对应，额外补充 Server 别名。
//

import runtime from '../../vendor/socket-runtime/index.js';

const Socket = runtime;
const WebSocket = runtime.WebSocket;
const WebSocketServer = runtime.WebSocketServer;
const Server = runtime.Server;
const createWebSocketStream = runtime.createWebSocketStream;
const Receiver = runtime.Receiver;
const Sender = runtime.Sender;
const PerMessageDeflate = runtime.PerMessageDeflate;
const extension = runtime.extension;
const subprotocol = runtime.subprotocol;

export default Socket;
export {
  Socket,
  WebSocket,
  WebSocketServer,
  Server,
  createWebSocketStream,
  Receiver,
  Sender,
  PerMessageDeflate,
  extension,
  subprotocol
};
