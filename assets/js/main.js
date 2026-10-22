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

  document.querySelectorAll("[data-playlist-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const added = button.classList.toggle("is-added");
      const trackName = button.dataset.playlistAdd;
      button.textContent = added ? "✓" : "＋";
      button.setAttribute(
        "aria-label",
        `${added ? "Убрать" : "Добавить"} ${trackName} ${added ? "из" : "в"} плейлист`,
      );
      notify(
        added
          ? `«${trackName}» добавлен в плейлист`
          : `«${trackName}» удалён из плейлиста`,
      );
    });
  });

  const genreButtons = document.querySelectorAll(".genre-chip");
  const genreItems = document.querySelectorAll(
    "[data-genre-item], .track-row[data-genre]",
  );
  const pageSearch = document.getElementById("page-search");
  let selectedGenre = "all";

  function filterDirectory() {
    const query = pageSearch?.value.trim().toLocaleLowerCase("ru") || "";
    let visibleCount = 0;

    genreItems.forEach((item) => {
      const itemGenres = (item.dataset.genre || "").split(/\s+/);
      const itemText = (
        item.dataset.searchText || item.textContent
      ).toLocaleLowerCase("ru");
      const matchesGenre =
        selectedGenre === "all" || itemGenres.includes(selectedGenre);
      const matchesQuery = !query || itemText.includes(query);
      item.hidden = !matchesGenre || !matchesQuery;
      if (!item.hidden) visibleCount += 1;
    });

    document.querySelectorAll("[data-results-count]").forEach((counter) => {
      counter.textContent = String(visibleCount);
    });
    document.querySelectorAll(".directory-empty").forEach((emptyState) => {
      emptyState.hidden = visibleCount > 0;
    });
  }

  genreButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedGenre = button.dataset.filter;
      genreButtons.forEach((genreButton) => {
        const selected = genreButton === button;
        genreButton.classList.toggle("active", selected);
        genreButton.setAttribute("aria-pressed", String(selected));
      });
      filterDirectory();
    });
  });
  pageSearch?.addEventListener("input", filterDirectory);

  document.querySelectorAll("select[id$='-sort']").forEach((select) => {
    select.addEventListener("change", () => {
      const list = select
        .closest(".directory-content")
        ?.querySelector("[data-sort-list]");
      if (!list) return;

      const items = Array.from(list.children);
      const sortBy = select.value;
      items.sort((first, second) => {
        if (sortBy === "rating") {
          return Number(second.dataset.rating) - Number(first.dataset.rating);
        }
        if (sortBy === "title" || sortBy === "name") {
          return first.textContent.localeCompare(second.textContent, "ru");
        }
        return (
          Number(second.dataset.tracks || second.dataset.rating) -
          Number(first.dataset.tracks || first.dataset.rating)
        );
      });
      items.forEach((item) => list.append(item));
    });
  });

  document.querySelectorAll("[data-filter-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(expanded));
      button.classList.toggle("is-active", expanded);
      document
        .querySelector(".directory-genres")
        ?.classList.toggle("filters-open", expanded);
    });
  });

  document.querySelectorAll("[data-track-title]").forEach((button) => {
    button.addEventListener("click", () => {
      notify(`Открываем трек «${button.dataset.trackTitle}»`);
    });
  });

  document
    .querySelector("[data-load-more]")
    ?.addEventListener("click", (event) => {
      event.currentTarget.hidden = true;
      notify("Показаны все исполнители каталога");
    });

  const selectedTrackNames = new Set();
  const selectedCount = document.querySelector("[data-selected-count]");
  const selectedTracks = document.querySelector("[data-selected-tracks]");
  document.querySelectorAll("[data-add-track]").forEach((button) => {
    button.addEventListener("click", () => {
      const trackName = button.dataset.addTrack;
      if (selectedTrackNames.has(trackName)) {
        selectedTrackNames.delete(trackName);
        button.closest(".available-track")?.classList.remove("is-added");
        button.classList.remove("is-selected");
        button.textContent = "+";
        button.setAttribute("aria-label", `Добавить ${trackName}`);
      } else {
        selectedTrackNames.add(trackName);
        button.closest(".available-track")?.classList.add("is-added");
        button.classList.add("is-selected");
        button.textContent = "✓";
        button.setAttribute("aria-label", `Убрать ${trackName}`);
      }

      if (selectedCount) {
        selectedCount.textContent = `${selectedTrackNames.size} выбрано`;
      }
      if (selectedTracks) {
        selectedTracks.textContent = selectedTrackNames.size
          ? `В плейлисте: ${Array.from(selectedTrackNames).join(", ")}`
          : "Выбери треки, которые войдут в плейлист.";
      }
    });
  });

  const trackSearch = document.querySelector("[data-track-search]");
  trackSearch?.addEventListener("input", () => {
    const query = trackSearch.value.trim().toLocaleLowerCase("ru");
    document.querySelectorAll(".available-track").forEach((track) => {
      track.hidden = !track.dataset.trackName
        .toLocaleLowerCase("ru")
        .includes(query);
    });
  });

  document
    .querySelector("[data-cover-input]")
    ?.addEventListener("change", (event) => {
      const file = event.currentTarget.files?.[0];
      const upload = event.currentTarget.closest(".cover-upload");
      const hint = upload?.querySelector("[data-cover-hint]");
      if (!file || !hint) return;

      if (file.size > 5 * 1024 * 1024) {
        hint.textContent = "Файл должен быть меньше 5 МБ.";
        event.currentTarget.value = "";
        return;
      }
      hint.textContent = file.name;
    });

  document
    .querySelector("[data-playlist-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const title = document.querySelector("#playlist-name")?.value.trim();
      const message = document.querySelector("[data-playlist-message]");
      if (!message) return;
      if (!selectedTrackNames.size) {
        message.textContent = "Добавь хотя бы один трек в плейлист.";
        message.classList.add("is-visible");
        return;
      }

      message.textContent = `«${title}» готов к сохранению после подключения хранилища плейлистов.`;
      message.classList.add("is-visible");
    });

  document
    .querySelector("[data-profile-notice]")
    ?.addEventListener("click", () => {
      const message = document.querySelector("[data-profile-message]");
      if (!message) return;
      message.textContent =
        "Редактирование профиля станет доступно после входа в аккаунт.";
      message.classList.add("is-visible");
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
      if (pageSearch) {
        pageSearch.value = search.value.trim();
        pageSearch.dispatchEvent(new Event("input", { bubbles: true }));
        pageSearch.focus();
      } else {
        window.location.assign(
          `/pages/catalog.html?q=${encodeURIComponent(search.value.trim())}`,
        );
      }
    }
  });

  if (pageSearch) {
    const initialQuery = new URLSearchParams(window.location.search).get("q");
    if (initialQuery) {
      pageSearch.value = initialQuery;
      filterDirectory();
    }
  }

  const menuToggle = document.getElementById("menu-toggle");
  menuToggle?.addEventListener("click", () =>
    notify("Мобильное меню: используйте нижнюю навигацию"),
  );

  document.querySelectorAll('a[href^="/pages/"]').forEach((link) => {
    // Пока страницы не созданы, направляем переход на готовую 404-страницу.
    link.addEventListener("click", (event) => {
      const target = link.getAttribute("href");
      const isAvailablePage =
        /\/pages\/(login|register|catalog|artists|collections|events|playlists|create-playlist|profile)\.html$/.test(
          target || "",
        );
      if (target && !target.endsWith("404.html") && !isAvailablePage) {
        event.preventDefault();
        window.location.href = "/pages/404.html";
      }
    });
  });
})();
