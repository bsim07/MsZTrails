document.addEventListener('DOMContentLoaded', function(){
  initFractionTrails();
  registerServiceWorker();
});

function registerServiceWorker(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Fraction Trails service worker registered'))
      .catch((err) => console.log('Service worker registration failed', err));
  }
}
