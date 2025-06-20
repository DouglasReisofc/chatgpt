document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('themeToggle');

  if (localStorage.getItem('admin-theme') === 'dark') {
    document.body.classList.add('dark');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
      localStorage.setItem('admin-theme', theme);
    });
  }

  const sidebar = document.getElementById('sidebar');

  function updateSidebar() {
    if (!sidebar) return;
    if (window.innerWidth >= 768) {
      sidebar.classList.add('show');
    } else {
      sidebar.classList.remove('show');
    }
  }

  updateSidebar();
  window.addEventListener('resize', updateSidebar);
});
