import type { Socket } from "socket.io";

// Track which wallet address is associated with which socket
const socketToAddress = new Map<string, string>();
const addressToSocket = new Map<string, string>();

export function registerSocket(socketId: string, address: string): void {
  socketToAddress.set(socketId, address.toLowerCase());
  addressToSocket.set(address.toLowerCase(), socketId);
}

export function unregisterSocket(socketId: string): void {
  const address = socketToAddress.get(socketId);
  if (address) {
    addressToSocket.delete(address);
  }
  socketToAddress.delete(socketId);
}

export function getAddressForSocket(socketId: string): string | undefined {
  return socketToAddress.get(socketId);
}

export function getSocketIdForAddress(address: string): string | undefined {
  return addressToSocket.get(address.toLowerCase());
}

export function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  // For now, accept all connections. Auth happens via 'register' event.
  next();
}
