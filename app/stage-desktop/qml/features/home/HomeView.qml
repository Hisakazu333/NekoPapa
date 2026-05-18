import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: root

    property var shellRef: null
    property real dockClearance: 122

    HomeStore { id: homeStore }
    readonly property var s: homeStore.state
    readonly property real designWidth: 735
    readonly property real designHeight: 944
    readonly property real widthCompactProgress: smoothStep((960 - width) / 160)
    readonly property real heightCompactProgress: smoothStep((860 - height) / 180)
    readonly property real aspectCompactProgress: smoothStep((1.08 - (width / Math.max(1, height))) / 0.22)
    readonly property real shapeCompactProgress: Math.max(widthCompactProgress, aspectCompactProgress)
    readonly property real compactProgress: Math.max(shapeCompactProgress, heightCompactProgress)
    readonly property real compactScale: Math.max(0.1, Math.min(1.35, width / designWidth, height / designHeight))
    readonly property real wideStageMaxWidth: 1240
    readonly property real wideLayoutWidth: Math.min(width, Math.max(wideStageMaxWidth, width - 120))
    readonly property real layoutWidth: mix(wideLayoutWidth, designWidth, shapeCompactProgress)
    readonly property real layoutHeight: mix(height, designHeight, compactProgress)
    readonly property real layoutScale: mix(1.0, compactScale, compactProgress)
    readonly property real avatarSafeHeight: Math.max(1, height - root.dockClearance - 150)
    readonly property real wideAvatarTargetHeight: Math.min(avatarSafeHeight, 880)
    readonly property real compactAvatarTargetHeight: Math.min(avatarSafeHeight, 708 * compactScale)
    readonly property real avatarTargetHeight: mix(wideAvatarTargetHeight, compactAvatarTargetHeight, compactProgress)
    readonly property real avatarBucket: 8
    readonly property real avatarRenderHeight: Math.max(1, Math.round(avatarTargetHeight / avatarBucket) * avatarBucket)
    readonly property real wideRailWidth: Math.min(Math.max(layoutWidth * 0.21, 230), 272)
    readonly property real railWidth: mix(wideRailWidth, 196, shapeCompactProgress)
    readonly property real rightRailWidth: mix(wideRailWidth, 180, shapeCompactProgress)
    readonly property real composerWidth: mix(Math.min(Math.max(layoutWidth * 0.62, 720), 940), 625, shapeCompactProgress)
    readonly property real wideComposerViewportWidth: Math.min(Math.max(width * 0.68, 620), Math.max(1, Math.min(980, width - 56)))
    readonly property real compactComposerViewportWidth: Math.min(Math.max(1, width - 56 * compactScale), 625 * compactScale)
    readonly property real composerViewportWidth: Math.round(mix(wideComposerViewportWidth, compactComposerViewportWidth, shapeCompactProgress))
    readonly property real composerHeight: Math.round(56 * compactScale)
    readonly property real wideAvatarStageWidth: Math.min(Math.max(avatarRenderHeight * 0.72, 620), 820)
    readonly property real compactAvatarStageWidth: Math.min(width / compactScale, designWidth, Math.max(520, avatarRenderHeight * 1.02))
    readonly property real avatarStageWidth: mix(wideAvatarStageWidth, compactAvatarStageWidth, compactProgress)
    readonly property real avatarRenderWidth: Math.max(1, Math.round(avatarStageWidth / avatarBucket) * avatarBucket)
    readonly property real modelRenderScale: Math.max(0.84,
        Math.min(1.08, mix(1.00, 0.94, compactProgress) * s.modelScaleFactor))
    readonly property real modelRenderOffsetX: s.modelOffsetXAdjust
    readonly property real modelRenderOffsetY: mix(0.04, 0.03, compactProgress) + s.modelOffsetYAdjust
    readonly property real avatarCenterOffsetY: mix(-46, -34, compactProgress)
    readonly property string clockIconPath: "M12 6v6l4 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
    readonly property string backgroundSource: "qrc:/qt/qml/OpenNeko/qml/assets/home/home-stage-room-cat-pillow.png"
    readonly property bool wideViewport: (width / Math.max(1, height)) > 1.18
    readonly property real focusSceneWidth: wideViewport ? Math.min(width, height * 1.06) : width
    readonly property real focusSceneEdge: Math.max(0, (width - focusSceneWidth) / 2)
    property date currentTime: new Date()

    Timer {
        interval: 30000
        repeat: true
        running: true
        onTriggered: root.currentTime = new Date()
    }

    function openModelAdjustDrawer() {
        homeStore.state.modelAdjustOpen = true
    }

    Item {
        anchors.fill: parent

        Image {
            id: environmentFill
            anchors.fill: parent
            source: root.backgroundSource
            fillMode: Image.PreserveAspectCrop
            horizontalAlignment: Image.AlignHCenter
            verticalAlignment: Image.AlignVCenter
            asynchronous: true
            cache: true
            smooth: true
            opacity: root.wideViewport ? 0.36 : 1.0
        }

        Rectangle {
            anchors.fill: parent
            visible: root.wideViewport
            color: Qt.rgba(0.93, 0.78, 0.66, 0.22)
        }

        Image {
            id: focusScene
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.horizontalCenter: parent.horizontalCenter
            width: root.focusSceneWidth
            source: root.backgroundSource
            fillMode: Image.PreserveAspectCrop
            horizontalAlignment: Image.AlignHCenter
            verticalAlignment: Image.AlignVCenter
            asynchronous: true
            cache: true
            smooth: true
            visible: true
        }

        Rectangle {
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            width: root.focusSceneEdge + 92
            visible: root.wideViewport
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: Qt.rgba(0.91, 0.75, 0.64, 0.54) }
                GradientStop { position: 0.62; color: Qt.rgba(0.91, 0.75, 0.64, 0.24) }
                GradientStop { position: 1.0; color: "transparent" }
            }
        }

        Rectangle {
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            width: root.focusSceneEdge + 92
            visible: root.wideViewport
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: "transparent" }
                GradientStop { position: 0.38; color: Qt.rgba(0.91, 0.75, 0.64, 0.24) }
                GradientStop { position: 1.0; color: Qt.rgba(0.91, 0.75, 0.64, 0.54) }
            }
        }

        Rectangle {
            anchors.fill: parent
            color: Theme.isDark ? Theme.alpha("bg.canvas", 0.66) : Qt.rgba(0.98, 0.91, 0.84, 0.13)
        }

        Rectangle {
            anchors.fill: parent
            gradient: Gradient {
                orientation: Gradient.Vertical
                GradientStop { position: 0.0; color: Theme.isDark ? Theme.alpha("bg.canvas", 0.52) : Qt.rgba(1.0, 0.92, 0.84, 0.16) }
                GradientStop { position: 0.48; color: "transparent" }
                GradientStop { position: 1.0; color: Theme.isDark ? Theme.alpha("bg.canvas", 0.34) : Qt.rgba(0.80, 0.56, 0.40, 0.18) }
            }
        }
    }

    HomeAvatarArea {
        id: avatarArea
        width: root.avatarRenderWidth
        height: root.avatarRenderHeight
        x: Math.round((root.width - width) / 2)
        y: Math.round((root.height - height) / 2 + root.avatarCenterOffsetY)
        modelScale: root.modelRenderScale
        modelOffsetX: root.modelRenderOffsetX
        modelOffsetY: root.modelRenderOffsetY
        projectionWidthHint: 0.0
        projectionHeightHint: 0.0
    }

    Item {
        id: layoutStage
        width: root.layoutWidth
        height: root.layoutHeight
        scale: root.layoutScale
        anchors.centerIn: parent
        transformOrigin: Item.Center

        Item {
            id: statusToolbar
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.leftMargin: root.mix(18, 30, root.compactProgress)
            anchors.topMargin: 14
            width: Math.min(statusRow.implicitWidth + 36, parent.width - root.mix(96, 118, root.compactProgress))
            height: 46

            NNAGlassPanel {
                anchors.fill: parent
                radius: statusToolbar.height / 2
                topLineMargin: 22
            }

            Row {
                id: statusRow
                anchors.centerIn: parent
                height: 28
                spacing: 26

                StagePill {
                    labelText: appController.currentModelPath !== "" ? appController.characterName + " 在场" : "准备舞台"
                    accentColor: appController.currentModelPath !== "" ? Theme.color("state.success") : Theme.color("state.warning")
                }

                StagePill {
                    labelText: moodLabel(appController.currentMood)
                    accentColor: Theme.color("accent.base")
                }

                StagePill {
                    labelText: "桌面在线"
                    accentColor: Theme.color("state.success")
                }

                StagePill {
                    labelText: Qt.formatTime(root.currentTime, "hh:mm")
                    accentColor: Theme.color("text.tertiary")
                    iconPath: root.clockIconPath
                    muted: true
                }
            }
        }

        Item {
            id: settingsButton
            width: 42
            height: 42
            anchors.top: parent.top
            anchors.right: parent.right
            anchors.topMargin: 14
            anchors.rightMargin: root.mix(18, 30, root.compactProgress)

            NNAGlassPanel {
                anchors.fill: parent
                radius: height / 2
                hovered: settingsMouse.containsMouse
                active: s.modelAdjustOpen
                fillColor: s.modelAdjustOpen
                    ? Theme.alpha("surface.float", Theme.isDark ? 0.94 : 0.96)
                    : Theme.alpha("surface.float",
                        Theme.isDark
                            ? (settingsMouse.containsMouse ? 0.92 : 0.90)
                            : (settingsMouse.containsMouse ? 0.94 : 0.92))
                borderColor: s.modelAdjustOpen ? Theme.alpha("accent.base", Theme.isDark ? 0.42 : 0.34) : Theme.alpha("line.soft", Theme.isDark ? 0.76 : 0.70)
                topLineMargin: 11
            }

            ShapeIcon {
                anchors.centerIn: parent
                pathData: Icons.settings
                size: 18
                iconColor: s.modelAdjustOpen ? Theme.color("accent.base") : Theme.color("text.secondary")
            }

            MouseArea {
                id: settingsMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: s.modelAdjustOpen = !s.modelAdjustOpen
            }
        }

        Column {
            id: leftRail
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.leftMargin: root.mix(28, 30, root.compactProgress)
            anchors.topMargin: root.mix(112, 132, root.compactProgress)
            width: root.railWidth
            spacing: 14

            GlassCard {
                width: parent.width
                titleText: s.dateText
                accentText: "\u5929\u6C14\u6674\u6717"

                Text {
                    width: parent.width - 40
                    text: s.greetingText + " " + appController.characterName
                    wrapMode: Text.WordWrap
                    font.pixelSize: 19
                    font.family: Theme.fontUi
                    font.weight: Font.Black
                    color: Theme.color("text.primary")
                }

                Text {
                    width: parent.width - 40
                    text: latestCompanionText()
                    wrapMode: Text.WordWrap
                    font.pixelSize: 12
                    font.family: Theme.fontUi
                    lineHeight: 1.4
                    color: Theme.color("text.secondary")
                }
            }

            GlassCard {
                width: parent.width
                titleText: "\u8EAB\u4F53\u72B6\u6001"

                MetricRow {
                    labelText: "\u9971\u98DF"
                    valueText: formatPercent(appController.satiety)
                    progress: appController.satiety / 100
                    accentColor: Theme.color("state.success")
                }

                MetricRow {
                    labelText: "\u6C34\u5206"
                    valueText: formatPercent(appController.hydration)
                    progress: appController.hydration / 100
                    accentColor: Theme.color("state.danger")
                }

                MetricRow {
                    labelText: "\u6D3B\u529B"
                    valueText: formatPercent(appController.energy)
                    progress: appController.energy / 100
                    accentColor: Theme.color("state.warning")
                }
            }

            GlassCard {
                width: parent.width
                titleText: "\u5173\u7CFB\u8282\u594F"

                PairMetric {
                    labelText: "\u8BB0\u5FC6\u6570"
                    valueText: String(appController.memoryCount)
                }

                PairMetric {
                    labelText: "\u4ECA\u65E5\u4E92\u52A8"
                    valueText: String(appController.interactionCount)
                }
            }
        }

        Column {
            id: rightRail
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.rightMargin: root.mix(28, 30, root.compactProgress)
            anchors.topMargin: 132
            width: root.rightRailWidth
            spacing: 14

            GlassCard {
                width: parent.width
                titleText: "\u5F53\u524D\u573A\u666F"
                accentText: appController.currentModelPath !== "" ? "\u5728\u573A" : "\u51C6\u5907\u4E2D"

                Text {
                    width: parent.width - 40
                    text: appController.currentModelPath !== "" ? appController.characterName + " \u6B63\u5728\u966A\u4F34\u4F60" : "\u6B63\u5728\u4E3A " + appController.characterName + " \u51C6\u5907\u821E\u53F0"
                    wrapMode: Text.WordWrap
                    font.pixelSize: 15
                    font.family: Theme.fontUi
                    font.weight: Font.DemiBold
                    color: Theme.color("text.primary")
                }

                StageSummary {
                    labelText: "\u821E\u53F0"
                    valueText: appController.currentModelPath !== "" ? "\u5DF2\u5C31\u7EEA" : "\u51C6\u5907\u4E2D"
                    accentColor: appController.currentModelPath !== "" ? Theme.color("state.success") : Theme.color("state.warning")
                }

                StageSummary {
                    labelText: "\u5FC3\u60C5"
                    valueText: moodLabel(appController.currentMood)
                    accentColor: Theme.color("accent.base")
                }

                StageSummary {
                    labelText: "\u4E92\u52A8"
                    valueText: String(appController.interactionCount)
                    accentColor: Theme.color("state.warning")
                }
            }

            GlassCard {
                width: parent.width
                titleText: "\u5FEB\u6377\u52A8\u4F5C"

                ActionRow {
                    iconPath: Icons.chat
                    titleText: "\u53BB\u5BF9\u8BDD"
                    subtitleText: "\u5207\u5230\u7EAF\u804A\u5929\u89C6\u56FE"
                    accentColor: Theme.color("accent.base")
                    onTriggered: root.switchToPage(1)
                }

                ActionRow {
                    iconPath: Icons.memory
                    titleText: "\u67E5\u8BB0\u5FC6"
                    subtitleText: "\u770B\u5173\u7CFB\u548C\u4E8B\u4EF6\u8F68\u8FF9"
                    accentColor: Theme.color("state.warning")
                    onTriggered: root.switchToPage(2)
                }

                ActionRow {
                    iconPath: Icons.settings
                    titleText: "\u540C\u6B65\u8BBE\u7F6E"
                    subtitleText: "\u8FDE\u63A5\u624B\u673A\u548C\u540E\u7AEF"
                    accentColor: Theme.color("state.success")
                    onTriggered: root.switchToPage(5)
                }
            }
        }

        Item {
            id: drawerDock
            width: 292
            height: 340
            anchors.top: parent.top
            anchors.right: parent.right
            anchors.topMargin: 74
            anchors.rightMargin: root.mix(18, 30, root.compactProgress)

            HomeModelAdjustDrawer {
                store: homeStore
            }
        }
    }

    HomeInputBar {
        id: composerShell
        z: 8
        width: root.composerViewportWidth
        height: root.composerHeight
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: root.dockClearance + 20 * root.compactScale
        store: homeStore
    }

    component StagePill: Item {
        id: stagePill
        property string labelText: ""
        property color accentColor: Theme.color("accent.base")
        property bool muted: false
        property string iconPath: ""

        implicitWidth: pillRow.implicitWidth
        implicitHeight: 28
        width: implicitWidth
        height: implicitHeight

        Row {
            id: pillRow
            anchors.centerIn: parent
            spacing: 9

            ShapeIcon {
                anchors.verticalCenter: parent.verticalCenter
                visible: stagePill.iconPath !== ""
                pathData: stagePill.iconPath
                size: 13
                strokeWidth: 2.0
                iconColor: Theme.color("text.tertiary")
            }

            Rectangle {
                anchors.verticalCenter: parent.verticalCenter
                visible: stagePill.iconPath === ""
                width: 8
                height: 8
                radius: 4
                color: stagePill.accentColor
            }

            Text {
                anchors.verticalCenter: parent.verticalCenter
                text: stagePill.labelText
                font.pixelSize: 13
                font.family: Theme.fontUi
                font.weight: Font.Medium
                renderType: Text.NativeRendering
                color: stagePill.muted ? Theme.color("text.tertiary") : Theme.color("text.secondary")
            }
        }
    }

    component GlassCard: Item {
        id: glassCard
        property string titleText: ""
        property string accentText: ""
        default property alias content: contentColumn.data

        implicitHeight: contentColumn.implicitHeight + root.mix(44, 40, root.compactProgress)
        height: implicitHeight
        clip: false

        NNAGlassPanel {
            anchors.fill: parent
            radius: 24
            topLineMargin: 18
        }

        Column {
            id: contentColumn
            anchors.fill: parent
            anchors.margins: 20
            spacing: 10

            Row {
                width: parent.width
                spacing: 8

                Text {
                    text: glassCard.titleText
                    font.pixelSize: 12
                    font.family: Theme.fontUi
                    font.weight: Font.DemiBold
                    color: Theme.color("text.secondary")
                }

                Text {
                    text: glassCard.accentText
                    font.pixelSize: 12
                    font.family: Theme.fontUi
                    font.weight: Font.DemiBold
                    color: Theme.color("accent.base")
                    visible: text !== ""
                }
            }
        }
    }

    component MetricRow: Item {
        id: metricRow
        property string labelText: ""
        property string valueText: ""
        property real progress: 0
        property color accentColor: Theme.color("accent.base")

        width: parent ? parent.width : 200
        implicitHeight: 40

        ColumnLayout {
            anchors.fill: parent
            spacing: 6

            RowLayout {
                Layout.fillWidth: true

                Text {
                    Layout.fillWidth: true
                    text: metricRow.labelText
                    font.pixelSize: 12
                    font.family: Theme.fontUi
                    color: Theme.color("text.secondary")
                }

                Text {
                    text: metricRow.valueText
                    font.pixelSize: 12
                    font.family: Theme.fontMono
                    font.weight: Font.Bold
                    color: Theme.color("text.primary")
                }
            }

            Rectangle {
                Layout.fillWidth: true
                height: 8
                radius: 4
                color: Theme.alpha("line.soft", Theme.isDark ? 0.46 : 0.78)

                Rectangle {
                    width: parent.width * Math.max(0, Math.min(1, metricRow.progress))
                    height: parent.height
                    radius: 4
                    color: Qt.rgba(metricRow.accentColor.r, metricRow.accentColor.g, metricRow.accentColor.b, Theme.isDark ? 0.86 : 0.82)
                }
            }
        }
    }

    component PairMetric: RowLayout {
        property string labelText: ""
        property string valueText: ""

        width: parent ? parent.width : 200

        Text {
            text: parent.labelText
            font.pixelSize: 12
            font.family: Theme.fontUi
            color: Theme.color("text.secondary")
        }

        Item { Layout.fillWidth: true }

        Text {
            text: parent.valueText
            font.pixelSize: 12
            font.family: Theme.fontMono
            font.weight: Font.Bold
            color: Theme.color("text.primary")
        }
    }

    component ActionRow: Item {
        id: actionRow
        property string iconPath: Icons.chat
        property string titleText: ""
        property string subtitleText: ""
        property color accentColor: Theme.color("accent.base")
        signal triggered()

        width: parent ? parent.width : 200
        height: 58

        NNAGlassPanel {
            anchors.fill: parent
            radius: 20
            hovered: actionMouse.containsMouse
            shadowOffset: 3
            shadowDarkOpacity: 0.12
            shadowLightOpacity: 0.030
            fillColor: Theme.alpha("surface.float",
                Theme.isDark
                    ? (actionMouse.containsMouse ? 0.90 : 0.82)
                    : (actionMouse.containsMouse ? 0.94 : 0.88))
            borderColor: actionMouse.containsMouse
                ? Qt.rgba(accentColor.r, accentColor.g, accentColor.b, Theme.isDark ? 0.42 : 0.28)
                : Theme.alpha("line.soft", Theme.isDark ? 0.54 : 0.50)
            topLineMargin: 14
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 10
            anchors.rightMargin: 10
            spacing: 12

            Rectangle {
                Layout.preferredWidth: 38
                Layout.preferredHeight: 38
                radius: 19
                color: Qt.rgba(actionRow.accentColor.r, actionRow.accentColor.g, actionRow.accentColor.b, Theme.isDark ? 0.26 : 0.14)

                ShapeIcon {
                    anchors.centerIn: parent
                    pathData: actionRow.iconPath
                    size: 16
                    iconColor: actionRow.accentColor
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2

                Text {
                    Layout.fillWidth: true
                    text: actionRow.titleText
                    font.pixelSize: 13
                    font.family: Theme.fontUi
                    font.weight: Font.DemiBold
                    color: Theme.color("text.primary")
                    elide: Text.ElideRight
                    maximumLineCount: 1
                }

                Text {
                    Layout.fillWidth: true
                    text: actionRow.subtitleText
                    font.pixelSize: 10
                    font.family: Theme.fontUi
                    color: Theme.color("text.tertiary")
                    elide: Text.ElideRight
                    maximumLineCount: 1
                }
            }
            Rectangle {
                Layout.preferredWidth: 18
                Layout.preferredHeight: 18
                radius: 9
                color: "transparent"

                ShapeIcon {
                    anchors.centerIn: parent
                    pathData: Icons.chevronRight
                    size: 11
                    iconColor: actionMouse.containsMouse ? actionRow.accentColor : Theme.color("text.tertiary")
                }
            }
        }

        MouseArea {
            id: actionMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: actionRow.triggered()
        }
    }

    component StageSummary: Item {
        id: stageSummary
        property string labelText: ""
        property string valueText: ""
        property color accentColor: Theme.color("accent.base")

        width: parent ? parent.width : 200
        height: 34

        NNAGlassPanel {
            anchors.fill: parent
            radius: 14
            shadowOffset: 2
            shadowDarkOpacity: 0.08
            shadowLightOpacity: 0.020
            fillColor: Theme.alpha("surface.float", Theme.isDark ? 0.78 : 0.86)
            borderColor: Theme.alpha("line.soft", Theme.isDark ? 0.50 : 0.46)
            topLineMargin: 9
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 10
            anchors.rightMargin: 10
            spacing: 8

            Rectangle {
                Layout.preferredWidth: 7
                Layout.preferredHeight: 7
                radius: 3.5
                color: stageSummary.accentColor
            }

            Text {
                text: stageSummary.labelText
                font.pixelSize: 11
                font.family: Theme.fontUi
                font.weight: Font.DemiBold
                color: Theme.color("text.tertiary")
            }

            Item { Layout.fillWidth: true }

            Text {
                text: stageSummary.valueText
                font.pixelSize: 12
                font.family: Theme.fontUi
                font.weight: Font.Bold
                color: Theme.color("text.primary")
            }
        }
    }

    function switchToPage(index) {
        if (shellRef)
            shellRef.currentPage = index
    }

    function latestCompanionText() {
        if (s.messages.length > 0)
            return s.messages[s.messages.length - 1].text
        return s.catSpeech
    }

    function moodLabel(mood) {
        if (mood === "happy")
            return "\u5F00\u5FC3"
        if (mood === "calm")
            return "\u5E73\u9759"
        if (mood === "excited")
            return "\u5174\u594B"
        return "\u966A\u4F34\u4E2D"
    }

    function formatPercent(value) {
        return Math.round(Math.max(0, Math.min(100, value))) + "%"
    }

    function clamp01(value) {
        return Math.max(0, Math.min(1, value))
    }

    function smoothStep(value) {
        var t = clamp01(value)
        return t * t * (3 - 2 * t)
    }

    function mix(from, to, progress) {
        return from + (to - from) * clamp01(progress)
    }

    function profileNumber(key, fallbackValue) {
        var value = live2dProfile ? live2dProfile[key] : undefined
        return typeof value === "number" && isFinite(value) ? value : fallbackValue
    }
}
