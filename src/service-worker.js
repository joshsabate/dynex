/* eslint-disable no-restricted-globals */
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

clientsClaim();
self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST);

const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");

registerRoute(
  ({ request, url }) => {
    if (request.mode !== "navigate") {
      return false;
    }

    if (url.pathname.startsWith("/_")) {
      return false;
    }

    if (url.pathname.match(fileExtensionRegexp)) {
      return false;
    }

    return true;
  },
  createHandlerBoundToURL(`${process.env.PUBLIC_URL}/index.html`)
);

registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
  new CacheFirst({
    cacheName: "dynex-images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request, sameOrigin }) =>
    sameOrigin && ["script", "style", "worker"].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: "dynex-static-runtime",
  })
);
