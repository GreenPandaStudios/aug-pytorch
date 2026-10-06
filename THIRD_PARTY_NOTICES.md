# Native redistribution

PyTorch / LibTorch 2.14.1 uses the BSD-style license in `native/LICENSE.pytorch` and `native/NOTICE.pytorch`. The artifacts retain the collected LibTorch component licenses. The macOS closure also includes OpenMP.

The Linux ARM64 CPU closure includes OpenBLAS 0.3.34 and Arm Compute Library 53.2.0. Their exact source archives and license files are under the artifact's `sources` and `licenses` directories. The Arm Compute revision reported by its binary is `7b256bb7965f2fd99cdee790a4b0e56dab438a8c`. The source archives are independently pinned in `native/linux-libtorch.lock.json`; the build checks the reported binary versions before accepting a candidate.

Linux artifacts include the required GCC 12 runtime libraries, with full source inputs, Debian patches, copyright files, GPL/LGPL texts and the GCC Runtime Library Exception. GNU dependencies remain replaceable shared files. Preserve these notices and the source/license directories when redistributing a bundle.

The upstream CPU distribution contains additional statically incorporated components. The collected notices do not constitute an exhaustive binary SBOM. Each artifact records its bounded review scope; it is not an exhaustive upstream static link map or legal clearance.

The Linux C++ runtime includes the retained GCC aligned-allocation overflow backport. Its source, patch, maintainer recipe and native regression receipt accompany the replaceable shared runtime. Linux LibTorch DSOs are shipped without additional loader rewrites.
