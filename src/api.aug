// aug-spec: "api.aug.md" explains this file. Read it before changes; refresh with aug spec.
import Tensor from bindings
import TensorError from contracts
extern C _tensor(List<float> values) returns own Tensor unless TensorError
extern C _add(Tensor left, Tensor right) returns own Tensor unless TensorError
extern C _sum(Tensor tensor) returns float unless TensorError
extern C _values(Tensor tensor) returns List<float> unless TensorError
/** Copy a list of float64 values into a CPU tensor. */
tensor(List<float> values) returns own Tensor:
    unsafe:
        return _tensor(values)
/** Add tensors without changing either input. */
add(Tensor left, Tensor right) returns own Tensor:
    unsafe:
        return _add(left, right)
/** Sum every element. */
sum(Tensor tensor) returns float:
    unsafe:
        return _sum(tensor)
/** Copy tensor values into an August list. */
values(Tensor tensor) returns List<float>:
    unsafe:
        return _values(tensor)

extern C _liveTensors() returns int
extern C _liveBuffers() returns int

_consumeAndFail(own Tensor value) unless TensorError:
    throw TensorError(code=99, message="expected cleanup test")

interface _TensorContainer:
    total() returns float unless TensorError
_TensorHolder(mutable own Tensor item) implements _TensorContainer:
    total() returns float:
        return sum(tensor=item)
_replace(borrow _TensorHolder holder, own Tensor replacement):
    holder.item = replacement


test tensor:
    when cpu:
        it adds_real_tensors:
            own Tensor left = tensor(values=[1.0, 2.0, 3.0])
            own Tensor right = tensor(values=[4.0, 5.0, 6.0])
            own Tensor result = add(left, right)
            assert(sum(tensor=result) == 21.0)
            List<float> output = values(tensor=result)
            assert(output.length() == 3)

    when ownership:
        it transfers_into_a_field_and_releases_the_old_tensor:
            int before = 0
            unsafe:
                before = _liveTensors()
            scope:
                own Tensor initial = tensor(values=[1.0])
                own _TensorHolder holder = _TensorHolder(item=initial)
                own Tensor replacement = tensor(values=[7.0])
                borrow holder:
                    _replace(holder, replacement)
                assert(holder.total() == 7.0)
                unsafe:
                    assert(_liveTensors() == before + 1)
            unsafe:
                assert(_liveTensors() == before)
        it preserves_native_error_methods:
            bool caught = false
            own Tensor left = tensor(values=[1.0, 2.0])
            own Tensor right = tensor(values=[1.0, 2.0, 3.0])
            try:
                add(left, right)
            catch TensorError error:
                caught = error.explain().length() > 0
            assert(caught)
        it releases_a_transferred_tensor_when_the_callee_fails:
            int before = 0
            unsafe:
                before = _liveTensors()
            bool caught = false
            try:
                own Tensor value = tensor(values=[1.0])
                _consumeAndFail(value)
            catch TensorError error:
                caught = error.code == 99
            assert(caught)
            unsafe:
                assert(_liveTensors() == before)
                assert(_liveBuffers() == 0)
        it releases_scoped_and_unused_results:
            int before = 0
            unsafe:
                before = _liveTensors()
            scope:
                own Tensor value = tensor(values=[2.0])
                List<float> output = values(tensor=value)
                assert(output.get(index=0) == 2.0)
            tensor(values=[3.0])
            unsafe:
                assert(_liveTensors() == before)
                assert(_liveBuffers() == 0)
