// Service worker: no caching, plus Web Push notifications.
var ICON = null;
var BADGE = null;
function getIcon(){
  if(ICON) return Promise.resolve(ICON);
  return fetch('/manifest.json').then(function(r){ return r.json(); }).then(function(m){
    ICON = (m.icons && m.icons[0] && m.icons[0].src) || undefined;
    return ICON;
  }).catch(function(){ return undefined; });
}
// Android status-bar icons must be a white silhouette on a transparent background.
function getBadge(){
  if(BADGE) return Promise.resolve(BADGE);
  return getIcon().then(function(src){
    if(!src || typeof OffscreenCanvas === 'undefined') return undefined;
    return fetch(src).then(function(r){ return r.blob(); }).then(function(b){ return createImageBitmap(b); }).then(function(bmp){
      var N = 96, c = new OffscreenCanvas(N, N), x = c.getContext('2d');
      x.drawImage(bmp, 0, 0, N, N);
      var im = x.getImageData(0, 0, N, N), d = im.data;
      var br = d[0], bg = d[1], bb = d[2];
      for(var i = 0; i < d.length; i += 4){
        var dist = Math.abs(d[i] - br) + Math.abs(d[i+1] - bg) + Math.abs(d[i+2] - bb);
        var a = Math.min(255, dist * 2.2);
        d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = a;
      }
      x.putImageData(im, 0, 0);
      return c.convertToBlob({type:'image/png'});
    }).then(function(blob){
      return new Promise(function(res){
        var fr = new FileReader();
        fr.onload = function(){ BADGE = fr.result; res(BADGE); };
        fr.onerror = function(){ res(undefined); };
        fr.readAsDataURL(blob);
      });
    }).catch(function(){ return undefined; });
  });
}
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){});
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(x){}
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
    for(var i = 0; i < list.length; i++){ if(list[i].visibilityState === 'visible' && list[i].focused) return; }
    return Promise.all([getIcon(), getBadge()]).then(function(r){
      return self.registration.showNotification(d.title || 'EnganChat', {
        body: d.body || '', tag: d.tag || undefined, icon: r[0], badge: r[1], data: d.data || {}
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
