#pragma once

#include <filesystem>
#include <iosfwd>
#include <optional>
#include <string>

namespace openneko::stage {

struct StageOptions {
    bool healthCheck = false;
    bool hidden = false;
    bool allowNoModel = false;
    bool passthrough = false;
    int frames = 3;
    int width = 735;
    int height = 944;
    std::optional<std::filesystem::path> modelPath;
};

struct ParseResult {
    std::optional<StageOptions> options;
    std::string error;
    bool helpRequested = false;
};

struct ModelSelection {
    std::filesystem::path directory;
    std::string fileName;
    std::string error;

    bool found() const { return !directory.empty() && !fileName.empty(); }
    std::filesystem::path fullPath() const { return directory / fileName; }
};

ParseResult parseOptions(int argc, char* argv[]);
void printUsage(std::ostream& output);
ModelSelection locateModel(const StageOptions& options,
                           const std::filesystem::path& executablePath);

} // namespace openneko::stage

