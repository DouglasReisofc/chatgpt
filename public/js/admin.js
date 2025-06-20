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

  // Sidebar visibility is handled purely with CSS media queries
});
