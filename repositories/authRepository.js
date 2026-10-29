const crypto = require("node:crypto");
const { getDb } = require("../db");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function mapUser(row) {
  if (!row) return null;
  return { id: row.id, username: row.username, role: row.role, createdAt: row.created_at, passwordHash: row.password_hash };
}

function createAuthRepository(db = getDb()) {
  const statements = {
    allUsers: db.prepare("SELECT * FROM users ORDER BY username"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    userByUsername: db.prepare("SELECT * FROM users WHERE username = ?"),
    countAll: db.prepare("SELECT COUNT(*) AS n FROM users"),
    insertUser: db.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
    ),
    deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
  };

  return {
    hashPassword,
    verifyPassword,
    getUsers() {
      return statements.allUsers.all().map(mapUser);
    },
    getUserById(id) {
      return mapUser(statements.userById.get(id));
    },
    getUserByUsername(username) {
      return mapUser(statements.userByUsername.get(username));
    },
    countUsers() {
      return statements.countAll.get().n;
    },
    createUser({ username, password, role = "user" }) {
      const info = statements.insertUser.run(username, hashPassword(password), role);
      return this.getUserById(info.lastInsertRowid);
    },
    deleteUser(id) {
      statements.deleteUser.run(id);
    },
    /** Создаёт указанного админа, если его ещё нет. */
    ensureAdmin(username, password) {
      if (statements.userByUsername.get(username)) return false;
      statements.insertUser.run(username, hashPassword(password), "admin");
      return true;
    },
  };
}

module.exports = createAuthRepository();
module.exports.createAuthRepository = createAuthRepository;
