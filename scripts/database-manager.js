const fs = require("node:fs");
const path = require("node:path");

function createDatabaseManager(rootDirectory = path.resolve(__dirname, "..")) {
  const paths = {
    active: path.join(rootDirectory, "db", "voxsekai.db"),
    demo: path.join(rootDirectory, "db", "demo", "voxsekai-demo.db"),
    runtime: path.join(rootDirectory, "db", "runtime"),
    backup: path.join(rootDirectory, "db", "runtime", "voxsekai-original.db"),
    state: path.join(rootDirectory, "db", "runtime", "demo-active.json"),
  };

  function removeDatabaseFiles(databasePath) {
    [databasePath, `${databasePath}-wal`, `${databasePath}-shm`].forEach((filePath) =>
      fs.rmSync(filePath, { force: true }),
    );
  }

  function atomicCopy(source, destination) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const temporaryPath = `${destination}.tmp-${process.pid}`;
    const previousPath = `${destination}.previous-${process.pid}`;
    fs.rmSync(temporaryPath, { force: true });
    fs.rmSync(previousPath, { force: true });
    try {
      fs.copyFileSync(source, temporaryPath);
      if (fs.existsSync(destination)) fs.renameSync(destination, previousPath);
      fs.renameSync(temporaryPath, destination);
      fs.rmSync(previousPath, { force: true });
    } catch (error) {
      if (fs.existsSync(previousPath) && !fs.existsSync(destination)) {
        fs.renameSync(previousPath, destination);
      }
      throw error;
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
  }

  function readState() {
    if (!fs.existsSync(paths.state)) return null;
    try {
      const state = JSON.parse(fs.readFileSync(paths.state, "utf8"));
      if (state.version !== 1 || typeof state.originalExisted !== "boolean") {
        throw new Error("неизвестный формат");
      }
      return state;
    } catch (error) {
      throw new Error(`Не удалось прочитать ${paths.state}: ${error.message}`);
    }
  }

  function writeState(state) {
    fs.mkdirSync(paths.runtime, { recursive: true });
    const temporaryPath = `${paths.state}.tmp-${process.pid}`;
    const previousPath = `${paths.state}.previous-${process.pid}`;
    fs.rmSync(temporaryPath, { force: true });
    fs.rmSync(previousPath, { force: true });
    try {
      fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      if (fs.existsSync(paths.state)) fs.renameSync(paths.state, previousPath);
      fs.renameSync(temporaryPath, paths.state);
      fs.rmSync(previousPath, { force: true });
    } catch (error) {
      if (fs.existsSync(previousPath) && !fs.existsSync(paths.state)) {
        fs.renameSync(previousPath, paths.state);
      }
      throw error;
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
  }

  function checkpointActiveDatabase() {
    if (!fs.existsSync(paths.active)) return;
    let Database;
    try {
      Database = require("better-sqlite3");
    } catch {
      throw new Error(
        "Для безопасного резервного копирования сначала установите зависимости: npm ci",
      );
    }

    let db;
    try {
      db = new Database(paths.active);
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (error) {
      throw new Error(`Не удалось подготовить оригинальную базу: ${error.message}`);
    } finally {
      if (db) db.close();
    }
  }

  function useDemo() {
    if (!fs.existsSync(paths.demo)) {
      throw new Error(`Шаблон демонстрационной базы не найден: ${paths.demo}`);
    }

    const currentState = readState();
    if (currentState) {
      removeDatabaseFiles(paths.active);
      atomicCopy(paths.demo, paths.active);
      return "Демонстрационная база сброшена до исходного состояния.";
    }
    if (fs.existsSync(paths.backup)) {
      throw new Error(
        `Найдена резервная копия без маркера режима: ${paths.backup}. ` +
          "Не перезаписывайте её; восстановите файл вручную.",
      );
    }

    checkpointActiveDatabase();
    const originalExisted = fs.existsSync(paths.active);
    if (originalExisted) atomicCopy(paths.active, paths.backup);

    // Маркер создаётся до замены: даже при аварии оригинал уже сохранён,
    // а команда восстановления сможет вернуть его на место.
    writeState({
      version: 1,
      originalExisted,
      activatedAt: new Date().toISOString(),
    });
    removeDatabaseFiles(paths.active);
    atomicCopy(paths.demo, paths.active);
    return originalExisted
      ? "Демонстрационная база установлена. Оригинал сохранён отдельно."
      : "Демонстрационная база установлена. До переключения оригинальной базы не было.";
  }

  function restoreOriginal() {
    const state = readState();
    if (!state) return "Демонстрационная база не активна; восстановление не требуется.";

    if (state.originalExisted && !fs.existsSync(paths.backup)) {
      throw new Error(`Резервная копия оригинальной базы не найдена: ${paths.backup}`);
    }

    removeDatabaseFiles(paths.active);
    if (state.originalExisted) {
      atomicCopy(paths.backup, paths.active);
      fs.rmSync(paths.backup, { force: true });
    }
    fs.rmSync(paths.state, { force: true });
    return state.originalExisted
      ? "Оригинальная база восстановлена."
      : "Демонстрационная база удалена. При запуске будет создана чистая база.";
  }

  function clearOriginal() {
    const state = readState();
    if (state) {
      if (state.originalExisted && !fs.existsSync(paths.backup)) {
        throw new Error(`Резервная копия оригинальной базы не найдена: ${paths.backup}`);
      }
      writeState({ ...state, originalExisted: false, clearedAt: new Date().toISOString() });
      fs.rmSync(paths.backup, { force: true });
      return "Оригинальная база очищена. Активная демонстрационная база не изменена.";
    }
    if (fs.existsSync(paths.backup)) {
      throw new Error(
        `Найдена резервная копия без маркера режима: ${paths.backup}. ` +
          "Она не была удалена из соображений безопасности.",
      );
    }

    removeDatabaseFiles(paths.active);
    return "Оригинальная база очищена. При запуске будет создана новая чистая база.";
  }

  function status() {
    const state = readState();
    return state
      ? `Режим базы: демонстрационная. Оригинал: ${
          state.originalExisted ? "сохранён" : "очищен или отсутствовал"
        }.`
      : `Режим базы: оригинальная${fs.existsSync(paths.active) ? "" : " (файл пока не создан)"}.`;
  }

  return { paths, useDemo, restoreOriginal, clearOriginal, status };
}

function printUsage() {
  console.log("Использование: node scripts/database-manager.js <use-demo|restore|clear-original|status>");
}

if (require.main === module) {
  const manager = createDatabaseManager(
    process.env.VOXSEKAI_PROJECT_ROOT
      ? path.resolve(process.env.VOXSEKAI_PROJECT_ROOT)
      : undefined,
  );
  const command = String(process.argv[2] || "status").toLowerCase();

  try {
    let message;
    if (command === "use-demo") message = manager.useDemo();
    else if (command === "restore") message = manager.restoreOriginal();
    else if (command === "clear-original") message = manager.clearOriginal();
    else if (command === "status") message = manager.status();
    else {
      printUsage();
      process.exitCode = 1;
    }
    if (message) console.log(message);
  } catch (error) {
    console.error(`ОШИБКА: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { createDatabaseManager };
