import { useState, useEffect, useRef } from 'react';
import { subscribeEvents } from '../services/api.js';

export function useEventStream(maxEvents = 100) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub = subscribeEvents((event) => {
      if (event.type === 'connected') {
        setConnected(true);
        return;
      }
      setEvents((prev) => [event, ...prev].slice(0, maxEvents));
    });

    return unsub;
  }, [maxEvents]);

  return { events, connected };
}
