#!/usr/bin/env sh
set -u

STRICT=0
if [ "${1:-}" = "--strict" ]; then
  STRICT=1
fi

missing=""
missing_pkg_config_modules=""
missing_linux_native_tools=""

append_missing() {
  if [ -z "$missing" ]; then
    missing="$1"
  else
    missing="$missing $1"
  fi
}

append_missing_pkg_module() {
  if [ -z "$missing_pkg_config_modules" ]; then
    missing_pkg_config_modules="$1"
  else
    missing_pkg_config_modules="$missing_pkg_config_modules $1"
  fi
}

append_missing_linux_native_tool() {
  if [ -z "$missing_linux_native_tools" ]; then
    missing_linux_native_tools="$1"
  else
    missing_linux_native_tools="$missing_linux_native_tools $1"
  fi
}

if ! command -v cmake >/dev/null 2>&1; then
  append_missing "cmake"
fi

case "$(uname -s)" in
  Linux)
    if ! command -v pkg-config >/dev/null 2>&1; then
      append_missing "pkg-config"
    else
      for module in gtk+-3.0 webkit2gtk-4.1 alsa; do
        if ! pkg-config --exists "$module"; then
          append_missing_pkg_module "$module"
        fi
      done
    fi
    if ! command -v clang >/dev/null 2>&1; then
      append_missing_linux_native_tool "clang"
    fi
    if ! ldconfig -p 2>/dev/null | grep -Eq 'libclang([.-].*)?\.so([.0-9]*)?'; then
      append_missing_linux_native_tool "libclang"
    fi
    ;;
esac

if [ -z "$missing" ] && [ -z "$missing_pkg_config_modules" ] && [ -z "$missing_linux_native_tools" ]; then
  echo "Doctor: OK"
  exit 0
fi

if [ -n "$missing" ]; then
  echo "Doctor: missing dependencies: $missing"
fi

if [ -n "$missing_pkg_config_modules" ]; then
  echo "Doctor: missing Linux desktop pkg-config modules: $missing_pkg_config_modules"
fi

if [ -n "$missing_linux_native_tools" ]; then
  echo "Doctor: missing Linux native build tools/libraries: $missing_linux_native_tools"
fi

case "$(uname -s)" in
  Darwin)
    echo "Install: brew install cmake"
    ;;
  Linux)
    if [ -n "$missing" ]; then
      echo "Ubuntu/Debian: sudo apt-get install cmake pkg-config"
      echo "Fedora: sudo dnf install cmake pkgconf-pkg-config"
      echo "Arch: sudo pacman -S cmake pkgconf"
    fi
    if [ -n "$missing_pkg_config_modules" ]; then
      echo "Ubuntu/Debian: sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev libasound2-dev"
      echo "Fedora: sudo dnf install gtk3-devel webkit2gtk4.1-devel alsa-lib-devel"
      echo "Arch: sudo pacman -S gtk3 webkit2gtk-4.1 alsa-lib"
    fi
    if [ -n "$missing_linux_native_tools" ]; then
      echo "Ubuntu/Debian: sudo apt-get install clang libclang-dev"
      echo "Fedora: sudo dnf install clang llvm-devel libclang"
      echo "Arch: sudo pacman -S clang llvm"
      echo "If libclang is installed in a non-standard location, set LIBCLANG_PATH to its directory."
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "Install: choco install cmake"
    echo "Or download from: https://cmake.org/download/"
    ;;
  *)
    echo "Install CMake from: https://cmake.org/download/"
    ;;
esac

if [ "$STRICT" -eq 1 ]; then
  exit 1
fi

exit 0
