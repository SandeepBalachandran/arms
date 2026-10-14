// expo-camera reads QR codes on the web with the browser's BarcodeDetector,
// which Safari (iPhone) and Firefox don't have. Fill it in with the ZXing
// decoder, served from our own site (copied by scripts/copy-web-assets.mjs).
import { setZXingModuleOverrides } from 'barcode-detector/polyfill';

setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path),
});
