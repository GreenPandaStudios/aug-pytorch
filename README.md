# aug-pytorch

CPU tensors backed by LibTorch and ATen. This first API copies float64 values, adds tensors, computes sums, and copies results back to August.

This package targets the August `0.22.0` LLVM preview on macOS 14 or later (ARM64), and Debian/Ubuntu GNU/Linux with glibc 2.36 or later (x64 and ARM64). Its source is ready for qualification; consumption requires the matching public compiler and native release assets. It does not work with August 0.20.1.

## Use it

After those preview assets are published:

```sh
aug init native-example
cd native-example
aug add https://github.com/GreenPandaStudios/aug-pytorch#v0.1.4 --as pytorch
```

Replace `main.aug` with:

```aug
import Tensor and TensorError and tensor and add and sum and values from pytorch
try:
    own Tensor left = tensor(values=[1.0, 2.0, 3.0])
    own Tensor right = tensor(values=[4.0, 5.0, 6.0])
    own Tensor result = add(left, right)
    List<float> output = values(tensor=result)
    for item in output:
        print(value=item)
    print(value=sum(tensor=result))
catch TensorError error:
    print(value=error.message)
```

Run `aug run`. Expected output:

```text
5
7
9
21
```

August selects LLVM for this native package. It verifies the source revision, binding contract, native archive, and compiler pack. Consumers need Node 24 and the supported OS. They do not install Git, Clang, LLVM, CMake, or Rust and do not execute this repository's native build recipe. Commit `aug.lock.json`; subsequent `aug run --offline --frozen` uses only verified cached selections. Keep a deployed executable with its adjacent `lib` and `share` directories.

## Contracts and maintenance

`src/export.aug` is the public surface. `src/*.aug.md` describes the checked August code. `native.abi.json` records native symbols, ownership, input representations, checked errors, and call-duration loans. `native/include` contains the C ABI, and `native/src` contains the actual upstream adapter. Acquisition returns owned handles; their scope releases them, including on errors. C++ exceptions and Rust panics do not cross the ABI. Native code remains a trust boundary.

Maintain binding declarations and the descriptor together. Run `aug check .`, `aug test .`, and `aug spec .` with the matching preview. Native maintainers additionally run `node native/build.mjs`; this explicit source build needs the toolchain in `aug-package.json` and the pinned inputs in `native/sources.lock.json`. Rust builds select Rust 1.98.1 explicitly. The build runs independent native clients before succeeding. The candidate workflow builds and uploads the measured archive and candidate manifest for review. Copy the reviewed manifest into source, check the August tests, then tag that source. Publish exactly the archive whose SHA-256 is in the tagged manifest; rebuilding creates a new candidate.

The prebuilt archive includes upstream notices, provenance, a runtime dependency inventory and a whole-file manifest. Installing this package does not run build scripts. An unsupported target or missing artifact is an error; there is no automatic source-build fallback.

The `v0.1.4` release workflow downloads the reviewed three-platform candidate run, verifies unchanged binding and build inputs, and publishes the exact pinned archives. `release-candidates.json` identifies that run; it is separate from native source inputs. No native toolchain is needed by consumers. See [the native maintainer workflow](native/LINUX.md). The matching August compiler release and public installed-CLI checks must pass before claiming complete platform support.

If publication stops, retry the release workflow on main with the existing tag in its `tag` input. It checks out that immutable source tag and uses the corrected maintainer publisher. It rechecks the source and artifacts, leaves partial uploads draft, and refuses to overwrite different bytes.

The 0.1.4 adapter makes its cleanup counter exports signed int64 values, matching the reviewed August descriptor. All three platform candidates passed native clients before publication.

## August 0.22 source package

This source tag targets the isolated-worker compiler preview. Its native bindings are unchanged and its manifest deliberately reuses the previously published, checksum-pinned native archives. The existing native ABI remains unchanged. These bindings do not yet declare worker safety; use them on their creating heap. The separate GPU package qualifies worker entry explicitly.
