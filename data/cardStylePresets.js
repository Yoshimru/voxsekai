/** Визуальные пресеты для карточек подборок, плейлистов и событий. */
const collectionStyles = [
  {
    id: "collection-mood-new",
    name: "New",
    accent: "#83c5ed",
    backgroundStart: "#21415c",
    backgroundEnd: "#1f5663",
    glyph: "≋",
  },
  {
    id: "collection-mood-road",
    name: "Road",
    accent: "#f3a18a",
    backgroundStart: "#422d52",
    backgroundEnd: "#613a5d",
    glyph: "≋",
  },
  {
    id: "collection-mood-soft",
    name: "Soft",
    accent: "#dda4c2",
    backgroundStart: "#4a303b",
    backgroundEnd: "#56424f",
    glyph: "≋",
  },
  {
    id: "collection-mood-tokyo",
    name: "Tokyo",
    accent: "#80ddc4",
    backgroundStart: "#29315b",
    backgroundEnd: "#34376b",
    glyph: "≋",
  },
];

const playlistStyles = [
  {
    id: "playlist-card-new",
    name: "New",
    accent: "#ee987d",
    backgroundStart: "#54352f",
    backgroundEnd: "#77443a",
    glyph: "☷",
  },
  {
    id: "playlist-card-night",
    name: "Night",
    accent: "#f0a18d",
    backgroundStart: "#422e52",
    backgroundEnd: "#633e5c",
    glyph: "☷",
  },
  {
    id: "playlist-card-repeat",
    name: "Repeat",
    accent: "#91c5ef",
    backgroundStart: "#214259",
    backgroundEnd: "#24526b",
    glyph: "☷",
  },
  {
    id: "playlist-card-morning",
    name: "Morning",
    accent: "#b4a1ef",
    backgroundStart: "#473744",
    backgroundEnd: "#684953",
    glyph: "☷",
  },
  {
    id: "playlist-card-drive",
    name: "Drive",
    accent: "#79e0c5",
    backgroundStart: "#234338",
    backgroundEnd: "#2b6047",
    glyph: "☷",
  },
  {
    id: "playlist-card-custom",
    name: "Custom",
    accent: "#80e8cd",
    backgroundStart: "#203b4a",
    backgroundEnd: "#3d3564",
    glyph: "☷",
  },
];

const eventStyles = [
  {
    id: "event-card-neon",
    name: "Neon",
    accent: "#d586d4",
    backgroundStart: "#492d44",
    backgroundEnd: "#6b3d62",
    glyph: "✦",
  },
  {
    id: "event-card-virtual",
    name: "Virtual",
    accent: "#75d8c6",
    backgroundStart: "#173d43",
    backgroundEnd: "#285c55",
    glyph: "✦",
  },
  {
    id: "event-card-tokyo",
    name: "Tokyo",
    accent: "#e29aa1",
    backgroundStart: "#392b4d",
    backgroundEnd: "#724255",
    glyph: "✦",
  },
  {
    id: "event-card-synth",
    name: "Synth",
    accent: "#83b4da",
    backgroundStart: "#1c3650",
    backgroundEnd: "#35577a",
    glyph: "✦",
  },
  {
    id: "event-card-studio",
    name: "Studio",
    accent: "#e7cc81",
    backgroundStart: "#3b3324",
    backgroundEnd: "#75603a",
    glyph: "✦",
  },
  {
    id: "event-card-radio",
    name: "Radio",
    accent: "#8bd58c",
    backgroundStart: "#203d32",
    backgroundEnd: "#3d6146",
    glyph: "✦",
  },
];

module.exports = { collectionStyles, playlistStyles, eventStyles };
