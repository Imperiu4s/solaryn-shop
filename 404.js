document.getElementById('errPath').textContent = location.pathname + location.search;

(function () {
  var c = document.getElementById('particleCanvas');
  if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ctx = c.getContext('2d'), ps = [];
  function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();
  function spawn() {
    return {
      x: Math.random() * c.width, y: -10, r: 1 + Math.random() * 2.2,
      speed: 0.4 + Math.random() * 0.9, drift: (Math.random() - 0.5) * 0.4,
      alpha: 0.15 + Math.random() * 0.35,
      hue: Math.random() < 0.5 ? '255,196,46' : '255,157,23'
    };
  }
  for (var i = 0; i < 55; i++) { var p = spawn(); p.y = Math.random() * c.height; ps.push(p); }
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      p.y += p.speed; p.x += p.drift;
      if (p.y > c.height + 10) ps[i] = spawn();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + p.hue + ',' + p.alpha + ')';
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  })();
})();
