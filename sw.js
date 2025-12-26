const APP_VERSION = 'v1.0.0';
const illegal = "/sw.js"

// urlsToCache kann jetzt leer sein, da wir alles dynamisch cachen
const urlsToCache = [
    "index.html", "/", "app.html",
];

async function saveToInboxClassic(file) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MusicAppDB', 2); // Gleiche Version wie in MusicDB
        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('inbox', 'readwrite');
            tx.objectStore('inbox').put({ type: "file", data: file, ts: Date.now() });
            tx.oncomplete = () => resolve();
        };
        request.onerror = () => reject();
    });
}

// 1. Install-Event: Caching der statischen Assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installiere und cache statische Assets...', APP_VERSION);
    self.skipWaiting();
    event.waitUntil(
        caches.open(APP_VERSION)
            .then(cache => {
                // Fügt alle in urlsToCache definierten Dateien dem Cache hinzu
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Caching der URLs fehlgeschlagen:', error);
                // Wichtig: Ein Fehler bei addAll() führt dazu, dass die Installation fehlschlägt
                // und der Worker nicht aktiviert wird.
            })
    );
});

// 2. Fetch-Event: Cache-First Strategie
self.addEventListener('fetch', (event) => {
    
    if (event.request.url.includes('/api/upload') && event.request.method === 'POST') {
        event.respondWith((async () => {
            const formData = await event.request.formData();
            const file = formData.get('media');
            if (file) {
                await saveToInboxClassic(file)
            }
            // Datei im Cache oder IndexedDB speichern und App öffnen
            return Response.redirect('/index.html?share_upload', 303);
        })());
    }


    if (event.request.method !== 'GET') {
        return;
    }
    if (event.request.url.includes('/sw.js')) {
        return;
    }

    
	event.respondWith((async () => {
        try {
            const cache = await caches.open(APP_VERSION);
            const cachedResponse = await cache.match(event.request);
            if(cachedResponse) return cachedResponse;
            
            const networkResponse = await fetch(event.request, { cache: 'no-cache' });
            console.log(cachedResponse, networkResponse);
            if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
            return networkResponse;

        } catch (error) {
            // Falls das Internet weg ist, geben wir eine Fehlermeldung
            console.error("Netzwerkfehler im SW:", error);
            return new Response("Du bist offline und diese Datei ist nicht im Cache.", {
                status: 503,
                statusText: "Service Unavailable"
            });
        }
    })());
});

// 3. Activate-Event: Alte Caches aufräumen
self.addEventListener('activate', event => {
    console.log('[Service Worker] Aktiviert. Lösche alte Caches.');
    // Stellt sicher, dass der neue Worker sofort die Kontrolle über alle Clients übernimmt
    event.waitUntil(
        Promise.all([
            self.clients.claim(),


            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Vergleiche jeden vorhandenen Cache-Namen mit dem aktuellen APP_VERSION
                        if (cacheName !== APP_VERSION) {
                            console.log('[Service Worker] Lösche alten Cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),

  
        // Alle Clients finden, die dieser Worker kontrolliert
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    // Sende die Versionsnummer als Nachricht
                    client.postMessage({
                        type: 'APP_VERSION',
                        data: APP_VERSION
                    });
                });
            })
        ])
    );
});