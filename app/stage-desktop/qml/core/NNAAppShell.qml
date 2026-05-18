import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Shapes
import NNA.Core 1.0

Item {
    id: shell

    property int currentPage: 0
    readonly property real designWidth: 735
    readonly property real designHeight: 944
    readonly property real stageAspect: designWidth / designHeight
    readonly property real fittedStageWidth: Math.min(width, height * stageAspect)
    readonly property real fittedStageHeight: Math.min(height, width / stageAspect)
    readonly property real stageWidth: Math.round(fittedStageWidth)
    readonly property real stageHeight: Math.round(fittedStageHeight)
    readonly property real stageX: Math.round((width - stageWidth) / 2)
    readonly property real stageY: Math.round((height - stageHeight) / 2)
    readonly property real stageScale: Math.max(0.82, Math.min(1.35, stageWidth / designWidth, stageHeight / designHeight))
    readonly property real widthCompactProgress: smoothStep((960 - width) / 160)
    readonly property real heightCompactProgress: smoothStep((860 - height) / 180)
    readonly property real aspectCompactProgress: smoothStep((1.08 - (width / Math.max(1, height))) / 0.22)
    readonly property real shapeCompactProgress: Math.max(widthCompactProgress, aspectCompactProgress)
    readonly property real compactProgress: Math.max(shapeCompactProgress, heightCompactProgress)
    readonly property real compactScale: Math.max(0.1, Math.min(1.0, width / designWidth, height / designHeight))
    readonly property real layoutWidth: mix(width, designWidth, shapeCompactProgress)
    readonly property real layoutHeight: mix(height, designHeight, compactProgress)
    readonly property real layoutScale: mix(1.0, compactScale, compactProgress)
    readonly property real dockAvailableWidth: Math.max(1, stageWidth - 28 * stageScale)
    readonly property real dockWidth: Math.round(Math.min(dockAvailableWidth, 505 * stageScale))
    readonly property real dockHeight: Math.round(62 * stageScale)
    readonly property real dockBottomMargin: Math.round(10 * stageScale)
    readonly property real dockRadius: Math.round(dockHeight * 0.40)

    readonly property var navItems: [
        { label: "\u966A\u4F34", icon: Icons.paw, paw: true },
        { label: "\u5BF9\u8BDD", icon: Icons.chat },
        { label: "\u8BB0\u5FC6", icon: Icons.memory },
        { label: "\u4E16\u754C", icon: Icons.world },
        { label: "Agent", icon: Icons.ability },
        { label: "\u6211\u7684", icon: Icons.character }
    ]

    readonly property bool overlayPanelOpen: currentPage !== 0 && currentPage !== 1 && currentPage !== 4 && currentPage !== 5

    Rectangle {
        anchors.fill: parent
        color: Theme.color("bg.canvas")
    }

    Item {
        id: homeStage
        anchors.fill: parent
        visible: shell.currentPage !== 1 && shell.currentPage !== 5
        clip: true

        HomeView {
            id: homeView
            anchors.fill: parent
            shellRef: shell
            dockClearance: shell.dockHeight + shell.dockBottomMargin + 12 * shell.stageScale
        }
    }

    ChatView {
        id: chatView
        anchors.fill: parent
        dockClearance: shell.dockHeight + shell.dockBottomMargin + 12
        visible: shell.currentPage === 1
        opacity: visible ? 1 : 0

        Behavior on opacity { NumberAnimation { duration: 180 } }
    }

    NNAMineView {
        id: mineView
        anchors.fill: parent
        dockClearance: shell.dockHeight + shell.dockBottomMargin + 12
        visible: shell.currentPage === 5
        opacity: visible ? 1 : 0

        Behavior on opacity { NumberAnimation { duration: 180 } }
    }

    Rectangle {
        anchors.fill: parent
        visible: overlayPanelOpen
        color: Theme.alpha("overlay.scrim", Theme.isDark ? 0.32 : 0.12)
        opacity: overlayPanelOpen ? 1 : 0

        Behavior on opacity { NumberAnimation { duration: 180 } }

        MouseArea {
            anchors.fill: parent
            onClicked: shell.currentPage = 0
        }
    }

    Rectangle {
        id: workspacePanel
        width: panelWidth(shell.currentPage)
        height: parent.height - 128
        x: overlayPanelOpen ? parent.width - width - 28 : parent.width + 40
        y: 34
        radius: 34
        color: Theme.alpha("surface.base", Theme.isDark ? 0.96 : 0.95)
        border.color: Theme.alpha("line.soft", 0.80)
        border.width: 1
        opacity: overlayPanelOpen ? 1 : 0
        visible: opacity > 0
        clip: true

        Behavior on x { NumberAnimation { duration: 240; easing.type: Easing.OutCubic } }
        Behavior on opacity { NumberAnimation { duration: 180 } }

        Rectangle {
            anchors.fill: parent
            gradient: Gradient {
                orientation: Gradient.Vertical
                GradientStop { position: 0.0; color: Theme.alpha("surface.raised", Theme.isDark ? 0.88 : 0.96) }
                GradientStop { position: 1.0; color: Theme.alpha("surface.base", Theme.isDark ? 0.96 : 0.98) }
            }
        }

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 18
            spacing: 14

            RowLayout {
                Layout.fillWidth: true
                Layout.preferredHeight: 56

                Text {
                    Layout.fillWidth: true
                    text: panelTitle(shell.currentPage)
                    font.pixelSize: 24
                    font.family: Theme.fontUi
                    font.weight: Font.Black
                    color: Theme.color("text.primary")
                }

                Rectangle {
                    width: 40
                    height: 40
                    radius: 20
                    color: Theme.alpha("surface.sunken", Theme.isDark ? 0.58 : 0.76)
                    border.color: Theme.alpha("line.soft", 0.72)
                    border.width: 1

                    ShapeIcon {
                        anchors.centerIn: parent
                        pathData: Icons.close
                        size: 15
                        iconColor: Theme.color("text.secondary")
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: shell.currentPage = 0
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: 26
                color: Theme.alpha("surface.raised", Theme.isDark ? 0.82 : 0.94)
                border.color: Theme.alpha("line.soft", 0.76)
                border.width: 1
                clip: true

                StackLayout {
                    anchors.fill: parent
                    currentIndex: panelIndex(shell.currentPage)

                    ChatView {}
                    SoulView {}
                    WorldView {}
                }
            }
        }
    }

    Item {
        id: dockStage
        z: 20
        x: shell.stageX
        y: shell.stageY
        width: shell.stageWidth
        height: shell.stageHeight

        Item {
            id: dockFrame

            width: shell.dockWidth
            height: shell.dockHeight
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottom: parent.bottom
            anchors.bottomMargin: shell.dockBottomMargin

            NNAMacOSDockView {
                id: nativeDock
                anchors.fill: parent
                currentPage: shell.currentPage
                radius: shell.dockRadius
                dark: Theme.isDark
                property real frameSyncKey: shell.width
                    + shell.height
                    + dockStage.x
                    + dockStage.y
                    + dockStage.width
                    + dockStage.height
                    + dockFrame.x
                    + dockFrame.y
                    + dockFrame.width
                    + dockFrame.height
                    + dockFrame.anchors.bottomMargin
                onFrameSyncKeyChanged: refreshNativeFrame()
                onPageRequested: function(page) { shell.currentPage = page }
                onMenuActionRequested: function(page, action) { shell.handleDockMenuAction(page, action) }
            }

            Rectangle {
                id: dock
                anchors.fill: parent
                visible: !nativeDock.nativeActive
                radius: nativeDock.radius
                color: Theme.alpha("surface.float", Theme.isDark ? 0.90 : 0.92)
                border.color: Theme.alpha("line.soft", Theme.isDark ? 0.76 : 0.70)
                border.width: 1

                Rectangle {
                    anchors.fill: parent
                    anchors.topMargin: 7
                    radius: parent.radius
                    color: Theme.alpha("overlay.scrim", Theme.isDark ? 0.30 : 0.070)
                    z: -1
                }

                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.leftMargin: 22
                    anchors.rightMargin: 22
                    anchors.topMargin: 1
                    height: 1
                    radius: 1
                    color: Theme.alpha("surface.float", Theme.isDark ? 0.22 : 0.88)
                }

                Rectangle {
                    anchors.fill: parent
                    anchors.margins: 1
                    radius: parent.radius - 1
                    gradient: Gradient {
                        orientation: Gradient.Vertical
                        GradientStop { position: 0.0; color: Theme.alpha("surface.float", Theme.isDark ? 0.10 : 0.42) }
                        GradientStop { position: 1.0; color: "transparent" }
                    }
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 8 * shell.stageScale
                    anchors.rightMargin: 8 * shell.stageScale
                    anchors.topMargin: 6 * shell.stageScale
                    anchors.bottomMargin: 6 * shell.stageScale
                    spacing: 5 * shell.stageScale

                    Repeater {
                        model: shell.navItems

                        delegate: Rectangle {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            radius: 24

                            readonly property bool active: shell.currentPage === index

                            color: active
                                ? "transparent"
                                : dockMouse.containsMouse
                                    ? Theme.alpha("surface.sunken", Theme.isDark ? 0.20 : 0.34)
                                    : "transparent"
                            border.color: "transparent"
                            border.width: 0

                            Behavior on color { ColorAnimation { duration: 140 } }

                            Column {
                                anchors.centerIn: parent
                                spacing: 7

                                PawNavIcon {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    visible: modelData.paw === true
                                    size: (active ? 27 : 25) * shell.stageScale
                                    active: parent.parent.active
                                    iconColor: active ? Theme.color("accent.base") : Theme.color("text.secondary")
                                }

                                ShapeIcon {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    visible: modelData.paw !== true
                                    pathData: modelData.icon
                                    size: (active ? 27 : 25) * shell.stageScale
                                    strokeWidth: active ? 2.25 : 2.10
                                    iconColor: active ? Theme.color("accent.base") : Theme.color("text.secondary")
                                }

                                Text {
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    text: modelData.label
                                    font.pixelSize: 12 * shell.stageScale
                                    font.family: Theme.fontUi
                                    font.weight: active ? Font.Bold : Font.Medium
                                    renderType: Text.NativeRendering
                                    color: active ? Theme.color("accent.strong") : Theme.color("text.secondary")
                                }
                            }

                            MouseArea {
                                id: dockMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: shell.currentPage = index
                            }
                        }
                    }
                }
            }
        }
    }

    component PawNavIcon: Item {
        id: pawIcon
        property real size: 24
        property color iconColor: Theme.color("text.secondary")
        property bool active: false

        width: size
        height: size

        Item {
            id: pawCanvas
            width: 24
            height: 24
            anchors.centerIn: parent
            scale: pawIcon.size / 24
            transformOrigin: Item.Center

            Repeater {
                model: [
                    { x: 3.9, y: 7.3, w: 4.2, h: 5.9, r: -22 },
                    { x: 7.7, y: 3.8, w: 4.1, h: 6.5, r: -8 },
                    { x: 12.2, y: 3.8, w: 4.1, h: 6.5, r: 8 },
                    { x: 15.9, y: 7.3, w: 4.2, h: 5.9, r: 22 }
                ]

                Rectangle {
                    x: modelData.x
                    y: modelData.y
                    width: modelData.w
                    height: modelData.h
                    radius: Math.min(width, height) / 2
                    rotation: modelData.r
                    color: pawIcon.active ? pawIcon.iconColor : "transparent"
                    border.color: pawIcon.iconColor
                    border.width: pawIcon.active ? 0 : 1.8
                    antialiasing: true
                }
            }

            Shape {
                anchors.fill: parent
                antialiasing: true

                ShapePath {
                    strokeWidth: pawIcon.active ? 0 : 1.8
                    strokeColor: pawIcon.iconColor
                    fillColor: pawIcon.active ? pawIcon.iconColor : "transparent"
                    capStyle: ShapePath.RoundCap
                    joinStyle: ShapePath.RoundJoin

                    PathSvg {
                        path: "M12 12.1c-2.85 0-5.35 2.4-5.35 5.02 0 1.56 1.05 2.55 2.42 2.55.9 0 1.72-.48 2.93-.48s2.03.48 2.93.48c1.37 0 2.42-.99 2.42-2.55 0-2.62-2.5-5.02-5.35-5.02z"
                    }
                }
            }
        }
    }

    function panelIndex(page) {
        switch (page) {
        case 1: return 0
        case 2: return 1
        case 3: return 2
        default: return 0
        }
    }

    function panelTitle(page) {
        switch (page) {
        case 1: return "\u5BF9\u8BDD"
        case 2: return "\u8BB0\u5FC6"
        case 3: return "\u4E16\u754C"
        case 5: return "\u6211\u7684"
        default: return "\u966A\u4F34"
        }
    }

    function panelWidth(page) {
        if (page === 1)
            return Math.min(width * 0.42, 560)
        if (page === 5)
            return Math.min(width * 0.60, 880)
        return Math.min(width * 0.52, 720)
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

    function handleDockMenuAction(page, action) {
        switch (page) {
        case 0:
            if (action === 0) {
                shell.currentPage = 0
            } else if (action === 1) {
                appController.desktopCompanionEnabled = !appController.desktopCompanionEnabled
            } else if (action === 2 || action === 3) {
                homeView.openModelAdjustDrawer()
            }
            break
        case 1:
            if (action === 0)
                shell.currentPage = 1
            break
        case 2:
            if (action === 0)
                shell.currentPage = 2
            break
        case 3:
            if (action === 0)
                shell.currentPage = 3
            break
        case 4:
            if (action === 0)
                shell.currentPage = 4
            break
        case 5:
            if (action === 0) {
                shell.currentPage = 5
            } else if (action === 1) {
                if (appController.accountLoggedIn)
                    mineView.refreshProfile()
                else
                    mineView.openLoginDialog()
            } else if (action === 2 || action === 3) {
                shell.currentPage = 5
                mineView.scrollToSettings()
            }
            break
        default:
            break
        }
    }
}
