/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna_model_manager.h"
#include <QCoreApplication>
#include <QDir>
#include <QSettings>
#include <QStandardPaths>
#include <QVariantMap>

NNAModelManager::NNAModelManager(QObject* parent)
    : QObject(parent)
{
    // assets/live2d/ next to the executable
    m_assetsDir = QCoreApplication::applicationDirPath() + "/assets/live2d";

    // User data directory for imported models
    QString dataDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    m_userModelsDir = dataDir + "/models";
    QDir().mkpath(m_userModelsDir);

    qDebug() << "[NNAModelManager] assetsDir:" << m_assetsDir;
    qDebug() << "[NNAModelManager] userModelsDir:" << m_userModelsDir;

    loadCurrentSelection();
    scanModels();

    qDebug() << "[NNAModelManager] models found:" << m_models.size();
    qDebug() << "[NNAModelManager] currentModelId:" << m_currentModelId;
    qDebug() << "[NNAModelManager] currentModelPath:" << currentModelPath();
}

QVariantList NNAModelManager::modelList() const {
    QVariantList list;
    for (const auto& m : m_models) {
        QVariantMap map;
        map["id"] = m.id;
        map["name"] = m.name;
        map["path"] = m.path;
        map["isPreset"] = m.isPreset;
        map["accentColor"] = m.accentColor;
        map["isCurrent"] = (m.id == m_currentModelId);
        list.append(map);
    }
    return list;
}

QString NNAModelManager::currentModelPath() const {
    for (const auto& m : m_models) {
        if (m.id == m_currentModelId) return m.path;
    }
    return {};
}

QString NNAModelManager::currentModelId() const {
    return m_currentModelId;
}

void NNAModelManager::refresh() {
    scanModels();
}

bool NNAModelManager::importModel(const QUrl& folderUrl) {
    QString srcPath = folderUrl.toLocalFile();
    QDir srcDir(srcPath);
    if (!srcDir.exists()) return false;

    // Verify it contains a .model3.json
    if (findModel3Json(srcPath).isEmpty()) return false;

    // Copy to user models directory
    QString folderName = srcDir.dirName();
    QString destPath = m_userModelsDir + "/" + folderName;

    // Avoid name collision
    int suffix = 1;
    while (QDir(destPath).exists()) {
        destPath = m_userModelsDir + "/" + folderName + "_" + QString::number(suffix++);
    }

    // Recursive copy
    QDir destDir(destPath);
    destDir.mkpath(".");

    std::function<bool(const QString&, const QString&)> copyDir;
    copyDir = [&copyDir](const QString& src, const QString& dst) -> bool {
        QDir srcD(src);
        QDir dstD(dst);
        dstD.mkpath(".");

        for (const auto& entry : srcD.entryInfoList(QDir::Files)) {
            if (!QFile::copy(entry.filePath(), dst + "/" + entry.fileName()))
                return false;
        }
        for (const auto& entry : srcD.entryInfoList(QDir::Dirs | QDir::NoDotAndDotDot)) {
            if (!copyDir(entry.filePath(), dst + "/" + entry.fileName()))
                return false;
        }
        return true;
    };

    if (!copyDir(srcPath, destPath)) return false;

    scanModels();
    return true;
}

bool NNAModelManager::removeModel(const QString& modelId) {
    for (const auto& m : m_models) {
        if (m.id == modelId) {
            if (m.isPreset) return false; // Cannot delete preset models

            QDir dir(m.path);
            if (!dir.removeRecursively()) return false;

            if (m_currentModelId == modelId) {
                m_currentModelId.clear();
                saveCurrentSelection();
                emit currentModelChanged();
            }

            scanModels();
            return true;
        }
    }
    return false;
}

void NNAModelManager::switchModel(const QString& modelId) {
    if (m_currentModelId == modelId) return;

    for (const auto& m : m_models) {
        if (m.id == modelId) {
            m_currentModelId = modelId;
            saveCurrentSelection();
            emit currentModelChanged();
            emit modelListChanged(); // isCurrent flags changed
            return;
        }
    }
}

void NNAModelManager::scanModels() {
    m_models.clear();
    scanDirectory(m_assetsDir, true);
    scanDirectory(m_userModelsDir, false);

    // Auto-select first model if nothing selected
    if (m_currentModelId.isEmpty() && !m_models.isEmpty()) {
        m_currentModelId = m_models.first().id;
        saveCurrentSelection();
        emit currentModelChanged();
    }

    emit modelListChanged();
}

void NNAModelManager::scanDirectory(const QString& dir, bool isPreset) {
    QDir baseDir(dir);
    if (!baseDir.exists()) return;

    for (const auto& entry : baseDir.entryInfoList(QDir::Dirs | QDir::NoDotAndDotDot)) {
        QString modelDir = entry.filePath();
        QString model3Json = findModel3Json(modelDir);

        // Check subdirectory "runtime/" (RUOYI model layout)
        if (model3Json.isEmpty()) {
            QString runtimeDir = modelDir + "/runtime";
            if (QDir(runtimeDir).exists()) {
                model3Json = findModel3Json(runtimeDir);
                if (!model3Json.isEmpty()) {
                    modelDir = runtimeDir;
                }
            }
        }

        if (model3Json.isEmpty()) continue;

        ModelEntry m;
        m.id = (isPreset ? "preset:" : "user:") + entry.fileName();
        m.name = entry.fileName();
        m.path = modelDir;
        m.isPreset = isPreset;
        m.accentColor = isPreset ? "#FF7AA2" : "#818CF8";
        m_models.append(m);
    }
}

QString NNAModelManager::findModel3Json(const QString& dir) const {
    QDir d(dir);
    QStringList files = d.entryList({"*.model3.json"}, QDir::Files);
    return files.isEmpty() ? QString() : files.first();
}

void NNAModelManager::saveCurrentSelection() {
    QSettings settings;
    settings.setValue("live2d/currentModelId", m_currentModelId);
}

void NNAModelManager::loadCurrentSelection() {
    QSettings settings;
    m_currentModelId = settings.value("live2d/currentModelId").toString();
}
