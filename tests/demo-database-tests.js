const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { after, before, test } = require("node:test");
const Database = require("better-sqlite3");
const { createDatabaseManager } = require("../scripts/database-manager");

const projectRoot = path.resolve(__dirname, "..");
const demoDatabase = path.join(projectRoot, "db", "demo", "voxsekai-demo.db");
const temporaryDirectories = [];
let generatedDemoDatabase;

function makeTemporaryProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "voxsekai-db-manager-"));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, "db", "demo"), { recursive: true });
  fs.copyFileSync(demoDatabase, path.join(root, "db", "demo", "voxsekai-demo.db"));
  return root;
}

function createOriginalDatabase(root, value) {
  const filePath = path.join(root, "db", "voxsekai.db");
  const db = new Database(filePath);
  db.exec("CREATE TABLE original_value (value TEXT NOT NULL)");
  db.prepare("INSERT INTO original_value (value) VALUES (?)").run(value);
  db.close();
}

before(() => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "voxsekai-demo-build-"));
  temporaryDirectories.push(outputDirectory);
  generatedDemoDatabase = path.join(outputDirectory, "generated.db");
  execFileSync(
    process.execPath,
    [path.join(projectRoot, "scripts", "create-demo-database.js"), generatedDemoDatabase],
    { cwd: projectRoot },
  );
});

after(() => {
  temporaryDirectories.forEach((directory) =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
});

test("демонстрационная база содержит 8 исполнителей и по 2 трека у каждого", () => {
  const db = new Database(demoDatabase, { readonly: true });
  try {
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM artists").get().n, 8);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tracks").get().n, 16);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events").get().n, 5);
    const counts = db
      .prepare(`
        SELECT a.id, COUNT(at.track_id) AS n
        FROM artists a
        LEFT JOIN artist_tracks at ON at.artist_id = a.id
        GROUP BY a.id
      `)
      .all();
    assert.equal(counts.length, 8);
    counts.forEach((row) => assert.ok(row.n >= 2, `${row.id}: ${row.n}`));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tracks WHERE audio_url IS NOT NULL").get().n, 0);
  } finally {
    db.close();
  }
});

test("генератор воспроизводит тот же демонстрационный каталог", () => {
  const expected = new Database(demoDatabase, { readonly: true });
  const generated = new Database(generatedDemoDatabase, { readonly: true });
  try {
    const catalogQuery = `
      SELECT t.id, t.display_title, a.id AS artist_id
      FROM tracks t
      JOIN artist_tracks at ON at.track_id = t.id
      JOIN artists a ON a.id = at.artist_id
      ORDER BY t.id, a.id
    `;
    assert.deepEqual(generated.prepare(catalogQuery).all(), expected.prepare(catalogQuery).all());
  } finally {
    expected.close();
    generated.close();
  }
});

test("переключение на демо и обратно сохраняет оригинальную базу", () => {
  const root = makeTemporaryProject();
  createOriginalDatabase(root, "keep-me");
  const manager = createDatabaseManager(root);

  manager.useDemo();
  let active = new Database(manager.paths.active, { readonly: true });
  assert.equal(active.prepare("SELECT COUNT(*) AS n FROM artists").get().n, 8);
  active.close();

  manager.restoreOriginal();
  active = new Database(manager.paths.active, { readonly: true });
  assert.equal(active.prepare("SELECT value FROM original_value").get().value, "keep-me");
  active.close();
  assert.equal(fs.existsSync(manager.paths.state), false);
  assert.equal(fs.existsSync(manager.paths.backup), false);
});

test("очистка оригинала при включённой демо-базе не изменяет демо-шаблон", () => {
  const root = makeTemporaryProject();
  createOriginalDatabase(root, "remove-me");
  const manager = createDatabaseManager(root);

  manager.useDemo();
  const templateBefore = fs.readFileSync(manager.paths.demo);
  manager.clearOriginal();

  const active = new Database(manager.paths.active, { readonly: true });
  assert.equal(active.prepare("SELECT COUNT(*) AS n FROM tracks").get().n, 16);
  active.close();
  assert.deepEqual(fs.readFileSync(manager.paths.demo), templateBefore);

  manager.restoreOriginal();
  assert.equal(fs.existsSync(manager.paths.active), false);
  assert.equal(fs.existsSync(manager.paths.demo), true);
});

test("ошибка восстановления не удаляет активную демо-базу", () => {
  const root = makeTemporaryProject();
  createOriginalDatabase(root, "lost-backup");
  const manager = createDatabaseManager(root);

  manager.useDemo();
  fs.rmSync(manager.paths.backup);
  assert.throws(() => manager.restoreOriginal(), /Резервная копия/);

  const active = new Database(manager.paths.active, { readonly: true });
  assert.equal(active.prepare("SELECT COUNT(*) AS n FROM artists").get().n, 8);
  active.close();
});
