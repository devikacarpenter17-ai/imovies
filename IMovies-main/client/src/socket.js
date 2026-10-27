import { io } from 'socket.io-client';

// One shared connection; pages connect when they need live seat updates.
export const socket = io({ autoConnect: false });
