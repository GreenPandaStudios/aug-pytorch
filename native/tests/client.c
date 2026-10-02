#include "aug_torch.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <limits.h>

static void once(void) {
  aug_native_error_v1 error = {0};
  double left_values[] = {1, 2, 3}, right_values[] = {4, 5, 6};
  aug_torch_tensor_v1 *left = NULL, *right = NULL, *result = NULL, *short_tensor = NULL, *failed = NULL, *empty = NULL;
  double *output = NULL, sum = 0;
  uint64_t count = 0;
  assert(aug_torch_tensor_from_f64_v1(left_values, 3, &left, &error) == 0);
  assert(aug_torch_tensor_from_f64_v1(right_values, 3, &right, &error) == 0);
  left_values[0] = -1000; /* Creation must copy borrowed input. */
  assert(aug_torch_tensor_add_v1(left, right, &result, &error) == 0);
  assert(aug_torch_tensor_values_v1(result, &output, &count, &error) == 0);
  assert(count == 3 && output[0] == 5 && output[1] == 7 && output[2] == 9);
  assert(aug_torch_tensor_sum_v1(result, &sum, &error) == 0 && sum == 21);
  aug_torch_tensor_release_v1(result); result = NULL;
  assert(output[0] == 5 && output[1] == 7 && output[2] == 9); /* Output is an independent copy. */
  aug_torch_values_release_v1(output); output = NULL;
  assert(aug_torch_tensor_from_f64_v1(NULL, 0, &empty, &error) == 0);
  assert(aug_torch_tensor_values_v1(empty, &output, &count, &error) == 0 && output == NULL && count == 0);
  assert(aug_torch_tensor_sum_v1(empty, &sum, &error) == 0 && sum == 0);
  assert(aug_torch_tensor_from_f64_v1(NULL, 1, &failed, &error) == 1 && failed == NULL);
  assert(aug_torch_tensor_from_f64_v1(left_values, UINT64_MAX, &failed, &error) == 1 && failed == NULL);
  assert(aug_torch_tensor_sum_v1(NULL, &sum, &error) == 1);
  assert(aug_torch_tensor_from_f64_v1(right_values, 2, &short_tensor, &error) == 0);
  const int64_t before = aug_probe_live_tensors_v1();
  assert(aug_torch_tensor_add_v1(left, short_tensor, &failed, &error) == 2 && failed == NULL);
  assert(error.code == 2 && error.message[0] != '\0');
  assert(aug_probe_live_tensors_v1() == before && aug_probe_live_buffers_v1() == 0);
  aug_torch_tensor_release_v1(short_tensor);
  aug_torch_tensor_release_v1(left);
  aug_torch_tensor_release_v1(right);
  aug_torch_tensor_release_v1(empty);
  aug_torch_tensor_release_v1(NULL);
  aug_torch_values_release_v1(NULL);
  assert(aug_probe_live_tensors_v1() == 0 && aug_probe_live_buffers_v1() == 0);
}
int main(void) {
  for (int i = 0; i < 1000; ++i) once();
  puts("LibTorch 2.14.1: [5, 7, 9], sum 21; 1000 independent copy/empty/error/cleanup cycles passed");
  return 0;
}
