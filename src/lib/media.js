// 사진 줄이기, 노트북 카메라, 혼자 말해보기 녹음.

const MAX_SIDE = 1280;
const MAX_BYTES = 300 * 1024;

function dataUrlBytes(url) {
  return Math.round((url.length - url.indexOf(',') - 1) * 0.75);
}

// 이미지를 다시 그려서 저장하므로 촬영 위치 같은 정보(EXIF)는 남지 않는다.
export function compressFromSource(source, w, h) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(source, 0, 0, cw, ch);
  let q = 0.82;
  let url = canvas.toDataURL('image/jpeg', q);
  while (dataUrlBytes(url) > MAX_BYTES && q > 0.35) {
    q -= 0.08;
    url = canvas.toDataURL('image/jpeg', q);
  }
  if (dataUrlBytes(url) > MAX_BYTES) {
    const c2 = document.createElement('canvas');
    c2.width = Math.round(cw * 0.7);
    c2.height = Math.round(ch * 0.7);
    c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
    url = c2.toDataURL('image/jpeg', 0.6);
  }
  return { dataUrl: url, bytes: dataUrlBytes(url), width: cw, height: ch };
}

export function compressFile(file) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try { resolve(compressFromSource(img, img.naturalWidth, img.naturalHeight)); }
      catch (e) { reject(e); }
      finally { URL.revokeObjectURL(src); }
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('not-image')); };
    img.src = src;
  });
}

export async function openCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } }, audio: false });
  videoEl.srcObject = stream;
  await videoEl.play().catch(() => {});
  return () => stream.getTracks().forEach((t) => t.stop());
}

export function snapshot(videoEl) {
  return compressFromSource(videoEl, videoEl.videoWidth || 1280, videoEl.videoHeight || 720);
}

// 녹음은 브라우저 안에서만 재생하고 어디에도 올리지 않는다.
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('no-mic');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return () => new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })));
    };
    rec.stop();
  });
}
