#include "stage_options.h"

#include <algorithm>
#include <cstdlib>
#include <iostream>
#include <system_error>
#include <vector>

namespace openneko::stage {
namespace {

bool hasModelSuffix(const std::filesystem::path& path)
{
    const std::string name = path.filename().string();
    constexpr const char* suffix = ".model3.json";
    const std::size_t suffixLength = std::char_traits<char>::length(suffix);
    return name.size() >= suffixLength
        && name.compare(name.size() - suffixLength, suffixLength, suffix) == 0;
}

bool parseInteger(const std::string& value, int minimum, int maximum, int& output)
{
    try {
        std::size_t consumed = 0;
        const int parsed = std::stoi(value, &consumed);
        if (consumed != value.size() || parsed < minimum || parsed > maximum) {
            return false;
        }
        output = parsed;
        return true;
    } catch (...) {
        return false;
    }
}

std::optional<std::string> optionValue(int& index, int argc, char* argv[],
                                       const std::string& argument,
                                       const std::string& name)
{
    const std::string prefix = name + "=";
    if (argument.compare(0, prefix.size(), prefix) == 0) {
        return argument.substr(prefix.size());
    }
    if (argument == name && index + 1 < argc) {
        return std::string(argv[++index]);
    }
    return std::nullopt;
}

ModelSelection findModelInPath(const std::filesystem::path& source)
{
    std::error_code error;
    const std::filesystem::path absolute = std::filesystem::absolute(source, error);
    const std::filesystem::path resolved = error ? source : absolute;

    if (std::filesystem::is_regular_file(resolved, error)) {
        if (!hasModelSuffix(resolved)) {
            return {{}, {}, "model file must end with .model3.json: " + resolved.string()};
        }
        return {resolved.parent_path(), resolved.filename().string(), {}};
    }

    if (!std::filesystem::is_directory(resolved, error)) {
        return {{}, {}, "model path does not exist: " + resolved.string()};
    }

    std::vector<std::filesystem::path> matches;
    std::filesystem::recursive_directory_iterator iterator(
        resolved,
        std::filesystem::directory_options::skip_permission_denied,
        error);
    const std::filesystem::recursive_directory_iterator end;
    while (!error && iterator != end) {
        if (iterator.depth() > 4) {
            iterator.disable_recursion_pending();
        }
        if (iterator->is_regular_file(error) && hasModelSuffix(iterator->path())) {
            matches.push_back(iterator->path());
        }
        iterator.increment(error);
    }

    if (matches.empty()) {
        return {{}, {}, "no .model3.json found under: " + resolved.string()};
    }

    std::sort(matches.begin(), matches.end());
    return {matches.front().parent_path(), matches.front().filename().string(), {}};
}

} // namespace

ParseResult parseOptions(int argc, char* argv[])
{
    StageOptions options;

    for (int index = 1; index < argc; ++index) {
        const std::string argument(argv[index]);
        if (argument == "--help" || argument == "-h") {
            return {std::nullopt, {}, true};
        }
        if (argument == "--health-check") {
            options.healthCheck = true;
            continue;
        }
        if (argument == "--hidden") {
            options.hidden = true;
            continue;
        }
        if (argument == "--allow-no-model") {
            options.allowNoModel = true;
            continue;
        }
        if (argument == "--passthrough") {
            options.passthrough = true;
            continue;
        }

        if (const auto value = optionValue(index, argc, argv, argument, "--model")) {
            if (value->empty()) {
                return {std::nullopt, "--model requires a path", false};
            }
            options.modelPath = std::filesystem::path(*value);
            continue;
        }
        if (const auto value = optionValue(index, argc, argv, argument, "--frames")) {
            if (!parseInteger(*value, 1, 100000, options.frames)) {
                return {std::nullopt, "--frames must be between 1 and 100000", false};
            }
            continue;
        }
        if (const auto value = optionValue(index, argc, argv, argument, "--width")) {
            if (!parseInteger(*value, 64, 8192, options.width)) {
                return {std::nullopt, "--width must be between 64 and 8192", false};
            }
            continue;
        }
        if (const auto value = optionValue(index, argc, argv, argument, "--height")) {
            if (!parseInteger(*value, 64, 8192, options.height)) {
                return {std::nullopt, "--height must be between 64 and 8192", false};
            }
            continue;
        }

        return {std::nullopt, "unknown argument: " + argument, false};
    }

    return {options, {}, false};
}

void printUsage(std::ostream& output)
{
    output
        << "Usage: openneko-live2d-stage [options]\n"
        << "  --model PATH             Model directory or .model3.json file\n"
        << "  --width N --height N     Initial window size\n"
        << "  --hidden                 Create the window hidden\n"
        << "  --passthrough            Start with whole-window mouse passthrough\n"
        << "  --health-check           Render a bounded smoke test and exit\n"
        << "  --frames N               Frames rendered by --health-check (default: 3)\n"
        << "  --allow-no-model         Treat a missing model as degraded, not failed\n";
}

ModelSelection locateModel(const StageOptions& options,
                           const std::filesystem::path& executablePath)
{
    if (options.modelPath) {
        return findModelInPath(*options.modelPath);
    }

    if (const char* environmentModel = std::getenv("OPENNEKO_LIVE2D_MODEL")) {
        if (*environmentModel != '\0') {
            return findModelInPath(std::filesystem::path(environmentModel));
        }
    }

    std::vector<std::filesystem::path> candidates;
    std::error_code error;
    const auto executableAbsolute = std::filesystem::absolute(executablePath, error);
    if (!error && !executableAbsolute.parent_path().empty()) {
        candidates.push_back(executableAbsolute.parent_path() / "assets" / "live2d");
    }
    candidates.push_back(std::filesystem::current_path(error) / "assets" / "live2d");

    std::string lastError = "no Live2D model path configured";
    for (const auto& candidate : candidates) {
        std::error_code existsError;
        if (!std::filesystem::exists(candidate, existsError)) {
            continue;
        }
        ModelSelection selection = findModelInPath(candidate);
        if (selection.found()) {
            return selection;
        }
        lastError = selection.error;
    }

    return {{}, {}, lastError};
}

} // namespace openneko::stage

