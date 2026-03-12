use anyhow::Result;
use heed::{Env, EnvOpenOptions};
use rusqlite::Connection;
use std::{path::PathBuf, sync::{Arc, Mutex}};

#[derive(Clone)]
pub struct SqliteStore {
    path: Arc<PathBuf>,
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
