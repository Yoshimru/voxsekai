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

  const player = document.getElementById("global-player");
  const playerAudio = player?.querySelector("[data-player-audio]");
  const trackCatalogElement = document.getElementById("track-catalog");
  const trackCatalog = trackCatalogElement
    ? JSON.parse(trackCatalogElement.textContent)
    : [];
  const tracksById = new Map(trackCatalog.map((track) => [track.id, track]));
  const playerStorageKey = "voxsekai.player.v1";
  const playerElements = {
    title: player?.querySelector("[data-player-title]"),
    artist: player?.querySelector("[data-player-artist]"),
    status: player?.querySelector("[data-player-status]"),
    artwork: player?.querySelector("[data-player-artwork]"),
    glyph: player?.querySelector("[data-player-glyph]"),
    current: player?.querySelector("[data-player-current]"),
    duration: player?.querySelector("[data-player-duration]"),
    seek: player?.querySelector("[data-player-seek]"),
    volume: player?.querySelector("[data-player-volume]"),
    toggleIcon: player?.querySelector("[data-player-toggle-icon]"),
    toggleButton: player?.querySelector('[data-player-action="toggle"]'),
  };

  function readPlayerState() {
    try {
      const saved = JSON.parse(localStorage.getItem(playerStorageKey) || "null");
      if (!saved || !tracksById.has(saved.trackId)) return null;
      return {
        trackId: saved.trackId,
        queue: Array.isArray(saved.queue)
          ? saved.queue.filter((id) => tracksById.has(id))
          : [saved.trackId],
        position: Math.max(0, Number(saved.position) || 0),
        isPlaying: saved.isPlaying === true,
        visible: saved.visible !== false,
        updatedAt: Number(saved.updatedAt) || Date.now(),
        volume: Math.min(1, Math.max(0, Number(saved.volume) || 0)),
      };
    } catch (error) {
      console.warn("Не удалось прочитать состояние плеера.", error);
      return null;
    }
  }

  let playerState = readPlayerState();
  let lastPlayerTick = Date.now();
  let lastPlayerSave = 0;

  function formatTime(seconds) {
    const time = Math.max(0, Math.floor(seconds));
    return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
  }

  function savePlayerState() {
    if (!playerState) return;
    playerState.updatedAt = Date.now();
    playerState.volume = playerAudio?.volume ?? playerState.volume;
    try {
      localStorage.setItem(playerStorageKey, JSON.stringify(playerState));
    } catch (error) {
      console.warn("Не удалось сохранить состояние плеера.", error);
    }
  }

  function renderPlayer() {
    if (!player || !playerState) return;
    const track = tracksById.get(playerState.trackId);
    if (!track) return;

    player.hidden = !playerState.visible;
    player.setAttribute("aria-hidden", String(!playerState.visible));
    document.body.classList.toggle("has-player", playerState.visible);
    document.body.classList.toggle("player-playing", playerState.isPlaying);
    playerElements.title.textContent = track.displayTitle;
    playerElements.artist.textContent = track.artist;
    playerElements.status.textContent = track.audioUrl
      ? "Воспроизводится"
      : "Демо · аудио не подключено";
    playerElements.glyph.textContent = track.artworkGlyph;
    playerElements.artwork.className = `player-artwork ${track.artworkClass}`;
    player.querySelectorAll("[data-player-details]").forEach((link) => {
      link.href = `/track/${track.id}`;
    });
    playerElements.duration.textContent = formatTime(track.duration);
    playerElements.current.textContent = formatTime(playerState.position);
    playerElements.seek.max = String(track.duration);
    playerElements.seek.value = String(
      Math.min(track.duration, playerState.position),
    );
    playerElements.seek.style.setProperty(
      "--player-progress",
      `${Math.min(100, (playerState.position / track.duration) * 100)}%`,
    );
    playerElements.volume.style.setProperty(
      "--player-volume",
      `${playerState.volume * 100}%`,
    );
    playerElements.toggleIcon.textContent = playerState.isPlaying ? "Ⅱ" : "▶";
    playerElements.toggleButton.setAttribute(
      "aria-label",
      playerState.isPlaying ? "Пауза" : "Продолжить",
    );
    playerElements.toggleButton.title = playerState.isPlaying
      ? "Пауза"
      : "Продолжить";
  }

  function persistAndRender() {
    if (!playerState) return;
    renderPlayer();
    savePlayerState();
  }

  function queueFromCurrentPage() {
    const visibleTrackIds = Array.from(
      document.querySelectorAll(
        ".track-row[data-track-id], .catalog-track[data-track-id]",
      ),
    )
      .map((card) => card.dataset.trackId)
      .filter((id) => tracksById.has(id));
    return Array.from(new Set(visibleTrackIds));
  }

  function startTrack(trackId) {
    const track = tracksById.get(trackId);
    if (!track) {
      notify("Не удалось загрузить данные этого трека.");
      return;
    }

    const queue = queueFromCurrentPage();
    if (!queue.includes(trackId)) queue.unshift(trackId);
    playerState = {
      trackId,
      queue: queue.length ? queue : [trackId],
      position: 0,
      isPlaying: true,
      visible: true,
      updatedAt: Date.now(),
      volume: playerAudio?.volume ?? playerState?.volume ?? 0.7,
    };

    if (playerAudio) {
      playerAudio.pause();
      playerAudio.removeAttribute("src");
      if (track.audioUrl) {
        playerAudio.src = track.audioUrl;
        playerAudio.volume = playerState.volume;
        playerAudio.play().catch((error) => {
          playerState.isPlaying = false;
          notify("Не удалось воспроизвести аудиофайл.");
          console.error(error);
          persistAndRender();
        });
      }
    }
    lastPlayerTick = Date.now();
    persistAndRender();
  }

  function playQueueOffset(offset) {
    if (!playerState?.queue.length) return;
    const currentIndex = Math.max(
      0,
      playerState.queue.indexOf(playerState.trackId),
    );
    const nextIndex =
      (currentIndex + offset + playerState.queue.length) %
      playerState.queue.length;
    startTrack(playerState.queue[nextIndex]);
  }

  if (player && playerState) {
    if (playerState.isPlaying && !tracksById.get(playerState.trackId).audioUrl) {
      const elapsed = Math.max(0, (Date.now() - playerState.updatedAt) / 1000);
      playerState.position += elapsed;
      const duration = tracksById.get(playerState.trackId).duration;
      if (playerState.position >= duration) {
        playerState.position = duration;
        playerState.isPlaying = false;
      }
    }
    if (playerAudio) {
      playerAudio.volume = playerState.volume;
      const track = tracksById.get(playerState.trackId);
      if (track.audioUrl && playerState.isPlaying) {
        playerAudio.src = track.audioUrl;
        playerAudio.currentTime = Math.min(
          playerState.position,
          track.duration,
        );
        playerAudio.play().catch((error) => {
          playerState.isPlaying = false;
          console.error("Не удалось восстановить воспроизведение.", error);
          persistAndRender();
        });
      }
    }
    renderPlayer();
    savePlayerState();
  }

  document.addEventListener("click", (event) => {
    const playButton = event.target.closest("[data-player-play]");
    if (playButton) {
      const trackCard = playButton.closest("[data-track-id]");
      const trackId = playButton.dataset.trackId || trackCard?.dataset.trackId;
      if (trackId) startTrack(trackId);
    }

    const action = event.target.closest("[data-player-action]")?.dataset
      .playerAction;
    if (!action || !playerState) return;
    if (action === "toggle") {
      if (playerState.isPlaying) {
        playerState.position = playerAudio?.src
          ? playerAudio.currentTime
          : playerState.position;
        playerState.isPlaying = false;
        playerAudio?.pause();
      } else {
        playerState.isPlaying = true;
        const track = tracksById.get(playerState.trackId);
        if (track?.audioUrl && playerAudio) {
          playerAudio.play().catch((error) => {
            playerState.isPlaying = false;
            notify("Не удалось продолжить воспроизведение.");
            console.error(error);
          });
        }
      }
      lastPlayerTick = Date.now();
      persistAndRender();
    } else if (action === "next") {
      playQueueOffset(1);
    } else if (action === "previous") {
      if (playerState.position > 3) {
        playerState.position = 0;
        if (playerAudio?.src) playerAudio.currentTime = 0;
        persistAndRender();
      } else {
        playQueueOffset(-1);
      }
    } else if (action === "dismiss") {
      playerState.visible = false;
      persistAndRender();
    }
  });

  playerElements.seek?.addEventListener("input", () => {
    if (!playerState) return;
    playerState.position = Number(playerElements.seek.value);
    if (playerAudio?.src) playerAudio.currentTime = playerState.position;
    persistAndRender();
  });
  playerElements.volume?.addEventListener("input", () => {
    if (!playerState) return;
    playerState.volume = Number(playerElements.volume.value);
    if (playerAudio) playerAudio.volume = playerState.volume;
    savePlayerState();
  });
  playerAudio?.addEventListener("timeupdate", () => {
    if (!playerState || !playerAudio.src) return;
    playerState.position = playerAudio.currentTime;
    renderPlayer();
  });
  playerAudio?.addEventListener("ended", () => playQueueOffset(1));
  window.addEventListener("pagehide", savePlayerState);

  if (player) {
    playerElements.volume.value = String(playerAudio?.volume ?? 0.7);
    window.setInterval(() => {
      if (!playerState?.isPlaying) {
        lastPlayerTick = Date.now();
        return;
      }
      const now = Date.now();
      if (!playerAudio?.src) {
        playerState.position += (now - lastPlayerTick) / 1000;
      }
      lastPlayerTick = now;
      const track = tracksById.get(playerState.trackId);
      if (track && playerState.position >= track.duration) {
        playQueueOffset(1);
        return;
      }
      renderPlayer();
      if (now - lastPlayerSave >= 1000) {
        lastPlayerSave = now;
        savePlayerState();
      }
    }, 250);
  }

  document.querySelectorAll(".like-button").forEach((button) => {
    button.addEventListener("click", () => {
      const liked = button.classList.toggle("liked");
      button.textContent = liked ? "♥" : "♡";
      button.setAttribute("aria-pressed", String(liked));
      notify(liked ? "Добавлено в избранное" : "Удалено из избранного");
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
          `/catalog?q=${encodeURIComponent(search.value.trim())}`,
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

})();
