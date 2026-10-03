add_executable(engine-kernel-test kernel_test.cpp)
target_link_libraries(engine-kernel-test PRIVATE ggml-cpu)
target_include_directories(engine-kernel-test PRIVATE
    "${LLAMA_SOURCE_DIR}/ggml/include"
    "${LLAMA_SOURCE_DIR}/ggml/src"
    "${LLAMA_SOURCE_DIR}/ggml/src/ggml-cpu")
target_compile_features(engine-kernel-test PRIVATE cxx_std_17)
add_test(NAME engine-kernel-correctness COMMAND engine-kernel-test)
set_tests_properties(engine-kernel-correctness PROPERTIES SKIP_RETURN_CODE 77)
