class AdminValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdminValidationError";
  }
}

function text(value, label, { required = false, min = 0, max = 255 } = {}) {
  const normalized = String(value || "").trim();
  if (required && !normalized) {
    throw new AdminValidationError(`Поле «${label}» обязательно.`);
  }
  if (normalized && normalized.length < min) {
    throw new AdminValidationError(
      `Поле «${label}» должно содержать не менее ${min} символов.`,
    );
  }
  if (normalized.length > max) {
    throw new AdminValidationError(
      `Поле «${label}» не должно превышать ${max} символов.`,
    );
  }
  return normalized;
}

function optionalInteger(value, label, { min, max } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AdminValidationError(`Поле «${label}» должно быть целым числом.`);
  }
  if (min !== undefined && parsed < min) {
    throw new AdminValidationError(`Поле «${label}» должно быть не меньше ${min}.`);
  }
  if (max !== undefined && parsed > max) {
    throw new AdminValidationError(`Поле «${label}» должно быть не больше ${max}.`);
  }
  return parsed;
}

function optionalNumber(value, label, { min, max } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AdminValidationError(`Поле «${label}» должно быть числом.`);
  }
  if (min !== undefined && parsed < min) {
    throw new AdminValidationError(`Поле «${label}» должно быть не меньше ${min}.`);
  }
  if (max !== undefined && parsed > max) {
    throw new AdminValidationError(`Поле «${label}» должно быть не больше ${max}.`);
  }
  return parsed;
}

function knownId(value, label, items) {
  const id = String(value || "").trim();
  if (!id || !items.some((item) => item.id === id)) {
    throw new AdminValidationError(`Выберите существующее значение поля «${label}».`);
  }
  return id;
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function trackIds(value, tracks) {
  const known = new Set(tracks.map((track) => track.id));
  const ids = [...new Set(asArray(value).map(String).map((id) => id.trim()).filter(Boolean))];
  if (ids.length > 200) {
    throw new AdminValidationError("Можно выбрать не более 200 треков.");
  }
  if (ids.some((id) => !known.has(id))) {
    throw new AdminValidationError("Выбран несуществующий трек.");
  }
  return ids;
}

function validateDate(value) {
  const date = text(value, "Дата", { required: true, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AdminValidationError("Дата должна быть указана в формате YYYY-MM-DD.");
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new AdminValidationError("Укажите существующую календарную дату.");
  }
  return date;
}

function validateTrack(body, { artists, styles }) {
  return {
    ...body,
    id: text(body.id, "ID", { max: 80 }),
    title: text(body.title, "Название", { required: true, max: 150 }),
    displayTitle: text(body.displayTitle, "Название для показа", {
      required: true,
      max: 150,
    }),
    artistId: knownId(body.artistId, "Исполнитель", artists),
    duration: optionalInteger(body.duration, "Длительность", {
      min: 0,
      max: 86400,
    }) ?? 0,
    genre: text(body.genre, "Жанр", { max: 100 }),
    rating: String(optionalNumber(body.rating, "Рейтинг", { min: 0, max: 5 }) ?? 0),
    album: text(body.album, "Альбом", { max: 150 }),
    releaseYear: optionalInteger(body.releaseYear, "Год выпуска", {
      min: 1900,
      max: 2100,
    }),
    artworkGlyph: text(body.artworkGlyph, "Глиф", { max: 8 }),
    artworkClass: knownId(body.artworkClass, "Стиль обложки", styles),
    description: text(body.description, "Описание", { max: 2000 }),
  };
}

function validateArtist(body, { styles }) {
  return {
    ...body,
    id: text(body.id, "ID", { max: 80 }),
    name: text(body.name, "Имя", { required: true, max: 150 }),
    alias: text(body.alias, "Алиас", { max: 150 }),
    initials: text(body.initials, "Инициалы", { max: 4 }),
    genreLabel: text(body.genreLabel, "Подпись жанра", { max: 150 }),
    genres: text(body.genres, "Жанры", { max: 500 }),
    listenersLabel: text(body.listenersLabel, "Слушатели", { max: 100 }),
    country: text(body.country, "Страна", { max: 100 }),
    cardClass: knownId(body.cardClass, "Стиль карточки", styles),
  };
}

function validateCollection(body, { tracks, styles }) {
  return {
    id: text(body.id, "ID", { max: 80 }),
    title: text(body.title, "Название", { required: true, max: 150 }),
    tagline: text(body.tagline, "Подпись", { max: 100 }),
    description: text(body.description, "Описание", { max: 1000 }),
    cardClass: knownId(body.cardClass, "Стиль карточки", styles),
    featured: body.featured === "on" || body.featured === "1" || body.featured === true,
    trackIds: trackIds(body.trackIds, tracks),
  };
}

function validatePlaylist(body, { tracks, styles }) {
  return {
    id: text(body.id, "ID", { max: 80 }),
    title: text(body.title, "Название", { required: true, max: 150 }),
    label: text(body.label, "Подпись", { max: 100 }),
    description: text(body.description, "Описание", { max: 1000 }),
    artworkClass: knownId(body.artworkClass, "Стиль обложки", styles),
    isPublic: body.isPublic === "on" || body.isPublic === "1" || body.isPublic === true,
    trackIds: trackIds(body.trackIds, tracks),
  };
}

function validateEvent(body, { styles }) {
  const type = String(body.type || "").trim();
  if (!new Set(["online", "offline"]).has(type)) {
    throw new AdminValidationError("Укажите корректный формат события.");
  }
  const time = text(body.time, "Время", { max: 5 });
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new AdminValidationError("Время должно быть указано в формате HH:MM.");
  }
  return {
    id: text(body.id, "ID", { max: 80 }),
    title: text(body.title, "Название", { required: true, max: 180 }),
    type,
    venue: text(body.venue, "Площадка", { max: 180 }),
    location: text(body.location, "Город", { max: 180 }),
    date: validateDate(body.date),
    dateLabel: text(body.dateLabel, "Подпись даты", { max: 100 }),
    day: text(body.day, "День", { max: 2 }),
    month: text(body.month, "Месяц", { max: 30 }),
    time,
    category: text(body.category, "Категория", { max: 100 }),
    artworkClass: knownId(body.artworkClass, "Стиль обложки", styles),
    artworkGlyph: text(body.artworkGlyph, "Глиф", { max: 8 }),
    tag: text(body.tag, "Подпись", { max: 100 }),
    description: text(body.description, "Описание", { max: 2000 }),
  };
}

function validateUser(body) {
  return {
    username: text(body.username, "Логин", { required: true, min: 2, max: 32 }),
    password: text(body.password, "Пароль", { required: true, min: 8, max: 200 }),
    role: body.role === "admin" ? "admin" : "user",
  };
}

module.exports = {
  AdminValidationError,
  validateArtist,
  validateCollection,
  validateEvent,
  validatePlaylist,
  validateTrack,
  validateUser,
  validateTrackIds: trackIds,
};
