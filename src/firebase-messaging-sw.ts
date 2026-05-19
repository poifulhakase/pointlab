import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

const app = initializeApp({
  apiKey:            'AIzaSyBGjgLk6cXLPSDmk3p4mmbJ3bo4zSGiqQU',
  authDomain:        'pointlab.vercel.app',
  projectId:         'pointlab-96310',
  storageBucket:     'pointlab-96310.firebasestorage.app',
  messagingSenderId: '368940164446',
  appId:             '1:368940164446:web:5c0ecfb34e4ab411139bcf',
})

const messaging = getMessaging(app)

onBackgroundMessage(messaging, payload => {
  const title = payload.notification?.title ?? 'ぽいロボ レーダー'
  const body  = payload.notification?.body  ?? ''
  self.registration.showNotification(title, {
    body,
    icon:  '/calendar/icon-192.png',
    badge: '/calendar/icon-192.png',
    tag:   'poirobo-radar',
    data:  payload.data ?? {},
  })
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('pointlab.vercel.app') && 'focus' in c) return c.focus()
      }
      return self.clients.openWindow('https://pointlab.vercel.app/calendar/')
    })
  )
})
