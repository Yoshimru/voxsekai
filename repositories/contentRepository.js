const tracks = require("../data/tracks");
const events = require("../data/events");
const artists = require("../data/artists");
const collections = require("../data/collections");
const playlists = require("../data/playlists");

function createContentRepository(seed = { tracks, events, artists, collections, playlists }) {
  function getTracks() {
    const genreKeys = {
      "J-pop": "j-pop",
      Электроника: "electronic",
      Синтвейв: "synthwave",
      Эмбиент: "ambient",
      Рок: "rock",
      Dance: "dance",
    };
    const palettes = {
      "artwork-sakura": ["#b75275", "#6f3a83", "#182a42"],
      "artwork-night": ["#9b4fa1", "#554b9a", "#192b51"],
      "artwork-mono": ["#78878d", "#49515f", "#202735"],
      "artwork-peach": ["#c46e65", "#a64c78", "#3a3056"],
      "artwork-cyan": ["#248c9f", "#41569c", "#173f51"],
      "artwork-violet": ["#7154b4", "#4e3980", "#232c55"],
      "artwork-orange": ["#ce7650", "#a04a72", "#3f2c50"],
      "artwork-pink": ["#c25289", "#7952a6", "#263b5d"],
    };
    return seed.tracks.map((track) => ({
      ...track,
      filterGenre: genreKeys[track.genre] || "all",
      artworkColors: [...(palettes[track.artworkClass] || palettes["artwork-cyan"])],
    }));
  }

  return {
    getTracks,
    getTrackById(id) {
      const track = seed.tracks.find((item) => item.id === id);
      return track ? getTracks().find((item) => item.id === id) : null;
    },
    getEvents() {
      return seed.events.map((event) => ({ ...event }));
    },
    getEventById(id) {
      const event = seed.events.find((item) => item.id === id);
      return event ? { ...event } : null;
    },
    getArtists() {
      return seed.artists.map((artist) => ({
        ...artist,
        genres: [...artist.genres],
        trackIds: [...artist.trackIds],
        searchText: `${artist.name} ${artist.alias} ${artist.genreLabel}`.toLocaleLowerCase("ru"),
      }));
    },
    getCollections() {
      return seed.collections.map((collection) => ({
        ...collection,
        trackIds: [...collection.trackIds],
        trackCount: collection.trackIds.length,
      }));
    },
    getPlaylists() {
      return (seed.playlists || []).map((playlist) => ({
        ...playlist,
        trackIds: [...playlist.trackIds],
        trackCount: playlist.trackIds.length,
      }));
    },
    getPublicPlaylists() {
      return this.getPlaylists().filter((playlist) => playlist.isPublic);
    },
    getPublicPlaylistById(id) {
      const playlist = this.getPublicPlaylists().find((item) => item.id === id);
      return playlist || null;
    },
    getArtistById(id) {
      const artist = seed.artists.find((item) => item.id === id);
      return artist
        ? {
            ...artist,
            genres: [...artist.genres],
            trackIds: [...artist.trackIds],
            searchText: `${artist.name} ${artist.alias} ${artist.genreLabel}`.toLocaleLowerCase("ru"),
          }
        : null;
    },
    getCollectionById(id) {
      const collection = seed.collections.find((item) => item.id === id);
      return collection
        ? {
            ...collection,
            trackIds: [...collection.trackIds],
            trackCount: collection.trackIds.length,
          }
        : null;
    },
  };
}

module.exports = createContentRepository();
module.exports.createContentRepository = createContentRepository;
