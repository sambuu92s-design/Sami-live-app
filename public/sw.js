importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCqRq6A_IopzQHNuXOczeYNWENhjHj3AAY",
  authDomain: "sami-app-project.firebaseapp.com",
  projectId: "sami-app-project",
  storageBucket: "sami-app-project.firebasestorage.app",
  messagingSenderId: "417143307752",
  appId: "1:417143307752:web:00a868aad4cf6bb2b8b85d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Shift App";

  const options = {
    body: payload.notification?.body || "You have a new shift notification."
  };

  self.registration.showNotification(title, options);
});
const CACHE = "shift-app-shell-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match("/index.html")))
  );
});
