/** Стартовые стили: используются для заполнения БД и как безопасный fallback. */
const artistStyles = [
  {
    id: "performer-miku",
    name: "Miku",
    accent: "#70e2cb",
    backgroundStart: "#172d39",
    backgroundEnd: "#1c5b5b",
  },
  {
    id: "performer-rin",
    name: "Rin",
    accent: "#e5c170",
    backgroundStart: "#332a20",
    backgroundEnd: "#6b5433",
  },
  {
    id: "performer-luka",
    name: "Luka",
    accent: "#ed9fc3",
    backgroundStart: "#382331",
    backgroundEnd: "#73455b",
  },
  {
    id: "performer-kaito",
    name: "Kaito",
    accent: "#80b8e8",
    backgroundStart: "#17283c",
    backgroundEnd: "#31547a",
  },
  {
    id: "performer-mira",
    name: "Mira",
    accent: "#7e9be8",
    backgroundStart: "#272c5e",
    backgroundEnd: "#46417d",
  },
  {
    id: "performer-meiko",
    name: "Meiko",
    accent: "#ec9364",
    backgroundStart: "#432a25",
    backgroundEnd: "#814739",
  },
  {
    id: "performer-gumi",
    name: "Gumi",
    accent: "#73d797",
    backgroundStart: "#1a3b2c",
    backgroundEnd: "#316241",
  },
  {
    id: "performer-ia",
    name: "IA",
    accent: "#b49aef",
    backgroundStart: "#2d284d",
    backgroundEnd: "#544478",
  },
  {
    id: "performer-teto",
    name: "Teto",
    accent: "#ef829c",
    backgroundStart: "#472535",
    backgroundEnd: "#843f58",
  },
];

const trackStyles = [
  {
    id: "artwork-cyan",
    name: "Cyan",
    colorOne: "#b6fff0",
    colorTwo: "#217c83",
    colorThree: "#182d45",
  },
  {
    id: "artwork-sakura",
    name: "Sakura",
    colorOne: "#ffd8ed",
    colorTwo: "#ba639b",
    colorThree: "#452b55",
  },
  {
    id: "artwork-night",
    name: "Night",
    colorOne: "#94c9ff",
    colorTwo: "#385b8d",
    colorThree: "#161c39",
  },
  {
    id: "artwork-mono",
    name: "Mono",
    colorOne: "#d2d8e5",
    colorTwo: "#606b7a",
    colorThree: "#20242b",
  },
  {
    id: "artwork-peach",
    name: "Peach",
    colorOne: "#ffe1b0",
    colorTwo: "#cb7478",
    colorThree: "#4a3156",
  },
  {
    id: "artwork-violet",
    name: "Violet",
    colorOne: "#ffc1e4",
    colorTwo: "#a34d9c",
    colorThree: "#292449",
  },
  {
    id: "artwork-orange",
    name: "Orange",
    colorOne: "#ffdd9a",
    colorTwo: "#c96342",
    colorThree: "#422a3e",
  },
  {
    id: "artwork-pink",
    name: "Pink",
    colorOne: "#f6c9ff",
    colorTwo: "#7756b8",
    colorThree: "#1c2b49",
  },
];

const fallbackArtistStyle = artistStyles[0];
const fallbackTrackStyle = trackStyles[0];

module.exports = {
  artistStyles,
  trackStyles,
  fallbackArtistStyle,
  fallbackTrackStyle,
};
