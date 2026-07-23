const CACHE_NAME = 'difuminar-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './icon.png',
    './lib/vision_bundle.js',
    './wasm/vision_wasm_internal.js',
    './wasm/vision_wasm_internal.wasm',
    './models/face_landmarker.task',
    './models/selfie_segmenter.tflite',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // No bloqueamos la instalación si falla algún recurso externo, pero los guardamos
            return Promise.allSettled(
                ASSETS.map(url => cache.add(url).catch(e => console.warn('Cache error for', url, e)))
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchRes => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, fetchRes.clone());
                    return fetchRes;
                });
            });
        }).catch(() => {
            // Si todo falla y es una petición de imagen u otra cosa, podemos devolver un placeholder
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});
