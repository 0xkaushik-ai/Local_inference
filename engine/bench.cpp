// Resident CPU experiment against a pinned upstream llama.cpp implementation.
#include "llama.h"
#include <nlohmann/json.hpp>
#include <algorithm>
#include <bit>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <limits>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <sys/resource.h>
#include <vector>

using json = nlohmann::ordered_json;
using Clock = std::chrono::steady_clock;

struct Options {
    std::string model;
    std::string logits;
    int threads = 4;
    int prompt_tokens = 128;
    int decode_tokens = 64;
    int repeats = 3;
    int warmups = 1;
    uint32_t sequence_seed = 42;
    bool profile = false;
    bool flash_attention = true;
    bool repack = true;
};

static int positive(const std::string & text, const std::string & name, bool allow_zero = false) {
    size_t end = 0;
    const long value = std::stol(text, &end);
    if (end != text.size() || value < (allow_zero ? 0 : 1) || value > 1000000) {
        throw std::runtime_error("Invalid value for " + name);
    }
    return static_cast<int>(value);
}

static Options parse(int argc, char ** argv) {
    Options out;
    for (int i = 1; i < argc; ++i) {
        const std::string key = argv[i];
        if (key == "--profile") { out.profile = true; continue; }
        if (key == "--help") {
            std::cout << "devicebench-engine --model FILE [--threads 4] [--prompt-tokens 128] "
                         "[--decode-tokens 64] [--repeats 3] [--warmups 1] "
                         "[--sequence-seed 42] [--flash-attention on|off] [--repack on|off] "
                         "[--profile | --logits FILE]\n";
            std::exit(0);
        }
        if (i + 1 == argc) throw std::runtime_error("Missing value for " + key);
        const std::string value = argv[++i];
        if (key == "--model") out.model = value;
        else if (key == "--logits") out.logits = value;
        else if (key == "--threads") out.threads = positive(value, key);
        else if (key == "--prompt-tokens") out.prompt_tokens = positive(value, key);
        else if (key == "--decode-tokens") out.decode_tokens = positive(value, key);
        else if (key == "--repeats") out.repeats = positive(value, key);
        else if (key == "--warmups") out.warmups = positive(value, key, true);
        else if (key == "--sequence-seed") {
            size_t end = 0;
            const auto seed = std::stoull(value, &end);
            if (value.empty() || value.front() == '-' || end != value.size() || seed > UINT32_MAX) {
                throw std::runtime_error("--sequence-seed requires an unsigned 32-bit integer");
            }
            out.sequence_seed = static_cast<uint32_t>(seed);
        }
        else if (key == "--flash-attention" || key == "--repack") {
            if (value != "on" && value != "off") throw std::runtime_error(key + " requires on or off");
            if (key == "--flash-attention") out.flash_attention = value == "on";
            else out.repack = value == "on";
        }
        else throw std::runtime_error("Unknown option " + key);
    }
    if (out.model.empty()) throw std::runtime_error("--model is required");
    if (out.prompt_tokens + out.decode_tokens > 2048) {
        throw std::runtime_error("prompt-tokens + decode-tokens must not exceed fixed context 2048");
    }
    if (out.profile && !out.logits.empty()) throw std::runtime_error("Use profile and logits in separate runs");
    return out;
}

static double milliseconds(Clock::time_point from, Clock::time_point to = Clock::now()) {
    return std::chrono::duration<double, std::milli>(to - from).count();
}

struct Counter { uint64_t calls = 0; double ms = 0; };
struct Profile {
    bool active = false;
    std::string phase;
    Clock::time_point start;
    std::map<std::string, Counter> counters;
    std::map<std::string, json> descriptions;
};

static bool profile_node(ggml_tensor * tensor, bool ask, void * opaque) {
    auto & profile = *static_cast<Profile *>(opaque);
    if (ask) {
        profile.start = Clock::now();
        return true; // Force a synchronization per graph node: diagnostic mode only.
    }
    const auto elapsed = milliseconds(profile.start);
    if (!profile.active) return true;
    json description = {
        {"phase", profile.phase}, {"op", ggml_op_name(tensor->op)},
        {"name", tensor->name}, {"type", ggml_type_name(tensor->type)},
        {"src0_type", tensor->src[0] ? ggml_type_name(tensor->src[0]->type) : "none"},
        {"shape", {tensor->ne[0], tensor->ne[1], tensor->ne[2], tensor->ne[3]}}
    };
    const std::string key = description.dump();
    auto & counter = profile.counters[key];
    ++counter.calls;
    counter.ms += elapsed;
    profile.descriptions.emplace(key, std::move(description));
    return true;
}

static std::vector<llama_token> inputs(const llama_vocab * vocab, int count, uint32_t seed) {
    std::vector<llama_token> candidates;
    for (llama_token id = 0; id < llama_vocab_n_tokens(vocab); ++id) {
        const auto attr = llama_vocab_get_attr(vocab, id);
        if (!llama_vocab_is_control(vocab, id) && !llama_vocab_is_eog(vocab, id) &&
            (attr & (LLAMA_TOKEN_ATTR_NORMAL | LLAMA_TOKEN_ATTR_BYTE))) candidates.push_back(id);
    }
    if (candidates.empty()) throw std::runtime_error("Model vocabulary has no normal or byte tokens");
    std::vector<llama_token> tokens;
    tokens.reserve(count);
    // Explicitly specified LCG: portable deterministic input, not natural-language quality data.
    for (int i = 0; i < count; ++i) {
        seed = seed * uint32_t{1664525} + uint32_t{1013904223};
        tokens.push_back(candidates[seed % candidates.size()]);
    }
    return tokens;
}

static void fill(llama_batch_ext * batch, const llama_token * tokens, int count, int start_pos) {
    llama_batch_ext_clear(batch);
    for (int i = 0; i < count; ++i) {
        const int index = llama_batch_ext_add_token(batch, 0, tokens[i]);
        const llama_pos pos = start_pos + i;
        if (index < 0 || !llama_batch_ext_set_pos(batch, index, &pos)) {
            throw std::runtime_error("Cannot add token to batch");
        }
    }
    if (!llama_batch_ext_set_output_logits(batch, count - 1, true)) {
        throw std::runtime_error("Cannot enable last-token logits");
    }
}

static void process(llama_context * context, llama_batch_ext * batch) {
    const int result = llama_process(context, LLAMA_PROCESS_TYPE_DECODE, batch);
    if (result != 0) throw std::runtime_error("llama_process failed with code " + std::to_string(result));
    llama_synchronize(context);
}

static const float * logits(llama_context * context) {
    const float * result = llama_get_logits_ith(context, -1);
    if (!result) throw std::runtime_error("Runtime returned no logits");
    return result;
}

static int greedy(llama_context * context, int vocab) {
    const float * row = logits(context);
    for (int i = 0; i < vocab; ++i) {
        if (!std::isfinite(row[i])) throw std::runtime_error("Non-finite model logits");
    }
    return static_cast<int>(std::max_element(row, row + vocab) - row);
}

static void write_logits(std::ofstream & stream, llama_context * context, int vocab) {
    static_assert(sizeof(float) == 4 && std::numeric_limits<float>::is_iec559);
    static_assert(std::endian::native == std::endian::little, "Logit export requires little-endian host");
    stream.write(reinterpret_cast<const char *>(logits(context)), static_cast<std::streamsize>(vocab) * 4);
    if (!stream) throw std::runtime_error("Cannot write logit capture");
}

static rusage usage() {
    rusage result{};
    if (getrusage(RUSAGE_SELF, &result) != 0) throw std::runtime_error("getrusage failed");
    return result;
}

int main(int argc, char ** argv) {
    try {
        const auto options = parse(argc, argv);
        // Runtime diagnostics must not corrupt the JSON evidence channel.
        llama_log_set([](ggml_log_level, const char * text, void *) { std::cerr << text; }, nullptr);
        llama_backend_init();
        struct BackendCleanup { ~BackendCleanup() { llama_backend_free(); } } cleanup;
        auto model_params = llama_model_default_params();
        model_params.n_gpu_layers = 0;
        model_params.use_extra_bufts = options.repack;
        const auto load_start = Clock::now();
        std::unique_ptr<llama_model, decltype(&llama_model_free)> model(
            llama_model_load_from_file(options.model.c_str(), model_params), llama_model_free);
        if (!model) throw std::runtime_error("Cannot load model");
        if (llama_model_has_encoder(model.get())) throw std::runtime_error("Only decoder-only models supported");
        const auto vocab = llama_model_get_vocab(model.get());
        const int vocab_count = llama_vocab_n_tokens(vocab);
        const auto tokens = inputs(vocab, options.prompt_tokens + options.decode_tokens, options.sequence_seed);
        Profile profile;
        auto params = llama_context_default_params();
        params.n_ctx = 2048;
        params.n_batch = options.prompt_tokens;
        params.n_ubatch = std::min(options.prompt_tokens, 512);
        params.n_seq_max = 1;
        params.n_threads = options.threads;
        params.n_threads_batch = options.threads;
        params.type_k = GGML_TYPE_F16;
        params.type_v = GGML_TYPE_F16;
        params.flash_attn_type = options.flash_attention ? LLAMA_FLASH_ATTN_TYPE_ENABLED : LLAMA_FLASH_ATTN_TYPE_DISABLED;
        params.offload_kqv = false;
        params.op_offload = false;
        params.no_perf = true;
        if (options.profile) { params.cb_eval = profile_node; params.cb_eval_user_data = &profile; }
        std::unique_ptr<llama_context, decltype(&llama_free)> context(
            llama_init_from_model(model.get(), params), llama_free);
        if (!context) throw std::runtime_error("Cannot create context");
        std::unique_ptr<llama_batch_ext, decltype(&llama_batch_ext_free)> batch(
            llama_batch_ext_init(context.get()), llama_batch_ext_free);
        if (!batch) throw std::runtime_error("Cannot create batch");
        const auto load_ms = milliseconds(load_start);
        std::ofstream capture;
        if (!options.logits.empty()) {
            capture.open(options.logits, std::ios::binary | std::ios::trunc);
            if (!capture) throw std::runtime_error("Cannot open logit output file");
        }
        const int repeats = options.logits.empty() ? options.repeats : 1;
        json rows = json::array();
        json top_ids = json::array();
        for (int trial = -options.warmups; trial < repeats; ++trial) {
            llama_synchronize(context.get());
            llama_memory_clear(llama_get_memory(context.get()), true);
            profile.active = trial >= 0;
            profile.phase = "prefill";
            const auto before = usage();
            fill(batch.get(), tokens.data(), options.prompt_tokens, 0);
            llama_synchronize(context.get());
            const auto prefill_start = Clock::now();
            process(context.get(), batch.get());
            const auto prefill_ms = milliseconds(prefill_start);
            const bool save = !options.logits.empty() && trial >= 0;
            if (save) {
                write_logits(capture, context.get(), vocab_count);
                top_ids.push_back(greedy(context.get(), vocab_count));
            }
            profile.phase = "decode";
            llama_synchronize(context.get());
            const auto decode_start = Clock::now();
            for (int step = 0; step < options.decode_tokens; ++step) {
                const int pos = options.prompt_tokens + step;
                fill(batch.get(), &tokens[pos], 1, pos);
                process(context.get(), batch.get());
                if (save) {
                    write_logits(capture, context.get(), vocab_count);
                    top_ids.push_back(greedy(context.get(), vocab_count));
                }
            }
            llama_synchronize(context.get());
            const auto decode_ms = milliseconds(decode_start);
            const auto after = usage();
            rows.push_back({
                {"phase", trial < 0 ? "warmup" : "measured"}, {"repeat", trial < 0 ? trial + options.warmups : trial},
                {"prefill_ms", prefill_ms}, {"decode_ms", decode_ms}, {"total_ms", prefill_ms + decode_ms},
                {"prefill_tokens", options.prompt_tokens}, {"decode_tokens", options.decode_tokens},
                {"peak_rss_kib", after.ru_maxrss}, {"minor_faults", after.ru_minflt - before.ru_minflt},
                {"major_faults", after.ru_majflt - before.ru_majflt}, {"last_greedy_token", greedy(context.get(), vocab_count)}
            });
        }
        if (capture.is_open()) {
            capture.close();
            if (!capture) throw std::runtime_error("Cannot finish logit output file");
        }
        char model_description[256]{};
        llama_model_desc(model.get(), model_description, sizeof(model_description));
        const char * candidate = std::getenv("DEVICEBENCH_Q4K_VNNI");
        json result = {
            {"schema_version", 1}, {"mode", options.profile ? "profile" : options.logits.empty() ? "benchmark" : "correctness"},
            {"timing_claims_allowed", !options.profile && options.logits.empty()},
            {"build", {{"upstream_revision", DEVICEBENCH_UPSTREAM_REVISION}, {"compiler", DEVICEBENCH_COMPILER},
                       {"build_type", DEVICEBENCH_BUILD_TYPE}, {"ggml_native", true}, {"system_info", llama_print_system_info()}}},
            {"settings", {{"model", options.model}, {"threads", llama_n_threads(context.get())},
                          {"threads_batch", llama_n_threads_batch(context.get())}, {"prompt_tokens", options.prompt_tokens},
                          {"decode_tokens", options.decode_tokens}, {"repeats", repeats}, {"warmups", options.warmups},
                          {"sequence_seed", options.sequence_seed}, {"n_ctx", llama_n_ctx(context.get())},
                          {"n_batch", llama_n_batch(context.get())}, {"n_ubatch", llama_n_ubatch(context.get())},
                          {"flash_attention", options.flash_attention}, {"kv_type", "f16"}, {"gpu_layers", 0}, {"no_perf", true},
                          {"cpu_repack", options.repack}, {"model_residency", "same model and context per process"},
                          {"candidate_env", {{"DEVICEBENCH_Q4K_VNNI", candidate ? candidate : "unset"}}}}},
            {"model", {{"description", model_description}, {"vocabulary_size", vocab_count}, {"load_and_context_ms", load_ms}}},
            {"input", {{"kind", "synthetic normal-or-byte token IDs; teacher forced, not sampled"},
                       {"prng", "uint32 LCG: state = 1664525 * state + 1013904223; candidates[state % size]"},
                       {"tokens", tokens}}},
            {"measurement", "Resident CPU only. KV cleared before every trial. Prefill includes one output-logit row. Decode includes one output-logit row per step, batch updates and synchronization; excludes sampling. Total is prefill + decode, excluding load, KV clearing and last-token inspection. Peak RSS is process lifetime high-water mark in KiB on Linux."},
            {"runs", rows}
        };
        if (options.profile) {
            result["profile_note"] = "Per-node scheduler callback forces subgraph splitting and synchronization, perturbing fusion and scheduling. Diagnostic attribution only; these timings cannot support a speed claim.";
            result["profile_ops"] = json::array();
            for (const auto & [key, counter] : profile.counters) {
                auto entry = profile.descriptions.at(key);
                entry["calls"] = counter.calls;
                entry["total_ms"] = counter.ms;
                result["profile_ops"].push_back(entry);
            }
        }
        if (!options.logits.empty()) {
            std::vector<int> positions;
            for (int pos = options.prompt_tokens - 1; pos < options.prompt_tokens + options.decode_tokens; ++pos) positions.push_back(pos);
            result["logits"] = {{"path", options.logits}, {"format", "float32-le"},
                                {"rows", options.decode_tokens + 1}, {"columns", vocab_count},
                                {"positions", positions}, {"greedy_top_ids", top_ids}};
            result["correctness_note"] = "Full vocabulary at last prompt position and every decode position. Logit capture and greedy checks perturb this separate run; timings are not comparable to benchmark mode.";
        }
        std::cout << result.dump(2) << '\n';
        return 0;
    } catch (const std::exception & error) {
        std::cerr << "devicebench-engine: " << error.what() << '\n';
        return 2;
    }
}
