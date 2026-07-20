use std::path::{Path, PathBuf};

/// Write text to an absolute path. Never clobbers an existing file — appends
/// " (n)" before the extension the way a browser download would. Returns the
/// path actually written.
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<String, String> {
  let target = unique_path(Path::new(&path));
  if let Some(parent) = target.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  std::fs::write(&target, contents).map_err(|e| e.to_string())?;
  Ok(target.to_string_lossy().into_owned())
}

/// Read a UTF-8 text file the user selected via the native open dialog.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
  std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

fn unique_path(path: &Path) -> PathBuf {
  if !path.exists() {
    return path.to_path_buf();
  }
  let parent = path.parent().unwrap_or_else(|| Path::new("."));
  let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("download");
  let ext = path.extension().and_then(|s| s.to_str());
  for n in 1..1000 {
    let name = match ext {
      Some(e) => format!("{stem} ({n}).{e}"),
      None => format!("{stem} ({n})"),
    };
    let candidate = parent.join(name);
    if !candidate.exists() {
      return candidate;
    }
  }
  path.to_path_buf()
}
