# Native library notices

This directory records the notices collected for the qualified CPU LibTorch 2.14.1 macOS ARM64 input. Preserve the directory in native release archives and deployed application notices. `provenance.json` identifies each file's upstream repository, immutable source revision or exact package archive, path, and SHA-256. It also records whether the text matches the associated official PyTorch wheel.

The LibTorch ZIP omits licenses. Its `libtorch_cpu`, `libc10`, and `libomp` bytes exactly match the official macOS wheel whose published SHA-256 is `9cf3082d25560efb1eef921871595227c0cf305abb7761ca45b6b988ef6cdd45`. The wheel's license glob omits filenames such as `LICENSE.md`, `LICENSE.MIT`, and SPDX `LICENSES` directories. This collection therefore combines matching wheel notices with exact pinned component texts and copyright notices. It does not rely on the PyTorch BSD license alone.

| Component | Notice location |
| --- | --- |
| PyTorch, ATen, c10, historical contributions | `pytorch-source/LICENSE`, `pytorch-source/NOTICE` |
| CPUinfo and clog | `cpuinfo/` |
| NNPACK and kernel/header dependencies | `NNPACK/`, `FP16/`, `FXdiv/`, `psimd/`, `pthreadpool/`, `gemmlowp-gemmlowp/` |
| QNNPACK and its clog copy | `pytorch-source/aten/src/ATen/native/quantized/cpu/qnnpack/` |
| SLEEF | `sleef/` |
| fmt | `fmt/`; conservative pinned Kineto copy under `kineto/fmt/` |
| Arm KleidiAI | `kleidiai/` |
| Protobuf and UTF-8 validation | `protobuf/` |
| ONNX and FlatBuffers | `onnx/`, `flatbuffers/` |
| Kineto and dynolog headers | `kineto/` |
| JSON and Hedley header attribution | `nlohmann/` |
| Gloo and its uvw header | `gloo/` |
| TensorPipe, native object protocols, and libuv | `tensorpipe/`, including full BSD tree and ISC inet notices |
| PocketFFT | `pocketfft/` |
| miniz, Perfetto, and moodycamel | `pytorch-source/third_party/` |
| LLVM OpenMP and its conda recipe attribution | `openmp/`, plus PyTorch's vendored OpenMP text |

The exact PyTorch macOS recipe chooses conda-forge `llvm-openmp 21.1.8-h4a912ad_0`. Applying its documented install-name change and ad-hoc signing to that package's library reproduced the LibTorch `libomp` SHA-256 exactly. The package supplies the LLVM Apache 2.0 license with LLVM exceptions; its source digest, feedstock revision, normalization, and potential compiler-rt builtins input are recorded in the inventory. The `5.0.20140926` string in the binary is an OpenMP runtime identifier, not its LLVM release version.

The collection includes conservative header/dependency texts as well as components confirmed by native symbols and build metadata. Auxiliary permission texts do not establish that every file in their source repositories is linked. Unrelated GPU libraries, development tools, and test licenses were excluded. For example, JSON's GPL notice applies to `tests/thirdparty/imapdl`, while the actual included JSON/Hedley header declares MIT; it is not a GPL runtime dependency. The full libuv MIT, BSD, and ISC notices are retained even though the official wheel's metadata omits ISC from its aggregate expression.

The status remains `redistribution-review-incomplete`: this inventory is not legal clearance or an exhaustive link-map/SBOM certificate. Before publishing, reconcile the final adapter/upstream closure with the inventory, record final binary hashes and any modifications, include this directory in the release and deployment manifest, and review remaining embedded-header and compiler-runtime attribution against actual build inputs. A Torch upgrade requires repeating the binary, dependency, and notice comparison.

Primary provenance: [PyTorch commit](https://github.com/pytorch/pytorch/tree/5c4886908584029761b579af026dcfb627c84070), [OpenMP selection recipe](https://github.com/pytorch/pytorch/blob/5c4886908584029761b579af026dcfb627c84070/.ci/macwheel/install_libomp.sh), [LibTorch extraction recipe](https://github.com/pytorch/pytorch/blob/5c4886908584029761b579af026dcfb627c84070/.ci/libtorch/extract_libtorch_from_wheel.py), [official CPU wheel index](https://download.pytorch.org/whl/cpu/torch/), and the per-file URLs in `provenance.json`.
