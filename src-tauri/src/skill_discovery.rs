//! Finds skill folders already on this computer so 设置 → 技能 can offer
//! them: the per-user skill roots of Claude Code (`~/.claude/skills`), Codex
//! (`~/.codex/skills`) and the shared Agent Skills location
//! (`~/.agents/skills`). A skill is a direct subfolder holding `SKILL.md`.
//! Only the start of each `SKILL.md` is read (for its name and description);
//! nothing is executed, copied or saved. The browser preview mirrors this in
//! scripts/skill-discovery-api.ts.

use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

pub const SOURCES: [(&str, &str); 3] = [
    ("claude", ".claude/skills"),
    ("codex", ".codex/skills"),
    ("agents", ".agents/skills"),
];
const MAX_SKILLS: usize = 300;
const MANIFEST_HEAD: u64 = 4096;

#[derive(Serialize, Debug, PartialEq)]
pub struct FoundSkill {
    source: &'static str,
    dir: String,
    manifest: String,
}

#[derive(Serialize, Debug)]
pub struct SkillScan {
    home: String,
    skills: Vec<FoundSkill>,
    truncated: bool,
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

/// The first bytes of a file as text; a character cut at the limit is replaced, not fatal.
fn head(path: &Path) -> Option<String> {
    let mut bytes = Vec::new();
    fs::File::open(path)
        .ok()?
        .take(MANIFEST_HEAD)
        .read_to_end(&mut bytes)
        .ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

pub fn scan_in(home: &Path) -> SkillScan {
    let mut skills = Vec::new();
    let mut truncated = false;
    for (source, relative) in SOURCES {
        let Ok(entries) = fs::read_dir(home.join(relative)) else {
            continue;
        };
        let mut dirs: Vec<PathBuf> = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect();
        dirs.sort();
        for dir in dirs {
            let Some(manifest) = head(&dir.join("SKILL.md")) else {
                continue;
            };
            if skills.len() >= MAX_SKILLS {
                truncated = true;
                break;
            }
            skills.push(FoundSkill {
                source,
                dir: dir.to_string_lossy().into_owned(),
                manifest,
            });
        }
    }
    SkillScan {
        home: home.to_string_lossy().into_owned(),
        skills,
        truncated,
    }
}

#[tauri::command]
pub async fn scan_skill_folders() -> Result<SkillScan, String> {
    let home = home().ok_or_else(|| "找不到用户主目录。".to_string())?;
    tauri::async_runtime::spawn_blocking(move || scan_in(&home))
        .await
        .map_err(|_| "扫描失败。".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_subfolders_with_skill_md_only() {
        let home = std::env::temp_dir().join(format!(
            "nekopapa-skills-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(home.join(".claude/skills/review")).unwrap();
        fs::write(
            home.join(".claude/skills/review/SKILL.md"),
            "---\nname: review\n---\n",
        )
        .unwrap();
        fs::create_dir_all(home.join(".claude/skills/notes")).unwrap();
        fs::write(home.join(".claude/skills/README.md"), "not a skill").unwrap();
        fs::create_dir_all(home.join(".agents/skills/deploy")).unwrap();
        fs::write(
            home.join(".agents/skills/deploy/SKILL.md"),
            "x".repeat(10_000),
        )
        .unwrap();
        let scan = scan_in(&home);
        let found: Vec<_> = scan
            .skills
            .iter()
            .map(|skill| (skill.source, skill.dir.rsplit('/').next().unwrap()))
            .collect();
        assert_eq!(found, [("claude", "review"), ("agents", "deploy")]);
        assert_eq!(scan.skills[1].manifest.len(), MANIFEST_HEAD as usize);
        assert!(!scan.truncated);
        fs::remove_dir_all(home).unwrap();
    }
}
