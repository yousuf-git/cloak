fn main() {
  // `option_env!("CLOAK_API_DIR")` is baked in at compile time, so a changed
  // backend location must force a rebuild rather than reuse a stale constant.
  println!("cargo:rerun-if-env-changed=CLOAK_API_DIR");
  tauri_build::build()
}
