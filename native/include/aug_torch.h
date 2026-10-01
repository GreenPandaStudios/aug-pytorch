#ifndef AUG_TORCH_H
#define AUG_TORCH_H
#include "aug_native.h"
#ifdef __cplusplus
#define AUG_PROBE_NOEXCEPT noexcept
extern "C" {
#else
#define AUG_PROBE_NOEXCEPT
#endif
#define AUG_PROBE_EXPORT __attribute__((visibility("default")))

typedef struct aug_torch_tensor_v1 aug_torch_tensor_v1;
AUG_PROBE_EXPORT int32_t aug_torch_tensor_from_f64_v1(const double *, uint64_t, aug_torch_tensor_v1 **, aug_native_error_v1 *) AUG_PROBE_NOEXCEPT;
AUG_PROBE_EXPORT int32_t aug_torch_tensor_add_v1(const aug_torch_tensor_v1 *, const aug_torch_tensor_v1 *, aug_torch_tensor_v1 **, aug_native_error_v1 *) AUG_PROBE_NOEXCEPT;
AUG_PROBE_EXPORT int32_t aug_torch_tensor_sum_v1(const aug_torch_tensor_v1 *, double *, aug_native_error_v1 *) AUG_PROBE_NOEXCEPT;
AUG_PROBE_EXPORT int32_t aug_torch_tensor_values_v1(const aug_torch_tensor_v1 *, double **, uint64_t *, aug_native_error_v1 *) AUG_PROBE_NOEXCEPT;
AUG_PROBE_EXPORT void aug_torch_tensor_release_v1(aug_torch_tensor_v1 *) AUG_PROBE_NOEXCEPT;
AUG_PROBE_EXPORT void aug_torch_values_release_v1(double *) AUG_PROBE_NOEXCEPT;
AUG_PROBE_EXPORT uint64_t aug_probe_live_tensors_v1(void) AUG_PROBE_NOEXCEPT;
AUG_PROBE_EXPORT uint64_t aug_probe_live_buffers_v1(void) AUG_PROBE_NOEXCEPT;
#ifdef __cplusplus
}
#endif
#endif
