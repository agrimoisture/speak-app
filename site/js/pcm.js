/** PCM helpers shared by the audio engine and unit tests. */

export function floatToPcm16(sample) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

export function downsampleToPcm16(float32, inputRate, targetRate = 16000) {
  if (!float32 || float32.length === 0 || !inputRate) return new Int16Array(0);
  if (inputRate === targetRate) {
    const same = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i += 1) same[i] = floatToPcm16(float32[i]);
    return same;
  }
  const ratio = inputRate / targetRate;
  const outLen = Math.max(0, Math.floor((float32.length - 1) / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, float32.length - 1);
    const frac = pos - i0;
    out[i] = floatToPcm16(float32[i0] * (1 - frac) + float32[i1] * frac);
  }
  return out;
}

export function pcm16ToBase64(int16) {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = "";
  const stride = 0x1000;
  for (let i = 0; i < bytes.length; i += stride) {
    const slice = bytes.subarray(i, i + stride);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToPcm16(b64) {
  const binary = atob(b64);
  const length = binary.length - (binary.length % 2);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function concatPcm16(chunks) {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
