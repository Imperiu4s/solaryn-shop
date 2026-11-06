document.getElementById('errPath').textContent = location.pathname + location.search;

(function () {
  var c = document.getElementById('errSky');
  if (!c || !window.SolarWorld) return;
  var w = new window.SolarWorld.World(c, { groundRows: 24 });
  w.setTheme(document.documentElement.getAttribute('data-theme') || 'solaryn');
  w.setView('home', { instant: true });
  w.showLetters = false;
  w.drawOnce();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) w.start();
  window.addEventListener('resize', function () { w.resize(); });
})();
