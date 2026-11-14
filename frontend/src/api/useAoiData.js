import { useEffect, useState } from 'react';
import * as api from './client';

const idle = { data: null, error: null, loading: false };
const KEYS = ['summary', 'calendar', 'anomaly', 'top', 'harmonization'];

/**
 * Грузит все 5 эндпоинтов параллельно. У каждого свой {data, error, loading},
 * поэтому падение одного блока не роняет остальные. Старые данные остаются на экране, пока грузятся новые.
 */
export function useAoiData(aoi, range, month) {
  const [state, setState] = useState(() => Object.fromEntries(KEYS.map((k) => [k, idle])));
  const aoiKey = JSON.stringify(aoi);

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const calls = {
      summary: () => api.getSummary(aoi, range, signal),
      calendar: () => api.getCalendar(aoi, range, signal),
      anomaly: () => api.getAnomaly(aoi, month, signal),
      top: () => api.getTop(aoi, range, signal),
      harmonization: () => api.getHarmonization(aoi, range, signal),
    };
    setState((prev) => Object.fromEntries(KEYS.map((k) => [k, { data: prev[k].data, error: null, loading: true }])));
    for (const k of KEYS) {
      calls[k]()
        .then((data) => !signal.aborted && setState((p) => ({ ...p, [k]: { data, error: null, loading: false } })))
        .catch((e) => {
          if (signal.aborted || e.name === 'AbortError') return;
          setState((p) => ({ ...p, [k]: { data: null, error: e, loading: false } }));
        });
    }
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoiKey, range.from, range.to, month]);

  return state;
}
