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
  const favoritesStorageKey = "voxsekai.favorites.v1";
  const playlistsStorageKey = "voxsekai.playlists.v1";
  const profileStorageKey = "voxsekai.profile.v1";
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
  let renderedPlayerVisible = false;
  let volumeAnimationFrame = 0;

  function syncTrackPlaybackControls() {
    const currentTrackId = playerState?.trackId;
    const isPlaying = playerState?.isPlaying === true;
    document.querySelectorAll("[data-player-play]").forEach((button) => {
      const trackId = button.dataset.trackId || button.closest("[data-track-id]")?.dataset.trackId;
      const isCurrentTrack = Boolean(currentTrackId && trackId === currentTrackId);
      const isCurrentPlaying = isCurrentTrack && isPlaying;
      button.classList.toggle("is-playing", isCurrentPlaying);
      button.setAttribute("aria-pressed", String(isCurrentPlaying));
      button.setAttribute(
        "aria-label",
        isCurrentPlaying
          ? `Пауза ${tracksById.get(trackId)?.displayTitle || "трека"}`
          : `${isCurrentTrack ? "Продолжить" : "Воспроизвести"} ${tracksById.get(trackId)?.displayTitle || "трек"}`,
      );
      button.title = isCurrentPlaying ? "Пауза" : "Воспроизвести";
    });

    document.querySelectorAll(".track-row[data-track-id], .catalog-track[data-track-id]").forEach((card) => {
      const isCurrentTrack = card.dataset.trackId === currentTrackId;
      card.classList.toggle("is-current-track", isCurrentTrack);
      card.classList.toggle("is-playing-track", isCurrentTrack && isPlaying);
      card.setAttribute("data-playback-state", isCurrentTrack ? (isPlaying ? "playing" : "paused") : "idle");
    });
  }

  function formatTime(seconds) {
    const time = Math.max(0, Math.floor(seconds));
    return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
  }

  function savePlayerState() {
    if (!playerState) return;
    playerState.updatedAt = Date.now();
    try {
      localStorage.setItem(playerStorageKey, JSON.stringify(playerState));
    } catch (error) {
      console.warn("Не удалось сохранить состояние плеера.", error);
    }
  }

  function renderPlayer() {
    syncTrackPlaybackControls();
    if (!player || !playerState) return;
    const track = tracksById.get(playerState.trackId);
    if (!track) return;

    player.hidden = !playerState.visible;
    player.setAttribute("aria-hidden", String(!playerState.visible));
    document.body.classList.toggle("has-player", playerState.visible);
    document.body.classList.toggle("player-playing", playerState.isPlaying);
    if (playerState.visible && !renderedPlayerVisible) {
      player.classList.remove("is-entering");
      void player.offsetWidth;
      player.classList.add("is-entering");
    } else if (!playerState.visible) {
      player.classList.remove("is-entering");
    }
    renderedPlayerVisible = playerState.visible;
    playerElements.title.textContent = track.displayTitle;
    playerElements.artist.textContent = track.artist;
    playerElements.status.textContent = track.audioUrl
      ? "Воспроизводится"
      : "Демо · аудио не подключено";
    playerElements.glyph.textContent = track.artworkGlyph;
    playerElements.artwork.className = `player-artwork ${track.artworkClass}`;
    const colors = track.artworkColors || ["#248c9f", "#41569c", "#173f51"];
    player.style.setProperty("--player-color-one", colors[0]);
    player.style.setProperty("--player-color-two", colors[1]);
    player.style.setProperty("--player-color-three", colors[2]);
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
    playerElements.toggleButton.classList.toggle(
      "is-playing",
      playerState.isPlaying,
    );
    playerElements.toggleButton.setAttribute(
      "aria-label",
      playerState.isPlaying ? "Пауза" : "Продолжить",
    );
    playerElements.toggleButton.title = playerState.isPlaying
      ? "Пауза"
      : "Продолжить";
  }

  function animateVolume() {
    if (!playerAudio || !playerState) {
      volumeAnimationFrame = 0;
      return;
    }
    const difference = playerState.volume - playerAudio.volume;
    if (Math.abs(difference) < 0.004) {
      playerAudio.volume = playerState.volume;
      volumeAnimationFrame = 0;
      return;
    }
    playerAudio.volume += difference * 0.1;
    volumeAnimationFrame = window.requestAnimationFrame(animateVolume);
  }

  function persistAndRender() {
    if (!playerState) return;
    renderPlayer();
    savePlayerState();
  }

  function queueFromCurrentPage(sourceButton) {
    const queueContainer = sourceButton?.closest("[data-player-queue]");
    const visibleTrackIds = Array.from(
      queueContainer
        ? queueContainer.querySelectorAll("[data-track-id]")
        : document.querySelectorAll(
            ".track-row[data-track-id], .catalog-track[data-track-id]",
          ),
    )
      .map((card) => card.dataset.trackId)
      .filter((id) => tracksById.has(id));
    return Array.from(new Set(visibleTrackIds));
  }

  function startTrack(trackId, queue = queueFromCurrentPage()) {
    const track = tracksById.get(trackId);
    if (!track) {
      notify("Не удалось загрузить данные этого трека.");
      return;
    }

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
    startTrack(playerState.queue[nextIndex], playerState.queue);
  }

  function togglePlayback() {
    if (!playerState) return;
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
          persistAndRender();
        });
      }
    }
    lastPlayerTick = Date.now();
    persistAndRender();
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
      if (trackId === playerState?.trackId) togglePlayback();
      else if (trackId) startTrack(trackId, queueFromCurrentPage(playButton));
    }

    const action = event.target.closest("[data-player-action]")?.dataset
      .playerAction;
    if (!action || !playerState) return;
    if (action === "toggle") {
      togglePlayback();
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
    playerElements.volume.style.setProperty(
      "--player-volume",
      `${playerState.volume * 100}%`,
    );
    if (!volumeAnimationFrame) {
      volumeAnimationFrame = window.requestAnimationFrame(animateVolume);
    }
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

  function readFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(favoritesStorageKey) || "[]");
      if (!Array.isArray(stored)) {
        console.warn("В хранилище избранного ожидался список идентификаторов треков.");
        return [];
      }
      const validIds = stored.filter(
        (id) => typeof id === "string" && tracksById.has(id),
      );
      if (validIds.length !== stored.length) {
        console.warn("Некоторые записи избранного больше не соответствуют каталогу треков.");
      }
      return [...new Set(validIds)];
    } catch (error) {
      console.warn("Не удалось прочитать избранное.", error);
      return [];
    }
  }

  function readProfile() {
    const defaults = {
      displayName: "Аки",
      bio: "Музыка всегда рядом, трек за треком.",
    };
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
      if (!saved || typeof saved !== "object") return defaults;
      return {
        displayName:
          typeof saved.displayName === "string" && saved.displayName.trim()
            ? saved.displayName.trim().slice(0, 32)
            : defaults.displayName,
        bio: typeof saved.bio === "string" ? saved.bio.trim().slice(0, 120) : defaults.bio,
      };
    } catch (error) {
      console.warn("Не удалось прочитать профиль.", error);
      return defaults;
    }
  }

  function readPlaylists() {
    try {
      const saved = JSON.parse(localStorage.getItem(playlistsStorageKey) || "null");
      if (saved === null) {
        return Array.from(
          document.querySelectorAll("[data-playlist-item]"),
          (card) => ({
            id: card.dataset.playlistId,
            title: card.dataset.playlistTitle,
            description: card.dataset.playlistDescription || "",
            label: card.dataset.playlistLabel || "MY MIX",
            artworkClass: card.classList.contains("playlist-card-custom")
              ? "playlist-card-custom"
              : Array.from(card.classList).find((name) => name.startsWith("playlist-card-")) || "playlist-card-custom",
            trackIds: (card.dataset.playlistTrackIds || "")
              .split(",")
              .filter((id) => tracksById.has(id)),
            isPublic: card.dataset.playlistPublic === "true",
          }),
        );
      }
      if (!Array.isArray(saved)) {
        console.warn("В хранилище плейлистов ожидался список.");
        return [];
      }
      return saved
        .filter(
          (playlist) =>
            playlist &&
            typeof playlist.id === "string" &&
            typeof playlist.title === "string" &&
            playlist.title.trim(),
        )
        .map((playlist) => ({
          id: playlist.id.slice(0, 80),
          title: playlist.title.trim().slice(0, 48),
          description:
            typeof playlist.description === "string"
              ? playlist.description.slice(0, 180)
              : "",
          label:
            typeof playlist.label === "string" ? playlist.label.slice(0, 20) : "MY MIX",
          artworkClass:
            typeof playlist.artworkClass === "string" &&
            /^playlist-card-(night|repeat|morning|drive|new|custom)$/.test(
              playlist.artworkClass,
            )
              ? playlist.artworkClass
              : "playlist-card-custom",
          trackIds: Array.isArray(playlist.trackIds)
            ? [...new Set(playlist.trackIds.filter((id) => tracksById.has(id)))]
            : [],
          isPublic: playlist.isPublic === true,
        }));
    } catch (error) {
      console.warn("Не удалось прочитать плейлисты.", error);
      return [];
    }
  }

  let profileState = readProfile();
  let playlists = readPlaylists();
  let activePlaylistId = null;
  const profileFavoriteCards = new Map(
    Array.from(document.querySelectorAll("[data-profile-favorite]"), (card) => [
      card.dataset.profileFavorite,
      card,
    ]),
  );

  let favoriteIds = readFavorites();
  const pluralCount = (count, one, few, many) => {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return `${count} ${many}`;
    if (last === 1) return `${count} ${one}`;
    if (last >= 2 && last <= 4) return `${count} ${few}`;
    return `${count} ${many}`;
  };

  function renderProfile() {
    const nameElement = document.querySelector("[data-profile-name]");
    const bioElement = document.querySelector("[data-profile-bio]");
    const avatarElement = document.querySelector("[data-profile-avatar]");
    if (nameElement) nameElement.textContent = profileState.displayName;
    if (bioElement) bioElement.textContent = profileState.bio || "Музыка всегда рядом.";
    if (avatarElement) {
      avatarElement.textContent = Array.from(profileState.displayName)[0] || "А";
    }

    const favoriteTracks = favoriteIds
      .map((id) => tracksById.get(id))
      .filter(Boolean);
    const genreCounts = new Map();
    const artistCounts = new Map();
    favoriteTracks.forEach((track) => {
      genreCounts.set(track.genre, (genreCounts.get(track.genre) || 0) + 1);
      const artist = track.artistName || track.artist;
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    });
    const stats = {
      favorites: favoriteIds.length,
      playlists: playlists.length,
      genres: genreCounts.size,
      catalog: trackCatalog.length,
    };
    Object.entries(stats).forEach(([key, value]) => {
      const element = document.querySelector(`[data-profile-stat="${key}"]`);
      if (element) element.textContent = String(value);
    });

    const genreList = document.querySelector("[data-profile-genres]");
    if (genreList) {
      genreList.replaceChildren();
      const genres = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]);
      if (!genres.length) {
        const empty = document.createElement("p");
        empty.className = "profile-empty-note";
        empty.textContent = "Добавляй треки в избранное, чтобы увидеть свои жанры.";
        genreList.append(empty);
      }
      genres.slice(0, 4).forEach(([genre, count]) => {
        const percent = Math.round((count / favoriteTracks.length) * 100);
        const meter = document.createElement("div");
        meter.className = "genre-meter";
        const label = document.createElement("span");
        label.textContent = genre;
        const bar = document.createElement("i");
        const fill = document.createElement("b");
        fill.style.setProperty("--meter", `${percent}%`);
        bar.append(fill);
        const value = document.createElement("strong");
        value.textContent = `${percent}%`;
        meter.append(label, bar, value);
        genreList.append(meter);
      });
    }

    const artistList = document.querySelector("[data-profile-artists]");
    if (artistList) {
      artistList.replaceChildren();
      const artists = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1]);
      if (!artists.length) {
        const empty = document.createElement("p");
        empty.className = "profile-empty-note";
        empty.textContent = "Здесь появятся исполнители из твоего избранного.";
        artistList.append(empty);
      }
      artists.slice(0, 4).forEach(([artist, count], index) => {
        const link = document.createElement("a");
        link.href = "/artists";
        const dot = document.createElement("span");
        dot.className = `profile-artist-dot profile-artist-dot-${index % 4}`;
        dot.textContent = Array.from(artist)[0] || "♪";
        const name = document.createElement("strong");
        name.textContent = artist;
        const percent = document.createElement("b");
        percent.textContent = `${Math.round((count / favoriteTracks.length) * 100)}%`;
        link.append(dot, name, percent);
        artistList.append(link);
      });
    }

    profileFavoriteCards.forEach((card) => {
      card.hidden = true;
    });
    favoriteIds
      .slice()
      .reverse()
      .slice(0, 4)
      .forEach((id) => {
        const card = profileFavoriteCards.get(id);
        if (!card) return;
        card.hidden = false;
        card.parentElement.append(card);
      });
  }

  function savePlaylists() {
    try {
      localStorage.setItem(playlistsStorageKey, JSON.stringify(playlists));
      return true;
    } catch (error) {
      console.warn("Не удалось сохранить плейлисты.", error);
      notify("Не удалось сохранить плейлист в этом браузере.");
      return false;
    }
  }

  function createPlaylistTrackRow(track) {
    const row = document.createElement("article");
    row.className = "track-card track-row";
    row.dataset.trackId = track.id;
    row.dataset.favoriteItem = track.id;
    row.dataset.genreItem = "";
    row.dataset.genre = track.filterGenre || "all";
    row.dataset.searchText =
      `${track.displayTitle} ${track.title} ${track.artist} ${track.genre}`.toLocaleLowerCase("ru");
    row.dataset.trackSlug = track.id;
    row.dataset.trackTitle = track.displayTitle;
    row.dataset.trackOriginalTitle = track.title;
    row.dataset.trackArtist = track.artist;
    row.dataset.trackDuration = String(track.duration);
    row.dataset.trackGenre = track.genre;
    row.dataset.trackArtwork = track.artworkClass;
    row.dataset.trackGlyph = track.artworkGlyph;
    row.dataset.trackAudio = track.audioUrl || "";

    const cover = document.createElement("a");
    cover.className = `mini-cover ${track.artworkClass}`;
    cover.href = `/track/${track.id}`;
    cover.setAttribute("aria-label", `Подробнее о треке ${track.displayTitle}`);
    const glyph = document.createElement("span");
    glyph.textContent = track.artworkGlyph;
    const indicator = document.createElement("span");
    indicator.className = "track-playing-indicator";
    indicator.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 5; index += 1) {
      indicator.append(document.createElement("i"));
    }
    cover.append(glyph, indicator);

    const info = document.createElement("div");
    info.className = "track-row-info";
    const heading = document.createElement("h3");
    const titleLink = document.createElement("a");
    titleLink.href = `/track/${track.id}`;
    titleLink.textContent = track.displayTitle;
    heading.append(titleLink);
    const artist = document.createElement("p");
    artist.textContent = track.artist;
    info.append(heading, artist);

    const genre = document.createElement("span");
    genre.className = "track-row-tag";
    genre.textContent = track.genre;
    const duration = document.createElement("span");
    duration.className = "track-row-duration";
    duration.textContent = formatTime(track.duration);

    const play = document.createElement("button");
    play.className = "play-button";
    play.type = "button";
    play.dataset.playerPlay = "";
    play.setAttribute("aria-label", `Воспроизвести ${track.displayTitle}`);
    play.setAttribute("aria-pressed", "false");
    play.innerHTML = '<span class="track-play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path data-toggle-play d="M8.2 5.8a1 1 0 0 1 1.5-.86l9.1 6.2a1.03 1.03 0 0 1 0 1.72l-9.1 6.2a1 1 0 0 1-1.5-.86z"/><g data-toggle-pause><rect x="6.5" y="5" width="4.5" height="14" rx="1.4"/><rect x="13" y="5" width="4.5" height="14" rx="1.4"/></g></svg></span>';
    const favorite = document.createElement("button");
    favorite.className = "like-button";
    favorite.type = "button";
    favorite.dataset.favoriteTrack = track.id;
    favorite.setAttribute("aria-label", `Добавить ${track.displayTitle} в избранное`);
    favorite.setAttribute("aria-pressed", "false");
    favorite.textContent = "♡";
    row.append(cover, info, genre, duration, play, favorite);
    return row;
  }

  function renderPlaylistDetail(playlistId) {
    const detail = document.querySelector("[data-playlist-detail]");
    if (!detail) return;
    const content = detail.closest(".directory-content");
    const playlist = playlists.find((item) => item.id === playlistId);
    const isOpen = Boolean(playlist);
    detail.hidden = !isOpen;
    content?.classList.toggle("artist-detail-content", isOpen);
    const heading = document.querySelector("[data-playlist-heading]");
    if (heading) heading.hidden = isOpen;
    document.querySelectorAll("[data-playlist-listing]").forEach((section) => {
      section.hidden = isOpen;
    });
    if (!playlist) {
      activePlaylistId = null;
      return;
    }

    activePlaylistId = playlist.id;
    const hero = detail.querySelector("[data-playlist-detail-hero]");
    hero.className = `artist-detail-hero playlist-detail-hero ${playlist.artworkClass}`;
    detail.querySelector("[data-playlist-detail-label]").textContent =
      `${playlist.isPublic ? "ОТКРЫТЫЙ" : "ЛИЧНЫЙ"} ПЛЕЙЛИСТ · ${playlist.label}`;
    detail.querySelector("[data-playlist-detail-glyph]").textContent =
      playlist.label === "FAVORITES" ? "♡" : "♫";
    detail.querySelector("[data-playlist-detail-title]").textContent = playlist.title;
    detail.querySelector("[data-playlist-detail-description]").textContent =
      playlist.description;
    const trackCount = pluralCount(
      playlist.trackIds.length,
      "трек",
      "трека",
      "треков",
    );
    detail.querySelector("[data-playlist-detail-count]").textContent =
      `${trackCount} в твоей библиотеке`;
    detail.querySelector("[data-playlist-track-count]").textContent = trackCount;
    const list = detail.querySelector("[data-playlist-detail-tracks]");
    const tracks = playlist.trackIds
      .map((id) => tracksById.get(id))
      .filter(Boolean);
    list.replaceChildren(...tracks.map(createPlaylistTrackRow));
    const emptyState = detail.querySelector("[data-playlist-detail-empty]");
    if (emptyState) emptyState.hidden = tracks.length > 0;
    syncTrackPlaybackControls();
    renderFavorites();
  }

  function openPlaylist(playlistId, updateHistory = false) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      notify("Этот плейлист не найден.");
      return;
    }
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("playlist", playlist.id);
      window.history.pushState({}, "", url);
    }
    renderPlaylistDetail(playlist.id);
  }

  function closePlaylist(updateHistory = false) {
    activePlaylistId = null;
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.delete("playlist");
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    renderPlaylistDetail(null);
  }

  function syncPlaylistFromLocation() {
    const playlistId = new URL(window.location.href).searchParams.get("playlist");
    if (playlistId) openPlaylist(playlistId);
    else closePlaylist();
  }

  function renderPlaylists() {
    const list = document.querySelector("[data-playlist-list]");
    if (list) {
      list.replaceChildren();
      playlists.forEach((playlist) => {
        const card = document.createElement("article");
        card.className = `playlist-card ${playlist.artworkClass}`;
        card.dataset.playlistItem = "";
        card.dataset.playlistId = playlist.id;
        const art = document.createElement("div");
        art.className = "playlist-art";
        const bars = document.createElement("span");
        bars.className = "playlist-bars";
        for (let index = 0; index < 5; index += 1) bars.append(document.createElement("i"));
        const label = document.createElement("strong");
        label.textContent = playlist.label || "MY MIX";
        art.append(bars, label);
        const link = document.createElement("a");
        link.className = "playlist-card-link";
        link.href = `/playlists?playlist=${encodeURIComponent(playlist.id)}`;
        link.dataset.playlistOpen = playlist.id;
        link.append(art);
        const info = document.createElement("div");
        info.className = "playlist-card-info";
        const title = document.createElement("h3");
        title.textContent = playlist.title;
        const description = document.createElement("p");
        description.textContent = `${pluralCount(playlist.trackIds.length, "трек", "трека", "треков")} · ${playlist.isPublic ? "публичный" : "личный"}`;
        const details = document.createElement("small");
        details.textContent = playlist.description;
        info.append(title, description);
        if (playlist.description) info.append(details);
        const arrow = document.createElement("span");
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↗";
        info.append(arrow);
        link.append(info);
        const actions = document.createElement("div");
        actions.className = "playlist-card-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.dataset.playlistEdit = playlist.id;
        edit.textContent = "Изменить";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.playlistDelete = playlist.id;
        remove.textContent = "Удалить";
        actions.append(edit, remove);
        card.dataset.playlistTitle = playlist.title;
        card.dataset.playlistDescription = playlist.description;
        card.dataset.playlistLabel = playlist.label;
        card.dataset.playlistTrackIds = playlist.trackIds.join(",");
        card.dataset.playlistPublic = String(playlist.isPublic);
        card.append(link, actions);
        list.append(card);
      });
      const counter = document.querySelector("[data-playlist-count]");
      if (counter) counter.textContent = pluralCount(playlists.length, "плейлист", "плейлиста", "плейлистов");
    }
    const recentAddButtons = document.querySelectorAll("[data-playlist-add]");
    recentAddButtons.forEach((button) => {
      const track = tracksById.get(button.dataset.playlistAdd);
      const isAdded = Boolean(
        playlists[0]?.trackIds.includes(button.dataset.playlistAdd),
      );
      button.classList.toggle("is-added", isAdded);
      button.textContent = isAdded ? "✓" : "＋";
      if (track) {
        button.setAttribute(
          "aria-label",
          `${isAdded ? "Убрать" : "Добавить"} ${track.displayTitle} ${isAdded ? "из" : "в"} плейлист`,
        );
      }
    });
    const favoriteCount = document.querySelector("[data-favorite-count]");
    if (favoriteCount) {
      favoriteCount.textContent = pluralCount(favoriteIds.length, "трек", "трека", "треков");
    }
    if (activePlaylistId && !playlists.some((playlist) => playlist.id === activePlaylistId)) {
      activePlaylistId = null;
    }
    renderPlaylistDetail(activePlaylistId);
    renderProfile();
  }

  function renderTaste() {
    const card = document.querySelector("[data-taste-card]");
    if (!card || !trackCatalog.length) return;

    const source = favoriteIds.length
      ? trackCatalog.filter((track) => favoriteIds.includes(track.id))
      : trackCatalog;
    if (!source.length) return;

    const genreCounts = new Map();
    source.forEach((track) => {
      if (!track.genre) return;
      genreCounts.set(track.genre, (genreCounts.get(track.genre) || 0) + 1);
    });
    if (!genreCounts.size) return;

    const [genre, count] = Array.from(genreCounts.entries()).sort(
      (first, second) =>
        second[1] - first[1] || first[0].localeCompare(second[0], "ru"),
    )[0];
    const percent = Math.round((count / source.length) * 100);
    const sample = source.find((track) => track.genre === genre);
    const genreFilter = sample?.filterGenre || "all";

    const setText = (selector, value) => {
      const element = card.querySelector(selector);
      if (element) element.textContent = value;
    };

    setText("[data-taste-genre]", genre);
    setText("[data-taste-genre-label]", genre);
    setText("[data-taste-percent]", `${percent}%`);
    setText("[data-taste-count]", String(count));
    setText(
      "[data-taste-description]",
      favoriteIds.length ? "Твой выбор в этом сезоне" : "Тебе особенно близко",
    );

    const meter = card.querySelector("[data-taste-meter]");
    if (meter) meter.style.setProperty("--level", `${percent}%`);

    const link = card.querySelector("[data-taste-link]");
    if (link) link.href = `/catalog?genre=${encodeURIComponent(genreFilter)}`;

    card.dataset.personal = favoriteIds.length ? "true" : "false";
  }

  function renderFavorites() {
    document.querySelectorAll("[data-favorite-track]").forEach((button) => {
      const liked = favoriteIds.includes(button.dataset.favoriteTrack);
      button.classList.toggle("liked", liked);
      button.textContent = liked ? "♥" : "♡";
      button.setAttribute("aria-pressed", String(liked));
      button.setAttribute(
        "aria-label",
        `${liked ? "Удалить" : "Добавить"} ${tracksById.get(button.dataset.favoriteTrack)?.displayTitle || "трек"} ${liked ? "из избранного" : "в избранное"}`,
      );
    });
    document.querySelectorAll("[data-favorites-list] [data-favorite-item]").forEach((item) => {
      item.hidden = !favoriteIds.includes(item.dataset.favoriteItem);
    });
    const count = document.querySelector("[data-favorite-count]");
    if (count) {
      const value = favoriteIds.length;
      const lastTwoDigits = value % 100;
      const lastDigit = value % 10;
      const word =
        lastTwoDigits >= 11 && lastTwoDigits <= 14
          ? "треков"
          : lastDigit === 1
            ? "трек"
            : lastDigit >= 2 && lastDigit <= 4
              ? "трека"
              : "треков";
      count.textContent = `${value} ${word}`;
    }
    const emptyState = document.querySelector("[data-favorites-empty]");
    if (emptyState) emptyState.hidden = favoriteIds.length > 0;
    renderProfile();
    renderTaste();
  }

  document.querySelectorAll("[data-favorite-track]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.favoriteTrack;
      favoriteIds = favoriteIds.includes(id)
        ? favoriteIds.filter((favoriteId) => favoriteId !== id)
        : [...favoriteIds, id];
      try {
        localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteIds));
      } catch (error) {
        console.warn("Не удалось сохранить избранное.", error);
        notify("Не удалось сохранить избранное в этом браузере.");
        favoriteIds = readFavorites();
        renderFavorites();
        return;
      }
      renderFavorites();
      notify(favoriteIds.includes(id) ? "Добавлено в избранное" : "Удалено из избранного");
    });
  });
  renderFavorites();
  renderPlaylists();
  syncPlaylistFromLocation();
  window.addEventListener("storage", (event) => {
    if (event.key === favoritesStorageKey) {
      favoriteIds = readFavorites();
      renderFavorites();
      renderPlaylists();
    } else if (event.key === playlistsStorageKey) {
      playlists = readPlaylists();
      renderPlaylists();
    } else if (event.key === profileStorageKey) {
      profileState = readProfile();
      renderProfile();
    } else if (event.key === playerStorageKey) {
      playerState = readPlayerState();
      renderPlayer();
    }
  });

  document.addEventListener("click", (event) => {
    const openLink = event.target.closest("[data-playlist-open]");
    if (openLink) {
      event.preventDefault();
      openPlaylist(openLink.dataset.playlistOpen, true);
      return;
    }

    const closeButton = event.target.closest("[data-playlist-close]");
    if (closeButton) {
      closePlaylist(true);
      return;
    }

    const recentAdd = event.target.closest("[data-playlist-add]");
    if (recentAdd) {
      const trackId = recentAdd.dataset.playlistAdd;
      const track = tracksById.get(trackId);
      const playlist = playlists[0];
      if (!track || !playlist) {
        notify("Сначала создай плейлист, чтобы добавлять в него треки.");
        return;
      }
      const hasTrack = playlist.trackIds.includes(trackId);
      playlists = playlists.map((item) =>
        item.id === playlist.id
          ? {
              ...item,
              trackIds: hasTrack
                ? item.trackIds.filter((id) => id !== trackId)
                : [...item.trackIds, trackId],
            }
          : item,
      );
      if (savePlaylists()) {
        renderPlaylists();
        notify(
          hasTrack
            ? `«${track.displayTitle}» удалён из «${playlist.title}»`
            : `«${track.displayTitle}» добавлен в «${playlist.title}»`,
        );
      } else {
        playlists = readPlaylists();
        renderPlaylists();
      }
      return;
    }

    const editButton = event.target.closest("[data-playlist-edit]");
    if (editButton) {
      const playlist = playlists.find((item) => item.id === editButton.dataset.playlistEdit);
      if (!playlist) {
        notify("Не удалось найти этот плейлист.");
        return;
      }
      window.location.assign(`/create-playlist?edit=${encodeURIComponent(playlist.id)}`);
      return;
    }

    const deleteButton = event.target.closest("[data-playlist-delete]");
    if (!deleteButton) return;
    const playlist = playlists.find((item) => item.id === deleteButton.dataset.playlistDelete);
    if (!playlist || !window.confirm(`Удалить плейлист «${playlist.title}»?`)) return;
    const previousPlaylists = playlists;
    playlists = playlists.filter((item) => item.id !== playlist.id);
    if (savePlaylists()) {
      renderPlaylists();
      notify(`Плейлист «${playlist.title}» удалён`);
    } else {
      playlists = previousPlaylists;
      renderPlaylists();
    }
  });
  window.addEventListener("popstate", syncPlaylistFromLocation);

  const genreButtons = document.querySelectorAll(".genre-chip");
  const genreItems = document.querySelectorAll(
    "[data-genre-item], .track-row[data-genre]",
  );
  const pageSearch = document.getElementById("page-search");
  const initialGenre =
    new URLSearchParams(window.location.search).get("genre") || "all";
  let selectedGenre = initialGenre;

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
  if (initialGenre !== "all") {
    const matchingButton = Array.from(genreButtons).find(
      (button) => button.dataset.filter === initialGenre,
    );
    if (matchingButton) {
      genreButtons.forEach((button) => {
        const selected = button === matchingButton;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      const filters = document.getElementById("catalog-genres");
      if (filters) filters.hidden = false;
      document
        .querySelector("[data-filter-toggle]")
        ?.setAttribute("aria-expanded", "true");
    } else {
      selectedGenre = "all";
    }
  }
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
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute(
        "aria-label",
        expanded ? "Скрыть фильтры" : "Показать фильтры",
      );
      button.classList.toggle("is-active", expanded);
      if (panel) {
        panel.hidden = !expanded;
        panel.classList.toggle("filters-open", expanded);
      }
    });
  });

  document
    .querySelector("[data-load-more]")
    ?.addEventListener("click", (event) => {
      event.currentTarget.hidden = true;
      notify("Показаны все исполнители каталога");
    });

  const selectedTrackIds = new Set();
  const selectedCount = document.querySelector("[data-selected-count]");
  const availableTracks = document.querySelector("[data-available-tracks]");
  const selectedTrackList = document.querySelector("[data-selected-track-list]");
  const selectedTracksEmpty = document.querySelector("[data-selected-empty]");
  const playlistForm = document.querySelector("[data-playlist-form]");
  const editPlaylistId = new URLSearchParams(window.location.search).get("edit");
  const editingPlaylist = editPlaylistId
    ? playlists.find((playlist) => playlist.id === editPlaylistId)
    : null;

  function updateSelectedTracks() {
    if (selectedCount) selectedCount.textContent = `${selectedTrackIds.size} выбрано`;
    if (selectedTracksEmpty) selectedTracksEmpty.hidden = selectedTrackIds.size > 0;
  }

  function movePlaylistTrack(trackId, isSelected, animate = true) {
    const trackRow = playlistForm?.querySelector(
      `[data-track-id="${CSS.escape(trackId)}"]`,
    );
    const destination = isSelected ? selectedTrackList : availableTracks;
    const track = tracksById.get(trackId);
    const button = trackRow?.querySelector("[data-add-track]");
    if (!trackRow || !destination || !track || !button) return;

    const start = trackRow.getBoundingClientRect();
    trackRow.classList.toggle("is-added", isSelected);
    button.classList.toggle("is-selected", isSelected);
    button.textContent = isSelected ? "−" : "＋";
    button.setAttribute(
      "aria-label",
      `${isSelected ? "Убрать" : "Добавить"} ${track.displayTitle}`,
    );
    destination.append(trackRow);

    if (!isSelected) {
      Array.from(destination.children)
        .sort(
          (first, second) =>
            Number(first.dataset.trackOrder) - Number(second.dataset.trackOrder),
        )
        .forEach((row) => destination.append(row));
    } else {
      destination.scrollTop = destination.scrollHeight;
    }

    const end = trackRow.getBoundingClientRect();
    const deltaX = start.left - end.left;
    const deltaY = start.top - end.top;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (
      animate &&
      !reduceMotion &&
      typeof trackRow.animate === "function" &&
      (deltaX || deltaY)
    ) {
      trackRow.classList.add("is-moving");
      const animation = trackRow.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px)`,
            opacity: 0.72,
          },
          { transform: "translate(0, 0)", opacity: 1 },
        ],
        { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      const clearMovingState = () => trackRow.classList.remove("is-moving");
      animation.onfinish = clearMovingState;
      animation.oncancel = clearMovingState;
    }
  }

  if (playlistForm && editPlaylistId) {
    const message = document.querySelector("[data-playlist-message]");
    if (!editingPlaylist) {
      if (message) {
        message.textContent = "Этот плейлист не найден. Вернись в библиотеку и попробуй ещё раз.";
        message.classList.add("is-visible");
      }
      playlistForm.querySelectorAll("input, textarea, button[type=submit], [data-add-track]").forEach((control) => {
        control.disabled = true;
      });
    } else {
      playlistForm.elements.title.value = editingPlaylist.title;
      playlistForm.elements.description.value = editingPlaylist.description;
      playlistForm.elements.public.checked = editingPlaylist.isPublic;
      document.querySelector("[data-playlist-form-title]").textContent = "Изменить плейлист";
      document.querySelector("[data-playlist-submit-label]").textContent = "Сохранить изменения";
      document.querySelector(".add-tracks-panel .editor-panel-heading h2").textContent = "Треки плейлиста";

      editingPlaylist.trackIds.forEach((trackId) => {
        if (!tracksById.has(trackId)) return;
        selectedTrackIds.add(trackId);
        movePlaylistTrack(trackId, true, false);
      });
      updateSelectedTracks();
    }
  }

  document.querySelectorAll("[data-add-track]").forEach((button) => {
    button.addEventListener("click", () => {
      const trackId = button.dataset.addTrack;
      const isSelected = selectedTrackIds.has(trackId);
      if (isSelected) selectedTrackIds.delete(trackId);
      else selectedTrackIds.add(trackId);
      movePlaylistTrack(trackId, !isSelected);
      updateSelectedTracks();
    });
  });

  const trackSearch = document.querySelector("[data-track-search]");
  trackSearch?.addEventListener("input", () => {
    const query = trackSearch.value.trim().toLocaleLowerCase("ru");
    availableTracks?.querySelectorAll(".available-track").forEach((track) => {
      track.hidden = !track.dataset.trackName.toLocaleLowerCase("ru").includes(query);
    });
  });

  playlistForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const title = form.elements.title.value.trim();
      const message = document.querySelector("[data-playlist-message]");
      if (!message) return;
      if (!selectedTrackIds.size) {
        message.textContent = "Добавь хотя бы один трек в плейлист.";
        message.classList.add("is-visible");
        return;
      }

      if (!title) {
        message.textContent = "Укажи название плейлиста.";
        message.classList.add("is-visible");
        return;
      }
      const previousPlaylists = playlists;
      const nextPlaylist = {
        ...(editingPlaylist || {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label: "MY MIX",
          artworkClass: "playlist-card-custom",
        }),
        title: title.slice(0, 48),
        description: form.elements.description.value.trim().slice(0, 180),
        trackIds: Array.from(selectedTrackIds),
        isPublic: form.elements.public.checked,
      };
      playlists = editingPlaylist
        ? playlists.map((playlist) =>
            playlist.id === editingPlaylist.id ? nextPlaylist : playlist,
          )
        : [...playlists, nextPlaylist];
      if (!savePlaylists()) {
        playlists = previousPlaylists;
        message.textContent = "Не удалось сохранить плейлист. Проверь доступное место в хранилище браузера.";
        message.classList.add("is-visible");
        return;
      }
      window.location.assign(
        editingPlaylist
          ? `/playlists?playlist=${encodeURIComponent(editingPlaylist.id)}`
          : "/playlists",
      );
    });

  const profileForm = document.querySelector("[data-profile-form]");
  document.querySelector("[data-profile-edit]")?.addEventListener("click", () => {
    if (!profileForm) return;
    profileForm.elements.displayName.value = profileState.displayName;
    profileForm.elements.bio.value = profileState.bio;
    profileForm.hidden = false;
    profileForm.elements.displayName.focus();
  });
  document.querySelector("[data-profile-cancel]")?.addEventListener("click", () => {
    if (profileForm) profileForm.hidden = true;
  });
  profileForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextProfile = {
      displayName: profileForm.elements.displayName.value.trim().slice(0, 32),
      bio: profileForm.elements.bio.value.trim().slice(0, 120),
    };
    if (!nextProfile.displayName) {
      profileForm.elements.displayName.focus();
      return;
    }
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
      profileState = nextProfile;
      renderProfile();
      profileForm.hidden = true;
      const message = document.querySelector("[data-profile-message]");
      if (message) {
        message.textContent = "Профиль сохранён в этом браузере.";
        message.classList.add("is-visible");
      }
    } catch (error) {
      console.warn("Не удалось сохранить профиль.", error);
      notify("Не удалось сохранить профиль в этом браузере.");
    }
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
    } else if (selectedGenre !== "all") {
      filterDirectory();
    }
  }

  const menuToggle = document.getElementById("menu-toggle");
  menuToggle?.addEventListener("click", () =>
    notify("Мобильное меню: используйте нижнюю навигацию"),
  );

})();
