#pragma once

#include "stage_options.h"

#include <memory>

namespace openneko::stage {

class StageRuntime {
public:
    StageRuntime(StageOptions options, ModelSelection model);
    ~StageRuntime();

    StageRuntime(const StageRuntime&) = delete;
    StageRuntime& operator=(const StageRuntime&) = delete;

    int run();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace openneko::stage

