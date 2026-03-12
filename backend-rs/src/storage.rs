use anyhow::Result;
use heed::{Env, EnvOpenOptions};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::{Arc, Mutex}};
use uuid::Uuid;

#[derive(Clone)]
pub struct SqliteStore {
    path: Arc<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRow {
    pub id: String,
    pub r#type: String,
    pub name: String,
    pub config: serde_json::Value,
    pub created_at: String,
}

impl SqliteStore {
    pub fn open(path: impl Into<PathBuf>) -> Result<Self> {
        Ok(Self { path: Arc::new(path.into()) })
    }

    pub fn init(&self) -> Result<()> {
        let conn = Connection::open(&*self.path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS providers (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              name TEXT NOT NULL,
              config TEXT NOT NULL DEFAULT '{}',
              created_at TEXT DEFAULT (datetime('now'))
            );
            "#,
        )?;
        Ok(())
    }

    fn conn(&self) -> Result<Connection> {
        Ok(Connection::open(&*self.path)?)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get::<_, String>(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn list_providers(&self) -> Result<Vec<ProviderRow>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare("SELECT id, type, name, config, created_at FROM providers ORDER BY created_at")?;
        let rows = stmt.query_map([], |r| {
            let cfg_s: String = r.get(3)?;
            let cfg = serde_json::from_str::<serde_json::Value>(&cfg_s).unwrap_or_else(|_| serde_json::json!({}));
            Ok(ProviderRow {
                id: r.get(0)?,
                r#type: r.get(1)?,
                name: r.get(2)?,
                config: cfg,
                created_at: r.get(4)?,
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_provider(&self, id: &str) -> Result<Option<ProviderRow>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare("SELECT id, type, name, config, created_at FROM providers WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(r) = rows.next()? {
            let cfg_s: String = r.get(3)?;
            let cfg = serde_json::from_str::<serde_json::Value>(&cfg_s).unwrap_or_else(|_| serde_json::json!({}));
            Ok(Some(ProviderRow {
                id: r.get(0)?,
                r#type: r.get(1)?,
                name: r.get(2)?,
                config: cfg,
                created_at: r.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn upsert_provider(&self, id: Option<String>, typ: &str, name: &str, config: serde_json::Value) -> Result<String> {
        let pid = id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let conn = self.conn()?;
        conn.execute(
            r#"INSERT INTO providers (id, type, name, config)
               VALUES (?1, ?2, ?3, ?4)
               ON CONFLICT(id) DO UPDATE SET type=excluded.type, name=excluded.name, config=excluded.config"#,
            params![pid, typ, name, config.to_string()],
        )?;
        Ok(pid)
    }

    pub fn delete_provider(&self, id: &str) -> Result<()> {
        let conn = self.conn()?;
        conn.execute("DELETE FROM providers WHERE id = ?1", params![id])?;
        Ok(())
    }
}

#[derive(Clone)]
pub struct LmdbCache {
    pub env: Arc<Env>,
    _guard: Arc<Mutex<()>>,
}

impl LmdbCache {
    pub fn open(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        std::fs::create_dir_all(&path)?;
        let env = unsafe {
            EnvOpenOptions::new()
                .max_dbs(16)
                .map_size(256 * 1024 * 1024)
                .open(path)?
        };
        Ok(Self {
            env: Arc::new(env),
            _guard: Arc::new(Mutex::new(())),
        })
    }
}
