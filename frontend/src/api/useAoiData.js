import { useEffect, useState } from "react";
import * as api from "./client";

const idle = { data: null, error: null, loading: false };
const KEYS = ["summary", "calendar", "anomaly", "top", "harmonization"];

export function useAoiData(aoi, range, month, revision = 0) {
  const [state, setState] = useState(() =>
    Object.fromEntries(KEYS.map((key) => [key, idle])),
  );
  const aoiKey = JSON.stringify(aoi);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const calls = {
      summary: () => api.getSummary(aoi, range, signal),
      calendar: () => api.getCalendar(aoi, range, signal),
      top: () => api.getTop(aoi, range, signal),
      harmonization: () => api.getHarmonization(aoi, range, signal),
    };
    setState((previous) => ({
      ...previous,
      ...Object.fromEntries(
        Object.keys(calls).map((key) => [key, { ...idle, loading: true }]),
      ),
    }));
    for (const [key, call] of Object.entries(calls)) {
      call()
        .then((data) => {
          if (!signal.aborted)
            setState((previous) => ({
              ...previous,
              [key]: { data, error: null, loading: false },
            }));
        })
        .catch((error) => {
          if (!signal.aborted)
            setState((previous) => ({
              ...previous,
              [key]: { data: null, error, loading: false },
            }));
        });
    }
    return () => controller.abort();
  }, [aoiKey, range.from, range.to, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({
      ...previous,
      anomaly: { ...idle, loading: true },
    }));
    api
      .getAnomaly(aoi, month, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            anomaly: { data, error: null, loading: false },
          }));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            anomaly: { data: null, error, loading: false },
          }));
      });
    return () => controller.abort();
  }, [aoiKey, month, revision]);

  return state;
}
