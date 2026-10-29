(() => {
  const form = document.querySelector("[data-track-form]");
  if (!form) return;

  const urlInput = form.querySelector("[data-audio-url]");
  const fileInput = form.querySelector("[data-audio-file]");
  const durationInput = form.querySelector("[data-duration-input]");
  const detectButton = form.querySelector("[data-detect-duration]");
  const status = form.querySelector("[data-duration-status]");
  if (!urlInput || !durationInput) return;

  let currentAudio = null;
  let currentObjectUrl = "";
  let requestId = 0;
  let inputTimer = 0;

  function setStatus(text, state = "") {
    if (!status) return;
    status.textContent = text;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  function formatDuration(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function revokeObjectUrl() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = "";
    }
  }

  function stopAudio() {
    if (!currentAudio) return;
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }

  function detectDuration(sourceUrl, label) {
    if (!sourceUrl) {
      setStatus("Укажите ссылку или выберите аудиофайл.", "error");
      return;
    }

    const request = ++requestId;
    stopAudio();
    setStatus("Определяю длительность…", "loading");

    const audio = new Audio();
    currentAudio = audio;
    audio.preload = "metadata";

    const fail = () => {
      if (request !== requestId) return;
      setStatus(
        "Не удалось прочитать длительность. Проверьте файл или укажите секунды вручную.",
        "error",
      );
    };

    audio.addEventListener(
      "loadedmetadata",
      () => {
        if (request !== requestId) return;
        const seconds = Math.round(audio.duration);
        if (!Number.isFinite(seconds) || seconds <= 0) {
          fail();
          return;
        }
        durationInput.value = String(seconds);
        setStatus(
          `${label ? `${label} · ` : ""}${formatDuration(seconds)} (${seconds} сек.)`,
          "ok",
        );
      },
      { once: true },
    );
    audio.addEventListener("error", fail, { once: true });
    audio.src = sourceUrl;
    audio.load();
  }

  function detectFromFile() {
    const file = fileInput?.files?.[0];
    if (!file) return false;
    revokeObjectUrl();
    currentObjectUrl = URL.createObjectURL(file);
    detectDuration(currentObjectUrl, file.name);
    return true;
  }

  function detectFromCurrentSource() {
    if (!detectFromFile()) {
      detectDuration(urlInput.value.trim(), "");
    }
  }

  detectButton?.addEventListener("click", detectFromCurrentSource);
  urlInput.addEventListener("change", () => {
    if (!fileInput?.files?.length) detectDuration(urlInput.value.trim(), "");
  });
  urlInput.addEventListener("input", () => {
    if (fileInput?.files?.length) return;
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(() => {
      detectDuration(urlInput.value.trim(), "");
    }, 800);
  });
  urlInput.addEventListener("paste", () => {
    if (fileInput?.files?.length) return;
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(() => {
      detectDuration(urlInput.value.trim(), "");
    }, 80);
  });
  fileInput?.addEventListener("change", () => {
    if (fileInput.files?.length) {
      detectFromFile();
    } else {
      detectDuration(urlInput.value.trim(), "");
    }
  });
  window.addEventListener("beforeunload", revokeObjectUrl);
})();
