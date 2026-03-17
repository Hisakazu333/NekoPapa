#include "app_controller.h"
#include "nna_model_manager.h"

NNAAppController::NNAAppController(QObject* parent)
    : QObject(parent)
{
    m_engine.init();

    connect(&m_tickTimer, &QTimer::timeout, this, [this]() {
        m_engine.tick(1.0f);
        emit stateChanged();
    });
    m_tickTimer.start(1000); // 1 Hz tick
}

NNAAppController::~NNAAppController() {
    m_engine.shutdown();
}

float NNAAppController::pleasure() const { return m_engine.getState().pad.pleasure; }
float NNAAppController::arousal() const { return m_engine.getState().pad.arousal; }
float NNAAppController::dominance() const { return m_engine.getState().pad.dominance; }
float NNAAppController::satiety() const { return m_engine.getState().physio.satiety; }
float NNAAppController::hydration() const { return m_engine.getState().physio.hydration; }
float NNAAppController::energy() const { return m_engine.getState().physio.energy; }

QString NNAAppController::characterName() const {
    return QString::fromStdString(m_engine.getState().character.name);
}

QString NNAAppController::accentColor() const {
    return QString::fromStdString(m_engine.getState().character.accentColor);
}

QString NNAAppController::currentMood() const {
    return QString::fromStdString(m_engine.getState().currentMood);
}

int NNAAppController::interactionCount() const { return m_engine.getState().interactionCount; }
float NNAAppController::affinityDelta() const { return m_engine.getState().affinityDelta; }
int NNAAppController::memoryCount() const { return m_engine.getState().memoryCount; }

void NNAAppController::feedPet(const QString& foodType) {
    m_engine.feedPet(foodType.toStdString());
    emit stateChanged();
}

void NNAAppController::giveWater() {
    m_engine.giveWater();
    emit stateChanged();
}

void NNAAppController::touchPet(float x, float y, float duration) {
    m_engine.touchPet(x, y, duration);
    emit stateChanged();
}

void NNAAppController::sendMessage(const QString& text) {
    m_engine.sendMessage(text.toStdString());
    emit stateChanged();
}

void NNAAppController::setModelManager(NNAModelManager* manager) {
    m_modelManager = manager;
    if (m_modelManager) {
        connect(m_modelManager, &NNAModelManager::currentModelChanged,
                this, &NNAAppController::currentModelPathChanged);
    }
}

QString NNAAppController::currentModelPath() const {
    return m_modelManager ? m_modelManager->currentModelPath() : QString();
}
