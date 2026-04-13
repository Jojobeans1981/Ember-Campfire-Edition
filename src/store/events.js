/** @type {import('../models').ResponseEvent[]} */
export const eventQueue = [];

export function pushEvent(event) {
  eventQueue.push(event);
}

export function clearQueue() {
  eventQueue.length = 0;
}
