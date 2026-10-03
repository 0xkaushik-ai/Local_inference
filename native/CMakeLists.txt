cmake_minimum_required(VERSION 3.24)
project(devicebench_runanywhere LANGUAGES CXX)
find_package(RunAnywhere 0.20.38 EXACT REQUIRED)
# The packaged Linux archives have cyclic references and need rescanning with GNU ld.
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  find_package(OpenMP REQUIRED)
  get_target_property(kit_deps RunAnywhere::commons INTERFACE_LINK_LIBRARIES)
  set_property(TARGET RunAnywhere::commons PROPERTY INTERFACE_LINK_LIBRARIES
    "-Wl,--start-group;${RunAnywhere_LIBRARY_DIR}/librac_commons.a;${kit_deps};OpenMP::OpenMP_CXX;-Wl,--end-group")
endif()
add_executable(devicebench-runanywhere runanywhere.cpp)
target_link_libraries(devicebench-runanywhere PRIVATE RunAnywhere::commons)
target_compile_features(devicebench-runanywhere PRIVATE cxx_std_20)
