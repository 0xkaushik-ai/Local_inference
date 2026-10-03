// Isolated correctness checks for the experimental Q4_K GEMV arithmetic.
#include "repack.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>

extern "C" bool devicebench_q4k_vnni_available();
extern "C" void devicebench_q4k_kernel_test(
    bool candidate, int n, float * output, const void * weights,
    const void * activations, int columns);

static uint32_t next_random(uint32_t & state) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state;
}

static volatile float benchmark_checksum = 0.0f;

static double run_timed(bool candidate, int n, int nc, int iterations,
        const std::vector<block_q4_Kx8> & weights,
        const std::vector<block_q8_K> & activations, std::vector<float> & output) {
    const auto start = std::chrono::steady_clock::now();
    for (int i = 0; i < iterations; ++i) {
        devicebench_q4k_kernel_test(candidate, n, output.data(), weights.data(), activations.data(), nc);
    }
    const auto end = std::chrono::steady_clock::now();
    benchmark_checksum = output[0];
    return std::chrono::duration<double, std::milli>(end - start).count();
}

static double median(std::vector<double> values) {
    std::sort(values.begin(), values.end());
    return (values[values.size() / 2 - 1] + values[values.size() / 2]) / 2.0;
}

static void run_benchmark() {
    // Isolated, warm-cache, single-thread kernel experiment. This is not whole-model throughput.
    std::printf("{\"kind\":\"kernel_microbenchmark\",\"pairs_per_shape\":8,\"shapes\":[");
    bool first_shape = true;
    const int shapes[][2] = {
        {1024, 512}, {1024, 1536}, {1536, 512}, {1536, 1536}, {2048, 512}, {2048, 1536},
        {1536, 576}, {1024, 1024}, {1024, 3072}, {3072, 1024},
    };
    for (const auto & shape : shapes) {
        const int n = shape[0];
        const int nc = shape[1];
        uint32_t state = 0xdead12adu ^ uint32_t(n + nc);
        std::vector<block_q4_Kx8> weights(size_t(n / QK_K) * size_t(nc / 8));
        std::vector<block_q8_K> activations(n / QK_K);
        std::vector<float> output(nc);
        for (auto & block : weights) {
            for (int c = 0; c < 8; ++c) {
                block.d[c] = ggml_fp32_to_fp16(float(c + 1) / 128.0f);
                block.dmin[c] = ggml_fp32_to_fp16(float(8 - c) / 256.0f);
            }
            for (auto & scale : block.scales) {
                scale = uint8_t(next_random(state));
            }
            for (auto & quant : block.qs) {
                quant = uint8_t(next_random(state));
            }
        }
        for (auto & block : activations) {
            block.d = 0.03125f;
            for (auto & quant : block.qs) {
                quant = int8_t(int(next_random(state) % 256) - 128);
            }
            for (int i = 0; i < QK_K / 16; ++i) {
                int sum = 0;
                for (int j = 0; j < 16; ++j) {
                    sum += block.qs[i * 16 + j];
                }
                block.bsums[i] = int16_t(sum);
            }
        }
        run_timed(false, n, nc, 32, weights, activations, output);
        run_timed(true, n, nc, 32, weights, activations, output);
        int iterations = 32;
        while (iterations < 1048576) {
            const double base_ms = run_timed(false, n, nc, iterations, weights, activations, output);
            const double candidate_ms = run_timed(true, n, nc, iterations, weights, activations, output);
            if (std::min(base_ms, candidate_ms) >= 100.0) {
                break;
            }
            iterations *= 2;
        }
        std::vector<double> ratios;
        if (!first_shape) {
            std::printf(",");
        }
        first_shape = false;
        std::printf("{\"n\":%d,\"columns\":%d,\"iterations\":%d,\"pairs\":[", n, nc, iterations);
        for (int pair = 0; pair < 8; ++pair) {
            double base_ms;
            double candidate_ms;
            if (pair % 2 == 0) {
                base_ms = run_timed(false, n, nc, iterations, weights, activations, output);
                candidate_ms = run_timed(true, n, nc, iterations, weights, activations, output);
            } else {
                candidate_ms = run_timed(true, n, nc, iterations, weights, activations, output);
                base_ms = run_timed(false, n, nc, iterations, weights, activations, output);
            }
            ratios.push_back(base_ms / candidate_ms);
            std::printf("%s{\"order\":\"%s\",\"baseline_ms\":%.6f,\"candidate_ms\":%.6f}",
                pair ? "," : "", pair % 2 == 0 ? "AB" : "BA", base_ms, candidate_ms);
            std::fflush(stdout);
        }
        std::printf("],\"median_baseline_over_candidate\":%.9f}", median(ratios));
    }
    std::printf("],\"checksum\":%.9g}\n", double(benchmark_checksum));
}

int main(int argc, char ** argv) {
    if (argc > 2 || (argc == 2 && std::strcmp(argv[1], "--benchmark"))) {
        std::fprintf(stderr, "Usage: engine-kernel-test [--benchmark]\n");
        return 2;
    }
    if (!devicebench_q4k_vnni_available()) {
        std::fprintf(stderr, "SKIP: compiled Q4_K VNNI implementation unavailable\n");
        return 77;
    }
    int cases = 0;
    int outputs = 0;
    const int lengths[] = {256, 512, 768, 1024, 1536, 2048, 4096};
    const int columns[] = {8, 16, 24, 64, 128};
    for (const int n : lengths) {
        for (const int nc : columns) {
            for (int pattern = 0; pattern < 25; ++pattern) {
                uint32_t state = 0x91a2504du ^ uint32_t(n + nc + pattern * 101);
                std::vector<block_q4_Kx8> weights(size_t(n / QK_K) * size_t(nc / 8));
                std::vector<block_q8_K> activations(n / QK_K);
                for (auto & block : weights) {
                    for (int c = 0; c < 8; ++c) {
                        block.d[c] = ggml_fp32_to_fp16(float(c + 1) / 128.0f);
                        block.dmin[c] = ggml_fp32_to_fp16(float(8 - c) / 256.0f);
                        if (pattern >= 13) {
                            const float scale = 1.0f + float(next_random(state) % 65537) / 65537.0f;
                            const float minimum = 1.0f + float(next_random(state) % 65521) / 65521.0f;
                            block.d[c] = ggml_fp32_to_fp16(std::ldexp(scale, int(next_random(state) % 15) - 12));
                            block.dmin[c] = ggml_fp32_to_fp16(std::ldexp(minimum, int(next_random(state) % 16) - 14));
                        }
                    }
                    for (auto & scale : block.scales) {
                        scale = pattern < 4 ? 0xff : uint8_t(next_random(state));
                    }
                    for (auto & quant : block.qs) {
                        quant = pattern == 0 ? 0 : pattern < 4 ? 0xff : uint8_t(next_random(state));
                    }
                }
                for (auto & block : activations) {
                    block.d = 0.03125f;
                    if (pattern >= 13) {
                        const float scale = 1.0f + float(next_random(state) % 65519) / 65519.0f;
                        const float sign = next_random(state) & 1 ? -1.0f : 1.0f;
                        block.d = sign * std::ldexp(scale, int(next_random(state) % 19) - 15);
                    }
                    for (int i = 0; i < QK_K; ++i) {
                        const int value = pattern == 0 ? 0 : pattern == 1 ? -128 :
                            pattern == 2 ? 127 : pattern == 3 ? (i % 2 ? 127 : -128) :
                            int(next_random(state) % 256) - 128;
                        block.qs[i] = int8_t(value);
                    }
                    for (int i = 0; i < QK_K / 16; ++i) {
                        int sum = 0;
                        for (int j = 0; j < 16; ++j) {
                            sum += block.qs[i * 16 + j];
                        }
                        block.bsums[i] = int16_t(sum);
                    }
                }
                const auto original_weights = weights;
                const auto original_activations = activations;
                // Offset output by one float: exercise unaligned stores and guard both ends.
                const float sentinel = 123456.0f;
                std::vector<float> baseline(nc + 2, sentinel);
                std::vector<float> candidate(nc + 2, sentinel);
                devicebench_q4k_kernel_test(false, n, baseline.data() + 1,
                    weights.data(), activations.data(), nc);
                devicebench_q4k_kernel_test(true, n, candidate.data() + 1,
                    weights.data(), activations.data(), nc);
                if (baseline.front() != sentinel || baseline.back() != sentinel ||
                    candidate.front() != sentinel || candidate.back() != sentinel) {
                    std::fprintf(stderr, "Output guard overwritten: n=%d nc=%d pattern=%d\n", n, nc, pattern);
                    return 1;
                }
                if (std::memcmp(weights.data(), original_weights.data(),
                        weights.size() * sizeof(weights[0])) ||
                    std::memcmp(activations.data(), original_activations.data(),
                        activations.size() * sizeof(activations[0]))) {
                    std::fprintf(stderr, "Input modified: n=%d nc=%d pattern=%d\n", n, nc, pattern);
                    return 1;
                }
                for (int i = 1; i <= nc; ++i) {
                    if (!std::isfinite(baseline[i]) || !std::isfinite(candidate[i]) ||
                        std::memcmp(&baseline[i], &candidate[i], sizeof(float))) {
                        std::fprintf(stderr,
                            "Mismatch n=%d nc=%d pattern=%d index=%d baseline=%a candidate=%a\n",
                            n, nc, pattern, i - 1, double(baseline[i]), double(candidate[i]));
                        return 1;
                    }
                    ++outputs;
                }
                ++cases;
            }
        }
    }
    std::printf("{\"cases\":%d,\"output_values\":%d,\"bitwise_equal\":true,"
        "\"input_unchanged\":true,\"output_guards_intact\":true}\n", cases, outputs);
    if (argc == 2) {
        run_benchmark();
    }
    return 0;
}
