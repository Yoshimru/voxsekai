(() => {
  const toast = document.getElementById('toast');
  let toastTimer;
  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  document.querySelectorAll('.like-button').forEach(button => {
    button.addEventListener('click', () => {
      const liked = button.classList.toggle('liked');
      button.textContent = liked ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(liked));
      notify(liked ? 'Добавлено в избранное' : 'Удалено из избранного');
    });
  });

  document.querySelectorAll('.play-button').forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('.track-card');
      const title = card?.querySelector('h3')?.textContent || 'Трек';
      notify(`Демо-интерфейс: «${title}»`);
    });
  });

  const search = document.getElementById('site-search');
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search?.focus();
    }
    if (event.key === 'Escape') search?.blur();
  });
  search?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && search.value.trim()) {
      notify(`Поиск: ${search.value.trim()} — подключите API для реальных результатов`);
    }
  });

  const menuToggle = document.getElementById('menu-toggle');
  menuToggle?.addEventListener('click', () => notify('Мобильное меню: используйте нижнюю навигацию'));

  document.querySelectorAll('a[href^="/pages/"]').forEach(link => {
    // Пока страницы не созданы, направляем переход на готовую 404-страницу.
    link.addEventListener('click', event => {
      const target = link.getAttribute('href');
      if (target && !target.endsWith('404.html')) {
        event.preventDefault();
        window.location.href = '/pages/404.html';
      }
    });
  });
})();