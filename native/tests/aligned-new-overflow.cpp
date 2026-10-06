#include <new>
#include <initializer_list>
#include <cstdint>
#include <cstddef>
#include <cstdio>
#include <thread>
#include <mutex>
#include <future>
#include <vector>
#include <stdexcept>

// Exercise allocation through the linked runtime, including its nothrow path.
static bool rejects(std::size_t size, std::size_t alignment) {
  const auto allocate = static_cast<void*(*)(std::size_t,std::align_val_t)>(&::operator new);
  const auto a = static_cast<std::align_val_t>(alignment);
  bool rejected = false;
  try {
    void* value = allocate(size,a);
    ::operator delete(value,a);
  } catch (const std::bad_alloc&) { rejected = true; }
  void* value = ::operator new(size,a,std::nothrow);
  const bool null = value == nullptr;
  if(value) ::operator delete(value,a);
  return rejected && null;
}
int main() {
  const std::size_t vectors[][2] = {
    {SIZE_MAX-8,32},{SIZE_MAX,8},{SIZE_MAX,32},{SIZE_MAX,1024},
    {SIZE_MAX,65536},{SIZE_MAX-1,16},{SIZE_MAX-1025,1024},
    {SIZE_MAX-1024,1024},{SIZE_MAX-65536,65536}
  };
  for(const auto& vector:vectors) {
    if(!rejects(vector[0],vector[1])) {
      std::fprintf(stderr,"Aligned allocation accepted an impossible size\n");
      return 1;
    }
  }
  for(const std::size_t alignment:{8U,16U,32U,65536U}) {
    for(const std::size_t size:{0U,1U,31U,129U}) {
      const auto a=static_cast<std::align_val_t>(alignment);
      void* value=::operator new(size,a);
      if(!value||(reinterpret_cast<std::uintptr_t>(value)&(alignment-1))!=0)return 2;
      ::operator delete(value,a);
    }
  }
  std::mutex mutex;
  std::once_flag once;
  int count=0,initializations=0;
  std::vector<std::thread> threads;
  for(int i=0;i<4;++i) threads.emplace_back([&] {
    std::call_once(once,[&] { ++initializations; });
    for(int j=0;j<1000;++j) { std::lock_guard<std::mutex> lock(mutex); ++count; }
  });
  for(auto& thread:threads) thread.join();
  if(count!=4000||initializations!=1)return 3;
  auto value=std::async(std::launch::async,[] { return 42; });
  if(value.get()!=42)return 4;
  auto failure=std::async(std::launch::async,[]() -> int { throw std::runtime_error("expected"); });
  try { failure.get(); return 5; } catch(const std::runtime_error&) {}
  std::puts("Aligned allocation and POSIX thread regression passed");
}
