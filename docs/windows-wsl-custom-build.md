# Windows Custom Build From WSL

Goal: build a side-by-side Windows CodexMonitor app from WSL without moving the repo to a Windows disk, and reuse the installed app's data.

## Working Build

Prereqs in WSL:

```bash
sudo apt install nsis lld llvm clang ninja-build clang-19 lld-19 llvm-19
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
npm install
```

Point `cargo-xwin` at Clang 19:

```bash
sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-19 190
sudo update-alternatives --install /usr/bin/clang++ clang++ /usr/bin/clang++-19 190
sudo update-alternatives --install /usr/bin/lld lld /usr/bin/lld-19 190
sudo update-alternatives --set clang /usr/bin/clang-19
sudo update-alternatives --set clang++ /usr/bin/clang++-19
sudo update-alternatives --set lld /usr/bin/lld-19
rm -f /home/user/.cache/cargo-xwin/clang-cl
ln -s /usr/bin/clang-19 /home/user/.cache/cargo-xwin/clang-cl
```

Build a side-by-side custom Windows app:

```bash
RUSTFLAGS="-L native=$(find /home/user/repos/codex-monitor/src-tauri/target/x86_64-pc-windows-msvc/release/build -path '*/whisper-rs-sys-*/out/lib/static' | head -n1)" \
npm run tauri:build:win -- --runner cargo-xwin --target x86_64-pc-windows-msvc --config '{"productName":"Codex Monitor Custom","identifier":"com.dimillian.codexmonitor.custom","bundle":{"targets":["nsis"]}}'
```

Result:

- Built app binary: `src-tauri/target/x86_64-pc-windows-msvc/release/codex-monitor.exe`
- The app ran on Windows as a custom side-by-side build.

## Mistakes / Fixes

- `--bundles nsis` failed from WSL because the Linux Tauri CLI only accepted Linux bundle values there.
  Fix: override bundle targets via `--config '{"bundle":{"targets":["nsis"]}}'`.
- `whisper-rs-sys` first failed because `ninja` was missing.
  Fix: install `ninja-build`.
- `whisper-rs-sys` then failed with `STL1000` because the Windows STL expected Clang 19+ but WSL was using Clang 18.
  Fix: install and force Clang 19.
- `whisper-rs-sys` then built `whisper.lib` but Cargo still could not find it.
  Fix: pass explicit `RUSTFLAGS=-L native=.../whisper-rs-sys-*/out/lib/static`.
- Tauri packaging later panicked in WSL with `Can't detect any appindicator library`.
  Outcome: treat the built `.exe` as the usable artifact; no finished Windows installer was produced from this path.

## Reuse Existing App Data

Because the custom build uses a different identifier, it gets a separate app data directory and starts empty.

To reuse the installed app's data on Windows, create a junction and do not run both apps at the same time:

```powershell
$orig   = Join-Path $env:APPDATA "com.dimillian.codexmonitor"
$custom = Join-Path $env:APPDATA "com.dimillian.codexmonitor.custom"

Remove-Item $custom -Recurse -Force -ErrorAction SilentlyContinue
cmd /c mklink /J "$custom" "$orig"
```

If the app uses `LocalAppData` instead, repeat the same pattern under `$env:LOCALAPPDATA`.

## Final State

- Custom Windows build runs alongside the installed release build.
- Shared app data made existing workspaces and threads visible in the custom build.
- Avoid running both builds simultaneously while they share the same data directory.
