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
        { returnDetailedScanResult: true, highlightScanRegion: true, maxScansPerSecond: 4 },
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
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <video ref={videoRef} className={running ? "aspect-video w-full object-cover" : "hidden"} muted playsInline />
        {!running && (
          <div className="flex aspect-video items-center justify-center text-sm text-zinc-400">Camera is off</div>
        )}
      </div>
      <Button variant={running ? "secondary" : "primary"} onClick={running ? stop : start} className="w-full">
        {running ? "Stop camera" : "Start scanning"}
      </Button>
      {cameraError && <p className="text-sm text-danger">{cameraError}</p>}
      <CheckinResultBanner result={state?.result} error={state?.error} />
    </div>
  );
}
