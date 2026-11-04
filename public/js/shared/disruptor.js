
const DEBOUNCE_MS = 150;

const listeners = {};   
const timers = {};      
const latestData = {};  


function on(event, callback) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(callback);
  return () => off(event, callback);
}

function off(event, callback) {
  if (listeners[event]) listeners[event].delete(callback);
}


function emit(event, data) {
  latestData[event] = data;

  if (timers[event]) clearTimeout(timers[event]);

  timers[event] = setTimeout(() => {
    delete timers[event];
    const cbs = listeners[event];
    if (!cbs) return;
    const payload = latestData[event];
    cbs.forEach((cb) => {
      try { cb(payload); } catch (err) { console.error(`[disruptor] ${event}:`, err); }
    });
  }, DEBOUNCE_MS);
}

function destroy() {
  Object.values(timers).forEach(clearTimeout);
  Object.keys(listeners).forEach((k) => delete listeners[k]);
  Object.keys(timers).forEach((k) => delete timers[k]);
  Object.keys(latestData).forEach((k) => delete latestData[k]);
}

export const disruptor = { on, off, emit, destroy };
