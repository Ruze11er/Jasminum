// Applies the saved theme before first paint, so there is no flash of the wrong theme.
// A separate file (not inline) so the Content-Security-Policy can forbid inline scripts.
try {
  var s = JSON.parse(localStorage.getItem('jasminum-ui') || '{}').state;
  var t = (s && s.theme) || 'system';
  var dark =
    t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
