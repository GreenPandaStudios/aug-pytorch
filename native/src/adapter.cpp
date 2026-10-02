#include "aug_torch.h"
#include <ATen/ATen.h>
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <memory>
#include <new>
#include <stdexcept>
#include <utility>

static std::atomic<int64_t> live_tensors{0};
static std::atomic<int64_t> live_buffers{0};
struct aug_torch_tensor_v1 {
  at::Tensor tensor;
  explicit aug_torch_tensor_v1(at::Tensor value) : tensor(std::move(value)) { ++live_tensors; }
  ~aug_torch_tensor_v1() { --live_tensors; }
};

static int32_t fail(aug_native_error_v1 *error, int32_t code, const char *message) noexcept {
  if (error) {
    error->code = code;
    std::snprintf(reinterpret_cast<char *>(error->message), sizeof(error->message), "%s", message);
    error->message_length = static_cast<uint32_t>(std::strlen(reinterpret_cast<const char *>(error->message)));
  }
  return code;
}
template<class F> static int32_t boundary(aug_native_error_v1 *error, F &&body) noexcept {
  if (error) { error->code = 0; error->message[0] = '\0'; error->message_length = 0; }
  try { body(); return 0; }
  catch (const c10::Error &error_value) { return fail(error, 2, error_value.what_without_backtrace()); }
  catch (const std::exception &error_value) { return fail(error, 3, error_value.what()); }
  catch (...) { return fail(error, 4, "Unknown native exception"); }
}

extern "C" int32_t aug_torch_tensor_from_f64_v1(const double *input, uint64_t count, aug_torch_tensor_v1 **out, aug_native_error_v1 *error) noexcept {
  if (out) *out = nullptr;
  if (!out || (!input && count != 0) || count > static_cast<uint64_t>(std::numeric_limits<int64_t>::max()) || count > SIZE_MAX / sizeof(double))
    return fail(error, 1, "Invalid tensor input pointer, output pointer, or length");
  return boundary(error, [&] {
    const auto options = at::TensorOptions().dtype(at::kDouble).device(at::kCPU);
    auto value = count == 0 ? at::empty({0}, options)
                           : at::from_blob(const_cast<double *>(input), {static_cast<int64_t>(count)}, options).clone();
    *out = new aug_torch_tensor_v1(std::move(value));
  });
}
extern "C" int32_t aug_torch_tensor_add_v1(const aug_torch_tensor_v1 *left, const aug_torch_tensor_v1 *right, aug_torch_tensor_v1 **out, aug_native_error_v1 *error) noexcept {
  if (out) *out = nullptr;
  if (!left || !right || !out) return fail(error, 1, "Null tensor or output");
  return boundary(error, [&] { *out = new aug_torch_tensor_v1(at::add(left->tensor, right->tensor)); });
}
extern "C" int32_t aug_torch_tensor_sum_v1(const aug_torch_tensor_v1 *tensor, double *out, aug_native_error_v1 *error) noexcept {
  if (out) *out = 0;
  if (!tensor || !out) return fail(error, 1, "Null tensor or output");
  return boundary(error, [&] { *out = at::sum(tensor->tensor).item<double>(); });
}
extern "C" int32_t aug_torch_tensor_values_v1(const aug_torch_tensor_v1 *tensor, double **out, uint64_t *count, aug_native_error_v1 *error) noexcept {
  if (out) *out = nullptr;
  if (count) *count = 0;
  if (!tensor || !out || !count) return fail(error, 1, "Null tensor or output");
  return boundary(error, [&] {
    const auto value = tensor->tensor.contiguous();
    const auto size = static_cast<uint64_t>(value.numel());
    if (size > SIZE_MAX / sizeof(double)) throw std::length_error("Tensor output is too large");
    if (size == 0) return;
    std::unique_ptr<double, decltype(&std::free)> storage(static_cast<double *>(std::malloc(size * sizeof(double))), &std::free);
    if (!storage) throw std::bad_alloc();
    std::memcpy(storage.get(), value.const_data_ptr<double>(), size * sizeof(double));
    *count = size;
    *out = storage.release();
    ++live_buffers;
  });
}
extern "C" void aug_torch_tensor_release_v1(aug_torch_tensor_v1 *tensor) noexcept { delete tensor; }
extern "C" void aug_torch_values_release_v1(double *values) noexcept { if (values) { std::free(values); --live_buffers; } }
extern "C" int64_t aug_probe_live_tensors_v1(void) noexcept { return live_tensors.load(); }
extern "C" int64_t aug_probe_live_buffers_v1(void) noexcept { return live_buffers.load(); }
