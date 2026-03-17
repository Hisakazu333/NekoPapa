/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <QObject>
#include <QVariantList>
#include <QString>
#include <QUrl>

class NNAModelManager : public QObject {
    Q_OBJECT
    Q_PROPERTY(QVariantList modelList READ modelList NOTIFY modelListChanged)
    Q_PROPERTY(QString currentModelPath READ currentModelPath NOTIFY currentModelChanged)
    Q_PROPERTY(QString currentModelId READ currentModelId NOTIFY currentModelChanged)

public:
    explicit NNAModelManager(QObject* parent = nullptr);

    QVariantList modelList() const;
    QString currentModelPath() const;
    QString currentModelId() const;

    Q_INVOKABLE void refresh();
    Q_INVOKABLE bool importModel(const QUrl& folderUrl);
    Q_INVOKABLE bool removeModel(const QString& modelId);
    Q_INVOKABLE void switchModel(const QString& modelId);

signals:
    void modelListChanged();
    void currentModelChanged();

private:
    struct ModelEntry {
        QString id;
        QString name;
        QString path;       // absolute path to model directory
        bool isPreset;      // true = bundled in assets, cannot delete
        QString accentColor;
    };

    void scanModels();
    void scanDirectory(const QString& dir, bool isPreset);
    QString findModel3Json(const QString& dir) const;
    void saveCurrentSelection();
    void loadCurrentSelection();

    QList<ModelEntry> m_models;
    QString m_currentModelId;
    QString m_assetsDir;
    QString m_userModelsDir;
};
