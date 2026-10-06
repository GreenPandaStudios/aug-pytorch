# Rebuild the replaceable GNU runtime

These are maintainer steps on native Debian12 x86-64 or ARM64 with Node24, GCC12.2.0, GNU make, patch, tar, binutils and patchelf. Consumers do not run these scripts.

Create a project directory containing native/ and native/tests/. Copy prepare-linux-runtimes.mjs, prepare-patched-libstdcxx.mjs, linux-runtimes.lock.json and gcc12-aligned-new.patch from this sources directory into native/. Copy aligned-new-overflow.cpp into native/tests/. Copy Linux-runtime-BUILD.md into native/GNU_RUNTIME_BUILD.md. Copy the original archives into .aug-build/linux-runtimes/downloads/ to reuse their verified bytes. From the project directory run:

    node native/prepare-linux-runtimes.mjs

The driver verifies the original archive/package pins. The source build selects POSIX threads, fixed GCC12.2.0 compilers and baseline architecture flags, then applies the recorded upstream overflow backport. It compares every required dynamic export, checks glibc2.36, and executes allocation and thread/future regressions against the exact replacement DSO, including cache hits. It relocates GNU DSOs to $ORIGIN and records exact output hashes.

Original GCC/zlib sources, Debian packaging inputs, full license/copyright texts, GCC Runtime Library Exception, patch and build recipes are retained here and in licenses/. The adapter/upstream LibTorch binaries are separate artifacts. Applications keep the GNU libraries replaceable; these corresponding-source files are deployment metadata and are not automatic installation hooks.
