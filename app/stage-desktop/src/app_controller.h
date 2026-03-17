#pragma once

#include <QObject>
#include <QTimer>
#include <QString>
#include <memory>
#include "nna/core/engine.h"

class NNAModelManager;

class NNAAppController : public QObject {
    Q_OBJECT

    // PAD
    Q_PROPERTY(float pleasure READ pleasure NOTIFY stateChanged)
    Q_PROPERTY(float arousal READ arousal NOTIFY stateChanged)
    Q_PROPERTY(float dominance READ dominance NOTIFY stateChanged)

    // Physiology
    Q_PROPERTY(float satiety READ satiety NOTIFY stateChanged)
    Q_PROPERTY(float hydration READ hydration NOTIFY stateChanged)
    Q_PROPERTY(float energy READ energy NOTIFY stateChanged)

    // Character
    Q_PROPERTY(QString characterName READ characterName NOTIFY stateChanged)
    Q_PROPERTY(QString accentColor READ accentColor NOTIFY stateChanged)
    Q_PROPERTY(QString currentMood READ currentMood NOTIFY stateChanged)

    // Summary
    Q_PROPERTY(int interactionCount READ interactionCount NOTIFY stateChanged)
    Q_PROPERTY(float affinityDelta READ affinityDelta NOTIFY stateChanged)
    Q_PROPERTY(int memoryCount READ memoryCount NOTIFY stateChanged)

    // Live2D model
    Q_PROPERTY(QString currentModelPath READ currentModelPath NOTIFY currentModelPathChanged)

public:
    explicit NNAAppController(QObject* parent = nullptr);
    ~NNAAppController() override;

    void setModelManager(NNAModelManager* manager);

    float pleasure() const;
    float arousal() const;
    float dominance() const;
    float satiety() const;
    float hydration() const;
    float energy() const;
    QString characterName() const;
    QString accentColor() const;
    QString currentMood() const;
    int interactionCount() const;
    float affinityDelta() const;
    int memoryCount() const;
    QString currentModelPath() const;

    Q_INVOKABLE void feedPet(const QString& foodType);
    Q_INVOKABLE void giveWater();
    Q_INVOKABLE void touchPet(float x, float y, float duration);
    Q_INVOKABLE void sendMessage(const QString& text);

signals:
    void stateChanged();
    void currentModelPathChanged();

private:
    nna::core::NNAEngine m_engine;
    QTimer m_tickTimer;
    NNAModelManager* m_modelManager = nullptr;
};
