// Service worker: no caching, plus Web Push notifications.
var ICON = null;
function getIcon(){
  if(ICON) return Promise.resolve(ICON);
  return fetch('/manifest.json').then(function(r){ return r.json(); }).then(function(m){
    ICON = (m.icons && m.icons[0] && m.icons[0].src) || undefined;
    return ICON;
  }).catch(function(){ return undefined; });
}
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){});
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(x){}
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
    for(var i = 0; i < list.length; i++){ if(list[i].visibilityState === 'visible' && list[i].focused) return; }
    return getIcon().then(function(icon){
      return self.registration.showNotification(d.title || 'EnganChat', {
        body: d.body || '', tag: d.tag || undefined, icon: icon, badge: icon, data: d.data || {}
      });
    });
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var tg = e.notification.data || {};
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
    if(list.length){
      var c = list[0];
      c.postMessage({kind:'push-open', target: tg});
      return c.focus();
    }
    var q = tg.type ? ('/?n=' + encodeURIComponent(tg.type + ':' + (tg.id || ''))) : '/';
    return self.clients.openWindow(q);
  }));
});
