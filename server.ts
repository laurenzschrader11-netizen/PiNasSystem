import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_PATH = path.join(__dirname, "nas.db");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Setup Database
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    folder_id TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add folder_id to files if it doesn't exist (for existing databases)
try {
  db.exec("ALTER TABLE files ADD COLUMN folder_id TEXT");
} catch (e) {
  // Column already exists
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/contents", (req, res) => {
    const folderId = req.query.folderId === "root" ? null : (req.query.folderId as string);
    try {
      const folders = db.prepare("SELECT * FROM folders WHERE parent_id IS ? ORDER BY name ASC").all(folderId);
      const files = db.prepare("SELECT * FROM files WHERE folder_id IS ? ORDER BY upload_date DESC").all(folderId);
      res.json({ folders, files });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contents" });
    }
  });

  app.post("/api/folders", (req, res) => {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const id = Math.random().toString(36).substring(2, 15);
    const pId = parentId === "root" ? null : parentId;

    try {
      db.prepare("INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)").run(id, name, pId);
      res.json({ id, name });
    } catch (error) {
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.delete("/api/folders/:id", (req, res) => {
    const { id } = req.params;
    try {
      // Recursive deletion would be better, but for simplicity we just delete the folder
      // In a real app, you'd want to delete all files in the folder from disk too.
      // For this demo, we'll just delete the DB entries.
      
      // Get all files in this folder to delete from disk
      const filesInFolder = db.prepare("SELECT name FROM files WHERE folder_id = ?").all(id) as any[];
      filesInFolder.forEach(f => {
        const filePath = path.join(UPLOADS_DIR, f.name);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });

      db.prepare("DELETE FROM files WHERE folder_id = ?").run(id);
      db.prepare("DELETE FROM folders WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  app.get("/api/files", (req, res) => {
    try {
      const files = db.prepare("SELECT * FROM files ORDER BY upload_date DESC").all();
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileId = Math.random().toString(36).substring(2, 15);
    const { filename, originalname, mimetype, size } = req.file;
    const folderId = req.body.folderId === "root" ? null : req.body.folderId;

    try {
      db.prepare(
        "INSERT INTO files (id, name, original_name, mime_type, size, folder_id) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(fileId, filename, originalname, mimetype, size, folderId);

      res.json({ id: fileId, name: originalname });
    } catch (error) {
      res.status(500).json({ error: "Failed to save file metadata" });
    }
  });

  app.get("/api/files/:id/download", (req, res) => {
    const { id } = req.params;
    const file = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as any;

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = path.join(UPLOADS_DIR, file.name);
    res.download(filePath, file.original_name);
  });

  app.delete("/api/files/:id", (req, res) => {
    const { id } = req.params;
    const file = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as any;

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    try {
      const filePath = path.join(UPLOADS_DIR, file.name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.prepare("DELETE FROM files WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  app.get("/api/files/:id/view", (req, res) => {
    const { id } = req.params;
    const file = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as any;
    if (!file) return res.status(404).json({ error: "File not found" });
    const filePath = path.join(UPLOADS_DIR, file.name);
    res.sendFile(filePath);
  });

  app.post("/api/rename", (req, res) => {
    const { id, type, newName } = req.body;
    if (!id || !type || !newName) return res.status(400).json({ error: "Missing parameters" });

    try {
      if (type === "file") {
        db.prepare("UPDATE files SET original_name = ? WHERE id = ?").run(newName, id);
      } else {
        db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(newName, id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to rename" });
    }
  });

  app.get("/api/stats", (req, res) => {
    try {
      const stats = db.prepare("SELECT COUNT(*) as count, SUM(size) as totalSize FROM files").get() as any;
      res.json({
        count: stats.count || 0,
        totalSize: stats.totalSize || 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
