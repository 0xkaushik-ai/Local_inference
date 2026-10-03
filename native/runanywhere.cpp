// Pinned to the public RunAnywhere desktop kit 0.20.38 C headers.
#include <rac/core/rac_core.h>
#include <rac/desktop/rac_desktop.h>
#include <rac/backends/rac_llm_llamacpp.h>
#include <chrono>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <stdexcept>

using Clock = std::chrono::steady_clock;
double elapsed(Clock::time_point start) {
    return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}
std::string quote(const std::string& value) {
    std::string out = "\"";
    const char* hex = "0123456789abcdef";
    for (unsigned char c : value) {
        if (c == '"' || c == '\\') { out += '\\'; out += c; }
        else if (c < 32) { out += "\\u00"; out += hex[c >> 4]; out += hex[c & 15]; }
        else out += c;
    }
    return out + '"';
}
struct Stream {
    Clock::time_point start;
    double first = -1;
    std::string text;
    bool terminal = false;
};
rac_bool_t token(const char* text, rac_bool_t final, int32_t, void* opaque) {
    auto& stream = *static_cast<Stream*>(opaque);
    if (text && *text) {
        if (stream.first < 0) stream.first = elapsed(stream.start);
        stream.text += text;
    }
    if (final) stream.terminal = true;
    return RAC_TRUE;
}
void check(rac_result_t result, const char* operation) {
    if (result != RAC_SUCCESS)
        throw std::runtime_error(std::string(operation) + " failed, code " + std::to_string(result));
}
int main(int argc, char** argv) {
    rac_handle_t handle = nullptr;
    try {
        if (argc == 2 && std::string(argv[1]) == "--version") {
            std::cout << "{\"name\":\"RunAnywhere\",\"version\":" << quote(rac_sdk_get_version()) << "}\n";
            return 0;
        }
        if (argc != 6) throw std::runtime_error("Expected model, max_tokens, seed, threads, private state directory; prompt on stdin");
        std::ifstream file(argv[1], std::ios::binary);
        char magic[4] = {};
        file.read(magic, 4);
        if (std::string(magic, 4) != "GGUF") throw std::runtime_error("Model must be a readable GGUF file");
        const auto prompt = std::string(std::istreambuf_iterator<char>(std::cin), {});
        rac_platform_adapter_t adapter{};
        rac_desktop_adapter_config_t desktop{argv[5]};
        check(rac_desktop_adapter_init(&desktop, &adapter), "desktop init");
        rac_config_t config{};
        config.platform_adapter = &adapter;
        config.log_level = RAC_LOG_ERROR;
        check(rac_init(&config), "runtime init");
        // No HTTP transport, model downloads, cloud keys, or telemetry bootstrap.
        auto settings = RAC_LLM_LLAMACPP_CONFIG_DEFAULT;
        settings.context_size = 2048;
        settings.num_threads = std::stoi(argv[4]);
        settings.gpu_layers = 0;
        const auto load_start = Clock::now();
        check(rac_llm_llamacpp_create(argv[1], &settings, &handle), "model load");
        const double load_ms = elapsed(load_start);
        auto options = RAC_LLM_OPTIONS_DEFAULT;
        options.max_tokens = std::stoi(argv[2]);
        options.temperature = 0;
        options.seed = std::stoll(argv[3]);
        options.n_threads = settings.num_threads;
        options.streaming_enabled = RAC_TRUE;
        Stream stream{Clock::now()};
        check(rac_llm_llamacpp_generate_stream(handle, prompt.c_str(), &options, token, &stream), "generation");
        const double generation_ms = elapsed(stream.start);
        if (!stream.terminal) throw std::runtime_error("Missing terminal callback");
        rac_llm_token_counts_t counts{};
        check(rac_llm_llamacpp_get_stream_token_counts(handle, &counts), "token counts");
        std::cout << "{\"output\":" << quote(stream.text)
                  << ",\"first_content_ms\":" << (stream.first < 0 ? "null" : std::to_string(stream.first))
                  << ",\"generation_ms\":" << generation_ms
                  << ",\"runtime_load_ms\":" << load_ms
                  << ",\"output_tokens\":" << counts.completion_tokens
                  << ",\"input_tokens\":" << counts.prompt_tokens
                  << ",\"cached_prompt_tokens\":" << counts.cached_prompt_tokens << "}\n";
        rac_llm_llamacpp_destroy(handle);
        handle = nullptr;
        rac_shutdown();
        return 0;
    } catch (const std::exception& error) {
        if (handle) rac_llm_llamacpp_destroy(handle);
        rac_shutdown();
        std::cerr << error.what() << '\n';
        return 2;
    }
}
