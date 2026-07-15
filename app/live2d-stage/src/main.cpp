#include "stage_options.h"
#include "stage_runtime.h"

#include <nlohmann/json.hpp>

#include <exception>
#include <iostream>
#include <string>

namespace {

bool healthCheckRequested(int argc, char* argv[])
{
    for (int index = 1; index < argc; ++index) {
        if (std::string(argv[index]) == "--health-check") {
            return true;
        }
    }
    return false;
}

void emitArgumentFailure(const std::string& error)
{
    const nlohmann::json payload = {
        {"event", "health"},
        {"status", "failed"},
        {"error", "argument_error: " + error}
    };
    std::cout << payload.dump() << '\n' << std::flush;
}

} // namespace

int main(int argc, char* argv[])
{
    const bool requestedHealthCheck = healthCheckRequested(argc, argv);
    const auto parsed = openneko::stage::parseOptions(argc, argv);
    if (parsed.helpRequested) {
        openneko::stage::printUsage(std::cerr);
        return 0;
    }
    if (!parsed.options) {
        std::cerr << "[live2d-stage] " << parsed.error << '\n';
        if (requestedHealthCheck) {
            emitArgumentFailure(parsed.error);
        }
        return 2;
    }

    try {
        const auto model = openneko::stage::locateModel(*parsed.options, argv[0]);
        openneko::stage::StageRuntime runtime(*parsed.options, model);
        return runtime.run();
    } catch (const std::exception& exception) {
        std::cerr << "[live2d-stage] fatal: " << exception.what() << '\n';
        if (parsed.options->healthCheck) {
            const nlohmann::json payload = {
                {"event", "health"},
                {"status", "failed"},
                {"error", exception.what()}
            };
            std::cout << payload.dump() << '\n' << std::flush;
        }
        return 1;
    }
}

