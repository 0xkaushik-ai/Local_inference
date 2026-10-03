cmake_minimum_required(VERSION 3.24)
project(devicebench_engine LANGUAGES C CXX)
enable_testing()

if(NOT LLAMA_SOURCE_DIR OR NOT EXISTS "${LLAMA_SOURCE_DIR}/include/llama.h")
    message(FATAL_ERROR "Set LLAMA_SOURCE_DIR to the verified pinned llama.cpp source directory")
endif()
set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type")
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Static inference libraries" FORCE)
foreach(option LLAMA_BUILD_COMMON LLAMA_BUILD_TESTS LLAMA_BUILD_TOOLS LLAMA_BUILD_EXAMPLES
               LLAMA_BUILD_SERVER LLAMA_BUILD_APP LLAMA_BUILD_UI LLAMA_BUILD_MTMD
               LLAMA_OPENSSL GGML_CUDA GGML_VULKAN GGML_METAL GGML_BLAS GGML_RPC
               GGML_SYCL GGML_HIP GGML_OPENCL GGML_WEBGPU GGML_BACKEND_DL)
    set(${option} OFF CACHE BOOL "Disabled for reproducible CPU experiment" FORCE)
endforeach()
set(GGML_NATIVE ON CACHE BOOL "Compile for this CPU" FORCE)
set(GGML_CPU ON CACHE BOOL "CPU backend" FORCE)
set(GGML_CPU_REPACK ON CACHE BOOL "Upstream CPU weight repacking" FORCE)
add_subdirectory("${LLAMA_SOURCE_DIR}" "${CMAKE_BINARY_DIR}/llama")

add_executable(devicebench-engine bench.cpp)
set_target_properties(devicebench-engine PROPERTIES OUTPUT_NAME engine-bench)
target_link_libraries(devicebench-engine PRIVATE llama)
target_include_directories(devicebench-engine PRIVATE "${LLAMA_SOURCE_DIR}/vendor")
target_compile_features(devicebench-engine PRIVATE cxx_std_20)
target_compile_definitions(devicebench-engine PRIVATE
    DEVICEBENCH_UPSTREAM_REVISION="836d57176dc699a726c55418e4f96b8ca628e1bf"
    DEVICEBENCH_BUILD_TYPE="${CMAKE_BUILD_TYPE}"
    DEVICEBENCH_COMPILER="${CMAKE_CXX_COMPILER_ID}-${CMAKE_CXX_COMPILER_VERSION}")
target_compile_options(devicebench-engine PRIVATE -Wall -Wextra -Wpedantic)

# Upstream's minimal greedy-generation example, linked to the same patched engine.
add_executable(engine-demo "${LLAMA_SOURCE_DIR}/examples/simple/simple.cpp")
target_link_libraries(engine-demo PRIVATE llama)
target_compile_features(engine-demo PRIVATE cxx_std_17)

if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/kernel-tests.cmake")
    include("${CMAKE_CURRENT_SOURCE_DIR}/kernel-tests.cmake")
endif()
