"use client";

import { useState } from "react";
import { Crosshair, ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui";

// Gym location for the check-in distance check. Either tap "Use this device's
// location" while at the gym, or paste "lat, lng" from Google Maps.
export function LocationField({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [text, setText] = useState(latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : "");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  const [lat, lng] = match ? [match[1], match[2]] : ["", ""];

  function useDevice() {
    if (!navigator.geolocation) return setError("This browser can't share its location.");
    setLocating(true);
    setError(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setText(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setLocating(false);
      },
      () => {
        setError("Couldn't get the location. Allow location access, or paste it from Google Maps.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">Gym location</span>
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="9.931233, 76.267304" inputMode="decimal" />
        <button
          type="button"
          onClick={useDevice}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-border/40"
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />} Use this device
        </button>
      </div>
      <input type="hidden" name="latitude" value={lat} />
      <input type="hidden" name="longitude" value={lng} />
      <p className="text-xs text-muted">
        At the gym, tap &quot;Use this device&quot;. Or in Google Maps, long-press the gym and copy the numbers.
        {match && (
          <>
            {" "}
            <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">
              Check on map <ExternalLink className="size-3" />
            </a>
          </>
        )}
      </p>
      {text && !match && <p className="text-xs text-danger">Use the form &quot;latitude, longitude&quot;.</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
