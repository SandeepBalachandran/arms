"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { isCheckinToken } from "@gymos/shared";
import { Button } from "@/components/ui";
import { checkInByToken, type CheckinState } from "./actions";
import { CheckinResultBanner } from "./checkin-result";

// Webcam scanner for member QR codes. Ignores the same code for a few seconds
// so one member isn't checked in on every video frame.
export function Scanner({ slug }: { slug: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastRef = useRef<{ token: string; at: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<CheckinState>();
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => () => scannerRef.current?.destroy(), []);

  async function start() {
    setCameraError(null);
    if (!scannerRef.current) {
      scannerRef.current = new QrScanner(
        videoRef.current!,
        async ({ data }) => {
          const now = Date.now();
          const last = lastRef.current;
          if (!isCheckinToken(data) || (last && last.token === data && now - last.at < 5000)) return;
          lastRef.current = { token: data, at: now };
          setState(await checkInByToken(slug, data));
        },
        // Back camera on phones: the front desk points it at the member's screen.
        { returnDetailedScanResult: true, highlightScanRegion: true, maxScansPerSecond: 4, preferredCamera: "environment" },
      );
    }
    try {
      await scannerRef.current.start();
      setRunning(true);
    } catch {
      setCameraError("Couldn't open the camera. Allow camera access for this site and try again.");
    }
  }

  function stop() {
    scannerRef.current?.stop();
    setRunning(false);
  }

  return (
    <div className="space-y-3">
      {/* The video always keeps its size: the scanner measures it when the camera
          starts (a hidden video gave a blank box with only the scan outline). */}
      <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-black sm:aspect-video">
        <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-sm text-zinc-400">Camera is off</div>
        )}
      </div>
      <Button variant={running ? "secondary" : "primary"} onClick={running ? stop : start} className="w-full">
        {running ? "Stop camera" : "Start scanning"}
      </Button>
      {cameraError && <p className="text-sm text-danger">{cameraError}</p>}
      <CheckinResultBanner result={state?.result} photoUrl={state?.photoUrl} error={state?.error} />
    </div>
  );
}
