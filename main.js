// ============================================================
//  main.js — drawer, misc init
// ============================================================
(function () {
  const drawerToggle  = document.getElementById('drawerToggle');
  const drawer        = document.getElementById('drawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');

  function openDrawer()  { drawer.classList.add('open'); drawerBackdrop.classList.add('show'); }
  function closeDrawer() { drawer.classList.remove('open'); drawerBackdrop.classList.remove('show'); }

  drawerToggle.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  drawerBackdrop.addEventListener('click', closeDrawer);

  // Re-open admin panel if session active
  if (sessionStorage.getItem('breduck-admin') === '1') {
    document.body.classList.add('breduck-admin-active');
    if (window.bdSetDuckName) window.bdSetDuckName('Clark');
  }
})();
