#include "app_controller.h"
#include "nna_model_manager.h"

#if NNA_HAS_CORE_NANO
#include "nna/c_api/nna_c_api.h"
#endif

#include <algorithm>
#include <cmath>
#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSettings>
#include <QStringList>
#include <QUrl>
#include <QUuid>

namespace {

QString firstNonEmpty(const QStringList& values) {
    for (const QString& value : values) {
        const QString trimmed = value.trimmed();
        if (!trimmed.isEmpty()) {
            return trimmed;
        }
    }
    return {};
}

QString jsonString(const QJsonObject& object, const QStringList& keys) {
    for (const QString& key : keys) {
        const QJsonValue value = object.value(key);
        if (value.isString()) {
            const QString trimmed = value.toString().trimmed();
            if (!trimmed.isEmpty()) {
                return trimmed;
            }
        }
    }
    return {};
}

bool jsonDoubleValue(const QJsonObject& object, const QStringList& keys, double* output) {
    for (const QString& key : keys) {
        const QJsonValue value = object.value(key);
        if (value.isDouble()) {
            *output = value.toDouble();
            return true;
        }
        if (value.isString()) {
            bool ok = false;
            const double parsed = value.toString().trimmed().toDouble(&ok);
            if (ok) {
                *output = parsed;
                return true;
            }
        }
    }
    return false;
}

int jsonInt(const QJsonObject& object, const QStringList& keys) {
    double number = 0.0;
    return jsonDoubleValue(object, keys, &number) ? static_cast<int>(number) : 0;
}

qint64 jsonInt64(const QJsonObject& object, const QStringList& keys) {
    for (const QString& key : keys) {
        const QJsonValue value = object.value(key);
        if (value.isDouble()) {
            return static_cast<qint64>(value.toDouble());
        }
        if (value.isString()) {
            bool ok = false;
            const qint64 parsed = value.toString().trimmed().toLongLong(&ok);
            if (ok) {
                return parsed;
            }
        }
    }
    return 0;
}

QJsonObject envelopeDataObject(const QJsonDocument& document) {
    if (!document.isObject()) {
        return {};
    }

    const QJsonObject object = document.object();
    const QJsonValue data = object.value(QStringLiteral("data"));
    if (data.isObject()) {
        return data.toObject();
    }
    return object;
}

void putIfNotEmpty(QJsonObject& object, const QString& key, const QString& value) {
    const QString trimmed = value.trimmed();
    if (!trimmed.isEmpty()) {
        object.insert(key, trimmed);
    }
}

QJsonObject readJsonObjectFile(const QString& path) {
    if (path.isEmpty()) {
        return {};
    }
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        return {};
    }
    const QByteArray raw = file.readAll();
    file.close();
    const QJsonDocument document = QJsonDocument::fromJson(raw);
    return document.isObject() ? document.object() : QJsonObject();
}

QString findMetadataFile(const QString& modelPath) {
    if (modelPath.isEmpty()) {
        return {};
    }
    const QFileInfo modelInfo(modelPath);
    const QStringList candidateRoots = {
        modelPath,
        modelInfo.dir().absolutePath()
    };
    const QStringList candidateFiles = {
        QStringLiteral("companion.json"),
        QStringLiteral("neko_companion.json"),
        QStringLiteral("mobile_payload.json"),
        QStringLiteral("desktop_payload.json")
    };
    for (const QString& root : candidateRoots) {
        for (const QString& fileName : candidateFiles) {
            const QString candidatePath = root + QLatin1Char('/') + fileName;
            if (QFileInfo::exists(candidatePath)) {
                return candidatePath;
            }
        }
    }
    return {};
}

QString shortenOptional(const QString& value, int maxLength) {
    const QString trimmed = value.trimmed();
    if (trimmed.isEmpty() || trimmed.size() > maxLength) {
        return {};
    }
    return trimmed;
}

double jsonNumberOr(const QJsonObject& object, const QStringList& keys, double fallback) {
    double value = fallback;
    return jsonDoubleValue(object, keys, &value) ? value : fallback;
}

QJsonObject childObject(const QJsonObject& object, const QString& key) {
    const QJsonValue value = object.value(key);
    return value.isObject() ? value.toObject() : QJsonObject();
}

QString characterNameForId(const QString& characterId) {
    if (characterId == QStringLiteral("Neko-01")) {
        return QStringLiteral("Lumia");
    }
    if (characterId == QStringLiteral("Neko-02")) {
        return QStringLiteral("Nyx");
    }
    if (characterId == QStringLiteral("Neko-03")) {
        return QStringLiteral("Aria");
    }
    if (characterId == QStringLiteral("Neko-04")) {
        return QStringLiteral("Lyra");
    }
    if (characterId == QStringLiteral("Neko-05")) {
        return QStringLiteral("Kana");
    }
    return characterId.trimmed().isEmpty() ? QStringLiteral("Lumia") : characterId.trimmed();
}

QString accentColorForId(const QString& characterId) {
    if (characterId == QStringLiteral("Neko-02")) {
        return QStringLiteral("#7C8BFF");
    }
    if (characterId == QStringLiteral("Neko-03")) {
        return QStringLiteral("#B66DFF");
    }
    if (characterId == QStringLiteral("Neko-04")) {
        return QStringLiteral("#56C7F2");
    }
    if (characterId == QStringLiteral("Neko-05")) {
        return QStringLiteral("#FF9F0A");
    }
    return QStringLiteral("#FF7AA2");
}

QString moodNameFromProjection(double moodScore, double pleasure) {
    if (moodScore >= 66.0 || pleasure > 0.20) {
        return QStringLiteral("happy");
    }
    if (moodScore >= 38.0 || pleasure > -0.15) {
        return QStringLiteral("calm");
    }
    return QStringLiteral("sad");
}

} // namespace

NNAAppController::NNAAppController(QObject* parent)
    : QObject(parent)
{
    loadSyncSettings();
    loadCachedAccountProfile();
    initializeCore();
    QSettings settings;
    m_desktopCompanionEnabled = settings.value(QStringLiteral("desktop/companionEnabled"), false).toBool();

    connect(&m_tickTimer, &QTimer::timeout, this, [this]() {
        tickCore(1.0f);
        emit stateChanged();
    });
    m_tickTimer.start(1000);
}

NNAAppController::~NNAAppController() {
#if !NNA_HAS_CORE_NANO
    m_engine.shutdown();
#endif
}

void NNAAppController::initializeCore() {
#if NNA_HAS_CORE_NANO
    nna_core_init();
    nna_core_init_assets(m_accountCoinBalance, m_accountFoodBalance, m_accountTreatBalance);
    if (m_accountUserId > 0) {
        const QByteArray userIdPayload = QByteArray::number(m_accountUserId);
        nna_core_dispatch("SET_USER_ID", userIdPayload.constData());
    }
    nna_core_dispatch("INIT_SOUL", "Neko-01");
    nna_core_update(0.016);
#else
    m_engine.init();
#endif
    refreshCoreState();
}

void NNAAppController::tickCore(float deltaSeconds) {
#if NNA_HAS_CORE_NANO
    nna_core_update(deltaSeconds);
#else
    m_engine.tick(deltaSeconds);
#endif
    refreshCoreState();
}

void NNAAppController::refreshCoreState() {
#if NNA_HAS_CORE_NANO
    const char* rawState = nna_core_get_app_state_json();
    if (!rawState) {
        return;
    }

    QJsonParseError parseError;
    const QJsonDocument document = QJsonDocument::fromJson(QByteArray(rawState), &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
        return;
    }

    const QJsonObject root = document.object();
    const QJsonObject soul = childObject(root, QStringLiteral("soul"));
    const QJsonObject cat = childObject(root, QStringLiteral("cat"));

    m_pleasure = static_cast<float>(std::clamp(
        jsonNumberOr(soul, {QStringLiteral("pleasure")}, m_pleasure), -1.0, 1.0));
    m_arousal = static_cast<float>(std::clamp(
        jsonNumberOr(soul, {QStringLiteral("arousal")}, m_arousal), -1.0, 1.0));
    m_dominance = static_cast<float>(std::clamp(
        jsonNumberOr(soul, {QStringLiteral("dominance")}, m_dominance), -1.0, 1.0));
    m_satiety = static_cast<float>(std::clamp(
        jsonNumberOr(soul, {QStringLiteral("hunger")}, jsonNumberOr(cat, {QStringLiteral("hunger")}, m_satiety)),
        0.0, 100.0));
    m_hydration = static_cast<float>(std::clamp(
        jsonNumberOr(soul, {QStringLiteral("hydration")}, jsonNumberOr(cat, {QStringLiteral("thirst")}, m_hydration)),
        0.0, 100.0));
    m_energy = static_cast<float>(std::clamp(
        jsonNumberOr(soul, {QStringLiteral("energy")}, jsonNumberOr(cat, {QStringLiteral("currentHp")}, m_energy)),
        0.0, 100.0));

    const QString characterId = jsonString(soul, {QStringLiteral("characterId")});
    m_characterName = characterNameForId(characterId);
    m_accentColor = accentColorForId(characterId);

    const double moodScore = jsonNumberOr(soul, {QStringLiteral("mood")}, jsonNumberOr(cat, {QStringLiteral("mood")}, 50.0));
    m_currentMood = moodNameFromProjection(moodScore, m_pleasure);

    const double affinity = jsonNumberOr(soul, {QStringLiteral("affinity")}, jsonNumberOr(cat, {QStringLiteral("affinity")}, 50.0));
    m_affinityDelta = static_cast<float>(std::clamp((affinity - 50.0) / 100.0, -1.0, 1.0));

    const double memoryStrength = jsonNumberOr(soul, {QStringLiteral("memoryStrength")}, 1.0);
    m_memoryCount = std::max(1, static_cast<int>(std::round(memoryStrength * 5.0)));
#else
    const auto& state = m_engine.getState();
    m_pleasure = state.pad.pleasure;
    m_arousal = state.pad.arousal;
    m_dominance = state.pad.dominance;
    m_satiety = state.physio.satiety;
    m_hydration = state.physio.hydration;
    m_energy = state.physio.energy;
    m_characterName = QString::fromStdString(state.character.name);
    m_accentColor = QString::fromStdString(state.character.accentColor);
    m_currentMood = QString::fromStdString(state.currentMood);
    m_interactionCount = state.interactionCount;
    m_affinityDelta = state.affinityDelta;
    m_memoryCount = state.memoryCount;
#endif
}

float NNAAppController::pleasure() const { return m_pleasure; }
float NNAAppController::arousal() const { return m_arousal; }
float NNAAppController::dominance() const { return m_dominance; }
float NNAAppController::satiety() const { return m_satiety; }
float NNAAppController::hydration() const { return m_hydration; }
float NNAAppController::energy() const { return m_energy; }

QString NNAAppController::characterName() const {
    return m_characterName;
}

QString NNAAppController::accentColor() const {
    return m_accentColor;
}

QString NNAAppController::currentMood() const {
    return m_currentMood;
}

int NNAAppController::interactionCount() const { return m_interactionCount; }
float NNAAppController::affinityDelta() const { return m_affinityDelta; }
int NNAAppController::memoryCount() const { return m_memoryCount; }

QString NNAAppController::currentModelPath() const {
    return m_modelManager ? m_modelManager->currentModelPath() : QString();
}

QString NNAAppController::syncBackendBaseUrl() const {
    return m_syncBackendBaseUrl;
}

QString NNAAppController::syncAuthToken() const {
    return m_syncAuthToken;
}

bool NNAAppController::syncBusy() const {
    return m_syncBusy;
}

QString NNAAppController::syncStatusText() const {
    return m_syncStatusText;
}

QString NNAAppController::syncLastError() const {
    return m_syncLastError;
}

bool NNAAppController::accountLoggedIn() const {
    return m_accountLoggedIn;
}

qint64 NNAAppController::accountUserId() const {
    return m_accountUserId;
}

QString NNAAppController::accountUserName() const {
    return m_accountUserName;
}

QString NNAAppController::accountAvatarUrl() const {
    return m_accountAvatarUrl;
}

QString NNAAppController::accountUserType() const {
    return m_accountUserType;
}

int NNAAppController::accountCoinBalance() const {
    return m_accountCoinBalance;
}

int NNAAppController::accountFoodBalance() const {
    return m_accountFoodBalance;
}

int NNAAppController::accountTreatBalance() const {
    return m_accountTreatBalance;
}

double NNAAppController::accountCloudPointBalance() const {
    return m_accountCloudPointBalance;
}

QString NNAAppController::accountLastSyncAt() const {
    return m_accountLastSyncAt;
}

bool NNAAppController::desktopCompanionEnabled() const {
    return m_desktopCompanionEnabled;
}

void NNAAppController::setDesktopCompanionEnabled(bool enabled) {
    if (m_desktopCompanionEnabled == enabled) {
        return;
    }
    m_desktopCompanionEnabled = enabled;
    QSettings settings;
    settings.setValue(QStringLiteral("desktop/companionEnabled"), m_desktopCompanionEnabled);
    settings.sync();
    emit desktopCompanionEnabledChanged();
}

void NNAAppController::feedPet(const QString& foodType) {
#if NNA_HAS_CORE_NANO
    const QString normalized = foodType.trimmed().toLower();
    QString subtype = QStringLiteral("food");
    if (normalized.contains(QStringLiteral("treat"))) {
        subtype = QStringLiteral("treat");
    } else if (normalized.contains(QStringLiteral("water"))) {
        subtype = QStringLiteral("water");
    }
    const QByteArray payload = QStringLiteral("feed,%1,1").arg(subtype).toUtf8();
    nna_core_dispatch("INTERACT", payload.constData());
    ++m_interactionCount;
#else
    m_engine.feedPet(foodType.toStdString());
#endif
    refreshCoreState();
    emit stateChanged();
}

void NNAAppController::giveWater() {
#if NNA_HAS_CORE_NANO
    nna_core_dispatch("INTERACT", "feed,water,1");
    ++m_interactionCount;
#else
    m_engine.giveWater();
#endif
    refreshCoreState();
    emit stateChanged();
}

void NNAAppController::touchPet(float x, float y, float duration) {
#if NNA_HAS_CORE_NANO
    Q_UNUSED(x)
    Q_UNUSED(duration)
    nna_core_dispatch("INTERACT", y > 0.62f ? "touch_belly" : "touch_head");
    ++m_interactionCount;
#else
    m_engine.touchPet(x, y, duration);
#endif
    refreshCoreState();
    emit stateChanged();
}

void NNAAppController::sendMessage(const QString& text) {
#if NNA_HAS_CORE_NANO
    Q_UNUSED(text)
    nna_core_dispatch("INTERACT", "message");
    ++m_interactionCount;
#else
    m_engine.sendMessage(text.toStdString());
#endif
    refreshCoreState();
    emit stateChanged();
}

void NNAAppController::setModelManager(NNAModelManager* manager) {
    m_modelManager = manager;
    if (m_modelManager) {
        connect(m_modelManager, &NNAModelManager::currentModelChanged,
                this, &NNAAppController::currentModelPathChanged);
    }
}

void NNAAppController::saveSyncSettings(const QString& baseUrl, const QString& token) {
    m_syncBackendBaseUrl = normalizeBaseUrl(baseUrl);
    m_syncAuthToken = token.trimmed();

    QSettings settings;
    settings.setValue(QStringLiteral("mobileSync/baseUrl"), m_syncBackendBaseUrl);
    settings.setValue(QStringLiteral("mobileSync/authToken"), m_syncAuthToken);
    settings.sync();

    emit syncSettingsChanged();
}

void NNAAppController::loginWithToken(const QString& baseUrl, const QString& token) {
    const QString normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const QString trimmedToken = token.trimmed();

    if (normalizedBaseUrl.isEmpty()) {
        m_syncLastError = QStringLiteral("Please enter the backend URL");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }
    if (trimmedToken.isEmpty()) {
        m_syncLastError = QStringLiteral("Please enter the account Bearer token");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }

    saveSyncSettings(normalizedBaseUrl, trimmedToken);
    refreshAccountProfile();
}

void NNAAppController::refreshAccountProfile() {
    if (m_syncBusy) {
        return;
    }

    const QString baseUrl = normalizeBaseUrl(m_syncBackendBaseUrl);
    const QString authHeader = normalizeAuthorizationValue(m_syncAuthToken);
    if (baseUrl.isEmpty()) {
        m_syncLastError = QStringLiteral("Please set the backend URL first");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }
    if (authHeader.isEmpty()) {
        m_syncLastError = QStringLiteral("Please log in with a Bearer token first");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }

    QNetworkRequest request(QUrl(baseUrl + QStringLiteral("/api/app/user/profile")));
    request.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    request.setRawHeader("Accept", "application/json");
    request.setRawHeader("Authorization", authHeader.toUtf8());

    m_syncBusy = true;
    m_syncLastError.clear();
    m_syncStatusText = QStringLiteral("Refreshing account profile...");
    emit syncStateChanged();

    QNetworkReply* reply = m_networkManager.get(request);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        const int httpStatus = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray raw = reply->readAll();
        const QJsonDocument document = QJsonDocument::fromJson(raw);
        const QJsonObject envelope = document.isObject() ? document.object() : QJsonObject();
        QString message = reply->error() == QNetworkReply::NoError
            ? QStringLiteral("Account profile refreshed")
            : reply->errorString();
        bool success = reply->error() == QNetworkReply::NoError
            && (httpStatus == 0 || (httpStatus >= 200 && httpStatus < 300));

        if (!envelope.isEmpty()) {
            if (envelope.value(QStringLiteral("msg")).isString()) {
                message = envelope.value(QStringLiteral("msg")).toString().trimmed();
            } else if (envelope.value(QStringLiteral("message")).isString()) {
                message = envelope.value(QStringLiteral("message")).toString().trimmed();
            }

            const QJsonValue codeValue = envelope.value(QStringLiteral("code"));
            if (codeValue.isDouble()) {
                const int code = codeValue.toInt();
                if (code != 0 && code != 200) {
                    success = false;
                }
            } else if (codeValue.isString()) {
                bool ok = false;
                const int code = codeValue.toString().trimmed().toInt(&ok);
                if (ok && code != 0 && code != 200) {
                    success = false;
                }
            }
        }

        m_syncBusy = false;
        if (success) {
            applyAccountProfile(envelopeDataObject(document));
            m_syncLastError.clear();
            m_syncStatusText = message.isEmpty()
                ? QStringLiteral("Account profile refreshed")
                : message;
        } else {
            if (httpStatus == 401 || httpStatus == 403) {
                clearAccountProfile(true);
            }
            m_syncStatusText.clear();
            m_syncLastError = message.isEmpty()
                ? QStringLiteral("Account profile refresh failed")
                : message;
        }
        emit syncStateChanged();
        reply->deleteLater();
    });
}

void NNAAppController::logoutAccount() {
    saveSyncSettings(m_syncBackendBaseUrl, QString());
    clearAccountProfile(true);
    m_syncLastError.clear();
    m_syncStatusText = QStringLiteral("Logged out");
    emit syncStateChanged();
}

void NNAAppController::pushCurrentCompanionToMobile() {
    if (m_syncBusy) {
        return;
    }
    if (!m_modelManager) {
        m_syncLastError = QStringLiteral("Model manager is not ready");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }

    const QString baseUrl = normalizeBaseUrl(m_syncBackendBaseUrl);
    const QString authHeader = normalizeAuthorizationValue(m_syncAuthToken);
    const QString modelPath = m_modelManager->currentModelPath().trimmed();
    const QString modelId = m_modelManager->currentModelId().trimmed();
    const QString modelName = m_modelManager->currentModelName().trimmed();
    const QString thumbnailUrl = m_modelManager->currentModelThumbnailUrl().trimmed();
    const QString metadataPath = findMetadataFile(modelPath);
    const QJsonObject metadata = readJsonObjectFile(metadataPath);

    if (baseUrl.isEmpty()) {
        m_syncLastError = QStringLiteral("Please set the mobile backend URL first");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }
    if (authHeader.isEmpty()) {
        m_syncLastError = QStringLiteral("Please set the mobile Bearer token first");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }
    if (modelPath.isEmpty()) {
        m_syncLastError = QStringLiteral("No current model is selected");
        m_syncStatusText.clear();
        emit syncStateChanged();
        return;
    }

    const QString displayName = firstNonEmpty({
        jsonString(metadata, {QStringLiteral("displayName"), QStringLiteral("name")}),
        modelName,
        characterName()
    });
    const QString promptText = jsonString(metadata, {
        QStringLiteral("promptText"),
        QStringLiteral("prompt"),
        QStringLiteral("persona"),
        QStringLiteral("systemPrompt")
    });
    const QString openingLine = jsonString(metadata, {
        QStringLiteral("openingLine"),
        QStringLiteral("openingMessage"),
        QStringLiteral("initialMessage"),
        QStringLiteral("firstMessage"),
        QStringLiteral("welcomeMessage"),
        QStringLiteral("welcome")
    });
    const QString loraModelId = jsonString(metadata, {
        QStringLiteral("loraModelId"),
        QStringLiteral("loraId"),
        QStringLiteral("loraAdapterId"),
        QStringLiteral("adapterId")
    });
    const QString portraitUrl = firstNonEmpty({
        jsonString(metadata, {
            QStringLiteral("portraitUrl"),
            QStringLiteral("avatarUrl"),
            QStringLiteral("coverUrl")
        }),
        shortenOptional(thumbnailUrl, 512)
    });

    QJsonObject mobilePayload;
    putIfNotEmpty(mobilePayload, QStringLiteral("displayName"), displayName);
    putIfNotEmpty(mobilePayload, QStringLiteral("name"), displayName);
    putIfNotEmpty(mobilePayload, QStringLiteral("portraitUrl"), portraitUrl);
    putIfNotEmpty(mobilePayload, QStringLiteral("coverUrl"), portraitUrl);
    putIfNotEmpty(mobilePayload, QStringLiteral("promptText"), promptText);
    putIfNotEmpty(mobilePayload, QStringLiteral("openingLine"), openingLine);
    putIfNotEmpty(mobilePayload, QStringLiteral("loraModelId"), loraModelId);

    QJsonObject desktopPayload;
    putIfNotEmpty(desktopPayload, QStringLiteral("displayName"), displayName);
    putIfNotEmpty(desktopPayload, QStringLiteral("name"), displayName);
    putIfNotEmpty(desktopPayload, QStringLiteral("characterName"), characterName());
    putIfNotEmpty(desktopPayload, QStringLiteral("modelId"), modelId);
    putIfNotEmpty(desktopPayload, QStringLiteral("modelPath"), modelPath);
    putIfNotEmpty(desktopPayload, QStringLiteral("thumbnailUrl"), thumbnailUrl);
    putIfNotEmpty(desktopPayload, QStringLiteral("metadataPath"), metadataPath);
    putIfNotEmpty(desktopPayload, QStringLiteral("promptText"), promptText);
    putIfNotEmpty(desktopPayload, QStringLiteral("openingLine"), openingLine);
    putIfNotEmpty(desktopPayload, QStringLiteral("loraModelId"), loraModelId);

    QByteArray assetBasis = modelId.toUtf8();
    assetBasis.append('|');
    assetBasis.append(modelPath.toUtf8());
    const QString assetCode = QStringLiteral("desktop_")
        + QString::fromLatin1(QCryptographicHash::hash(assetBasis, QCryptographicHash::Sha256).toHex().left(24));
    QByteArray payloadBasis = QJsonDocument(mobilePayload).toJson(QJsonDocument::Compact);
    payloadBasis.append('\n');
    payloadBasis.append(QJsonDocument(desktopPayload).toJson(QJsonDocument::Compact));
    const QString payloadHash = QString::fromLatin1(
        QCryptographicHash::hash(payloadBasis, QCryptographicHash::Sha256).toHex());

    QJsonObject requestBody;
    requestBody.insert(QStringLiteral("deviceId"), m_syncDeviceId);
    requestBody.insert(QStringLiteral("assetCode"), assetCode);
    requestBody.insert(QStringLiteral("assetName"), displayName.isEmpty() ? QFileInfo(modelPath).baseName() : displayName);
    requestBody.insert(QStringLiteral("payloadHash"), payloadHash);
    requestBody.insert(QStringLiteral("desktopAssetRef"),
                       firstNonEmpty({shortenOptional(modelId, 512), shortenOptional(QFileInfo(modelPath).baseName(), 512)}));
    const QString coverUrl = shortenOptional(portraitUrl, 512);
    if (!coverUrl.isEmpty()) {
        requestBody.insert(QStringLiteral("coverUrl"), coverUrl);
    }
    if (!mobilePayload.isEmpty()) {
        requestBody.insert(QStringLiteral("mobilePayload"), mobilePayload);
    }
    if (!desktopPayload.isEmpty()) {
        requestBody.insert(QStringLiteral("desktopPayload"), desktopPayload);
    }
    requestBody.insert(QStringLiteral("versionNo"), 1);

    QNetworkRequest request(QUrl(baseUrl + QStringLiteral("/api/desktop/companion/sync/push")));
    request.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    request.setRawHeader("Authorization", authHeader.toUtf8());

    m_syncBusy = true;
    m_syncLastError.clear();
    m_syncStatusText = QStringLiteral("Syncing current desktop companion to mobile...");
    emit syncStateChanged();

    QNetworkReply* reply = m_networkManager.post(request, QJsonDocument(requestBody).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        const int httpStatus = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray raw = reply->readAll();
        const QJsonDocument document = QJsonDocument::fromJson(raw);
        QString message = reply->error() == QNetworkReply::NoError
            ? QStringLiteral("Desktop companion sync completed")
            : reply->errorString();
        bool success = reply->error() == QNetworkReply::NoError;

        if (document.isObject()) {
            const QJsonObject object = document.object();
            if (object.value(QStringLiteral("msg")).isString()) {
                message = object.value(QStringLiteral("msg")).toString().trimmed();
            }
            const int code = object.value(QStringLiteral("code")).toInt(httpStatus);
            if (code != 200) {
                success = false;
                if (message.isEmpty() && object.value(QStringLiteral("message")).isString()) {
                    message = object.value(QStringLiteral("message")).toString().trimmed();
                }
            }
        }

        m_syncBusy = false;
        if (success) {
            m_syncLastError.clear();
            m_syncStatusText = message.isEmpty()
                ? QStringLiteral("Desktop companion has been synced to the mobile cloud queue")
                : message;
        } else {
            m_syncStatusText.clear();
            m_syncLastError = message.isEmpty()
                ? QStringLiteral("Desktop companion sync failed")
                : message;
        }
        emit syncStateChanged();
        reply->deleteLater();
    });
}

void NNAAppController::loadSyncSettings() {
    QSettings settings;
    m_syncBackendBaseUrl = normalizeBaseUrl(settings.value(QStringLiteral("mobileSync/baseUrl")).toString());
    m_syncAuthToken = settings.value(QStringLiteral("mobileSync/authToken")).toString().trimmed();
    m_syncDeviceId = settings.value(QStringLiteral("mobileSync/deviceId")).toString().trimmed();
    if (m_syncDeviceId.isEmpty()) {
        m_syncDeviceId = QStringLiteral("desktop_%1")
            .arg(QUuid::createUuid().toString(QUuid::WithoutBraces));
        settings.setValue(QStringLiteral("mobileSync/deviceId"), m_syncDeviceId);
        settings.sync();
    }
}

void NNAAppController::loadCachedAccountProfile() {
    QSettings settings;
    settings.beginGroup(QStringLiteral("account"));
    m_accountUserId = settings.value(QStringLiteral("userId"), 0).toLongLong();
    m_accountUserName = settings.value(QStringLiteral("userName")).toString();
    m_accountAvatarUrl = settings.value(QStringLiteral("avatarUrl")).toString();
    m_accountUserType = settings.value(QStringLiteral("userType")).toString();
    m_accountCoinBalance = settings.value(QStringLiteral("coinBalance"), 0).toInt();
    m_accountFoodBalance = settings.value(QStringLiteral("foodBalance"), 0).toInt();
    m_accountTreatBalance = settings.value(QStringLiteral("treatBalance"), 0).toInt();
    m_accountCloudPointBalance = settings.value(QStringLiteral("cloudPointBalance"), 0.0).toDouble();
    m_accountLastSyncAt = settings.value(QStringLiteral("lastSyncAt")).toString();
    settings.endGroup();

    m_accountLoggedIn = !m_syncAuthToken.isEmpty()
        && (m_accountUserId > 0 || !m_accountUserName.trimmed().isEmpty());
}

void NNAAppController::applyAccountProfile(const QJsonObject& profile) {
    if (profile.isEmpty()) {
        return;
    }

    const QJsonObject member = profile.value(QStringLiteral("member")).toObject();
    const QJsonObject cloudPoint = profile.value(QStringLiteral("cloudPoint")).toObject();

    m_accountLoggedIn = true;
    m_accountUserId = jsonInt64(profile, {
        QStringLiteral("userId"),
        QStringLiteral("id")
    });
    m_accountUserName = firstNonEmpty({
        jsonString(profile, {
            QStringLiteral("nickName"),
            QStringLiteral("nickname"),
            QStringLiteral("userName"),
            QStringLiteral("username"),
            QStringLiteral("name")
        }),
        m_accountUserName
    });
    m_accountAvatarUrl = jsonString(profile, {
        QStringLiteral("avatarUrl"),
        QStringLiteral("avatar"),
        QStringLiteral("headImgUrl")
    });
    m_accountUserType = firstNonEmpty({
        jsonString(profile, {
            QStringLiteral("userType"),
            QStringLiteral("memberLevel"),
            QStringLiteral("memberTier"),
            QStringLiteral("role")
        }),
        jsonString(member, {
            QStringLiteral("level"),
            QStringLiteral("tier"),
            QStringLiteral("name")
        })
    });
    m_accountCoinBalance = jsonInt(profile, {
        QStringLiteral("coins"),
        QStringLiteral("coinBalance"),
        QStringLiteral("coin")
    });
    m_accountFoodBalance = jsonInt(profile, {
        QStringLiteral("food"),
        QStringLiteral("foodBalance")
    });
    m_accountTreatBalance = jsonInt(profile, {
        QStringLiteral("treats"),
        QStringLiteral("treatBalance")
    });

    double cloudBalance = 0.0;
    if (!jsonDoubleValue(profile, {
        QStringLiteral("cloudPointBalance"),
        QStringLiteral("cloudBalance")
    }, &cloudBalance)) {
        jsonDoubleValue(cloudPoint, {
            QStringLiteral("balance"),
            QStringLiteral("cloudPointBalance")
        }, &cloudBalance);
    }
    m_accountCloudPointBalance = cloudBalance;
    m_accountLastSyncAt = QDateTime::currentDateTime().toString(Qt::ISODate);

    QSettings settings;
    settings.beginGroup(QStringLiteral("account"));
    settings.setValue(QStringLiteral("userId"), m_accountUserId);
    settings.setValue(QStringLiteral("userName"), m_accountUserName);
    settings.setValue(QStringLiteral("avatarUrl"), m_accountAvatarUrl);
    settings.setValue(QStringLiteral("userType"), m_accountUserType);
    settings.setValue(QStringLiteral("coinBalance"), m_accountCoinBalance);
    settings.setValue(QStringLiteral("foodBalance"), m_accountFoodBalance);
    settings.setValue(QStringLiteral("treatBalance"), m_accountTreatBalance);
    settings.setValue(QStringLiteral("cloudPointBalance"), m_accountCloudPointBalance);
    settings.setValue(QStringLiteral("lastSyncAt"), m_accountLastSyncAt);
    settings.endGroup();
    settings.sync();

#if NNA_HAS_CORE_NANO
    const QByteArray userIdPayload = QByteArray::number(m_accountUserId);
    nna_core_dispatch("SET_USER_ID", userIdPayload.constData());
#endif

    emit accountStateChanged();
}

void NNAAppController::clearAccountProfile(bool persist) {
    m_accountLoggedIn = false;
    m_accountUserId = 0;
    m_accountUserName.clear();
    m_accountAvatarUrl.clear();
    m_accountUserType.clear();
    m_accountCoinBalance = 0;
    m_accountFoodBalance = 0;
    m_accountTreatBalance = 0;
    m_accountCloudPointBalance = 0.0;
    m_accountLastSyncAt.clear();

    if (persist) {
        QSettings settings;
        settings.beginGroup(QStringLiteral("account"));
        settings.remove(QString());
        settings.endGroup();
        settings.sync();
    }

#if NNA_HAS_CORE_NANO
    nna_core_dispatch("SET_USER_ID", "0");
#endif

    emit accountStateChanged();
}

QString NNAAppController::normalizeBaseUrl(const QString& value) const {
    QString normalized = value.trimmed();
    while (normalized.endsWith(QLatin1Char('/'))) {
        normalized.chop(1);
    }
    return normalized;
}

QVariantList NNAAppController::recentMemories(int limit) {
    QVariantList list;
    list.append(QVariantMap({{"summary", QString::fromUtf8("\u4E00\u8D77\u770B\u4E86\u65E5\u843D")}, {"date", "2026-05-10"}, {"intensity", 0.8}}));
    list.append(QVariantMap({{"summary", QString::fromUtf8("\u4ECA\u5929\u7684\u65E9\u9910\u5F88\u597D\u5403")}, {"date", "2026-05-12"}, {"intensity", 0.5}}));
    list.append(QVariantMap({{"summary", QString::fromUtf8("\u804A\u4E86\u5F88\u4E45\u7684\u5929")}, {"date", "2026-05-13"}, {"intensity", 0.7}}));
    if (limit > 0 && limit < list.size()) list = list.mid(0, limit);
    return list;
}

QVariantList NNAAppController::dreamLogs(int limit) {
    QVariantList list;
    list.append(QVariantMap({{"date", "2026-05-14"}, {"content", QString::fromUtf8("\u68A6\u89C1\u4E86\u4E00\u7247\u6A31\u82B1\u6811\u6797\u2026")}, {"pad", "P:0.72 A:0.31"}}));
    list.append(QVariantMap({{"date", "2026-05-12"}, {"content", QString::fromUtf8("\u68A6\u89C1\u81EA\u5DF1\u5728\u4E91\u6735\u4E0A\u8DF3\u6765\u8DF3\u53BB\u2026")}, {"pad", "P:0.85 A:0.42"}}));
    if (limit > 0 && limit < list.size()) list = list.mid(0, limit);
    return list;
}

QVariantList NNAAppController::perceptionEvents(int limit) {
    QVariantList list;
    list.append(QVariantMap({{"source", QString::fromUtf8("\u89C6\u89C9")}, {"event", QString::fromUtf8("\u68C0\u6D4B\u5230\u7528\u6237\u9762\u90E8")}, {"time", "2s ago"}}));
    list.append(QVariantMap({{"source", QString::fromUtf8("\u58F0\u97F3")}, {"event", QString::fromUtf8("\u73AF\u5883\u566A\u97F3: 35dB")}, {"time", "5s ago"}}));
    if (limit > 0 && limit < list.size()) list = list.mid(0, limit);
    return list;
}

QVariantList NNAAppController::iotDevices() {
    QVariantList list;
    list.append(QVariantMap({{"name", QString::fromUtf8("\u667A\u80FD\u706F\u5E26")}, {"connected", true}, {"value", QString::fromUtf8("\u6A59\u8272")}}));
    list.append(QVariantMap({{"name", QString::fromUtf8("\u98CE\u6247")}, {"connected", true}, {"value", "60%"}}));
    list.append(QVariantMap({{"name", QString::fromUtf8("\u6E29\u5EA6\u8BA1")}, {"connected", false}, {"value", "--"}}));
    return list;
}

QVariantList NNAAppController::availableTools() {
    QVariantList list;
    list.append(QVariantMap({{"name", "Web Search"}, {"desc", QString::fromUtf8("\u5728\u7F51\u4E0A\u641C\u7D22\u4FE1\u606F")}, {"enabled", true}}));
    list.append(QVariantMap({{"name", "File Read"}, {"desc", QString::fromUtf8("\u8BFB\u53D6\u672C\u5730\u6587\u4EF6")}, {"enabled", false}}));
    list.append(QVariantMap({{"name", "System Info"}, {"desc", QString::fromUtf8("\u83B7\u53D6\u7CFB\u7EDF\u4FE1\u606F")}, {"enabled", true}}));
    return list;
}

QStringList NNAAppController::memoryTags() {
    return QStringList()
        << QString::fromUtf8("\u5168\u90E8")
        << QString::fromUtf8("\u9AD8\u5174")
        << QString::fromUtf8("\u96BE\u8FC7")
        << QString::fromUtf8("\u91CD\u8981")
        << QString::fromUtf8("\u65E5\u5E38");
}

QString NNAAppController::normalizeAuthorizationValue(const QString& value) const {
    const QString normalized = value.trimmed();
    if (normalized.isEmpty()) {
        return {};
    }
    if (normalized.startsWith(QStringLiteral("Bearer "), Qt::CaseInsensitive)) {
        return normalized;
    }
    return QStringLiteral("Bearer ") + normalized;
}
