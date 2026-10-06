# August PyTorch

CPU tensors backed by LibTorch and ATen. Create float64 tensors, add them, compute sums and copy results into August lists.

**Unreleased 0.2.0 candidate.** This source requires August 1.0.0; compiler qualification and publication are pending. With the published August 0.23.0 compiler, use package v0.1.6.

Supported artifacts target macOS 14+ ARM64 and GNU/Linux x86-64 or ARM64 with glibc 2.36+. Consumers need Node 24+ and August. The CLI obtains prebuilt libraries and the compiler pack; no separate native compiler is required.

## Use it after publication

```sh
aug init native-example
cd native-example
aug add https://github.com/GreenPandaStudios/aug-pytorch#v0.2.0 --as pytorch
```

Save this as main.aug:

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

Run aug run. Expected output:

```text
5
7
9
21
```

Commit aug.lock.json. A frozen offline run uses the locked source and verified cached artifacts. Deploy the executable with its neighboring lib and share directories. An unsupported target or missing artifact stops installation; source builds require an explicit maintainer action.

## Ownership and failures

A Tensor is an owned native resource. Keep it on its creating heap and let its scope release it. Inputs are borrowed for the call; returned value lists are copied. C++ exceptions become checked TensorError values. GPU support and the broader PyTorch API remain outside this package.

## Maintain the package

Start at src/export.aug and the adjacent compiled specifications. native.abi.json declares symbols, input bounds, ownership, release functions and checked failures. Update native declarations and their descriptor together. Run aug check, aug test and aug spec with the required compiler.

A native build uses Clang with C++ support, the Apple SDK on macOS, or the pinned Debian 12 maintainer image on Linux; its exact requirements and upstream inputs are in aug-package.json and native/sources.lock.json. Run node native/build.mjs, review the candidate archive and manifest, and publish the exact measured bytes. The archive contains dependency, license and provenance records. Installation never runs the recipe.

The 0.2.0 candidate keeps the August binding surface and rebuilds all native archives. Linux uses the retained GCC aligned-allocation fix; all targets require the reviewed component notices and unchanged authenticated upstream LibTorch binaries. Candidate checks reject changed patches, notices, upstream binaries and omitted runtime dependencies. Repeat real LLVM operations, cleanup, clean installation and relocated execution with the required compiler before publication. The artifact’s redistribution-review.json records its bounded reviewed closure.
