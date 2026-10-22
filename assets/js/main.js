(() => {
  const toast = document.getElementById("toast");
  let toastTimer;
  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  document.querySelectorAll(".like-button").forEach((button) => {
    button.addEventListener("click", () => {
      const liked = button.classList.toggle("liked");
      button.textContent = liked ? "♥" : "♡";
      button.setAttribute("aria-pressed", String(liked));
      notify(liked ? "Добавлено в избранное" : "Удалено из избранного");
    });
  });

  document.querySelectorAll(".play-button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".track-card");
      const title = card?.querySelector("h3")?.textContent || "Трек";
      notify(`Демо-интерфейс: «${title}»`);
    });
  });

  const genreButtons = document.querySelectorAll(".genre-chip");
  const recommendedTracks = document.querySelectorAll(".track-row[data-genre]");
  genreButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedGenre = button.dataset.filter;
      genreButtons.forEach((genreButton) => {
        const selected = genreButton === button;
        genreButton.classList.toggle("active", selected);
        genreButton.setAttribute("aria-pressed", String(selected));
      });
      recommendedTracks.forEach((track) => {
        track.hidden =
          selectedGenre !== "all" && track.dataset.genre !== selectedGenre;
      });
    });
  });

  document.querySelectorAll("[data-auth-switch]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      document.body.classList.add("auth-leaving");
      setTimeout(() => window.location.assign(link.href), 180);
    });
  });

  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button
        .closest(".auth-password-wrap")
        ?.querySelector("input");
      if (!input) return;

      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      button.setAttribute("aria-pressed", String(showPassword));
      button.setAttribute(
        "aria-label",
        showPassword ? "Скрыть пароль" : "Показать пароль",
      );
    });
  });

  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = form.querySelector("[data-auth-message]");
      if (!message) return;

      message.textContent =
        form.dataset.authForm === "login"
          ? "Вход появится после подключения сервера авторизации."
          : "Регистрация появится после подключения сервера авторизации.";
      message.classList.add("is-visible");
    });
  });

  document.querySelectorAll("[data-auth-notice]").forEach((button) => {
    button.addEventListener("click", () => {
      const message = document.querySelector("[data-auth-message]");
      if (!message) return;
      message.textContent = button.dataset.authNotice;
      message.classList.add("is-visible");
    });
  });

  const search = document.getElementById("site-search");
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      search?.focus();
    }
    if (event.key === "Escape") search?.blur();
  });
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && search.value.trim()) {
      notify(
        `Поиск: ${search.value.trim()} — подключите API для реальных результатов`,
      );
    }
  });

  const menuToggle = document.getElementById("menu-toggle");
  menuToggle?.addEventListener("click", () =>
    notify("Мобильное меню: используйте нижнюю навигацию"),
  );

  document.querySelectorAll('a[href^="/pages/"]').forEach((link) => {
    // Пока страницы не созданы, направляем переход на готовую 404-страницу.
    link.addEventListener("click", (event) => {
      const target = link.getAttribute("href");
      const isAuthPage = /\/pages\/(login|register)\.html$/.test(target || "");
      if (target && !target.endsWith("404.html") && !isAuthPage) {
        event.preventDefault();
        window.location.href = "/pages/404.html";
      }
    });
  });
})();
