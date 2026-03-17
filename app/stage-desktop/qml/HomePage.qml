import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import NNA.Core 1.0

Item {
    id: homePage

    property string accent: appController.accentColor

    // === Full-screen background + Live2D ===
    Rectangle {
        anchors.fill: parent
        clip: true
        gradient: Gradient {
            orientation: Gradient.Vertical
            GradientStop { position: 0.0; color: "#FFF5F0" }
            GradientStop { position: 0.4; color: "#FFF8F3" }
            GradientStop { position: 0.8; color: Qt.alpha(homePage.accent, 0.04) }
            GradientStop { position: 1.0; color: Qt.alpha(homePage.accent, 0.08) }
        }

        // Ambient floating particles
        Repeater {
            model: 12
            delegate: Rectangle {
                property real seed: Math.random()
                property real baseX: seed * homePage.width
                property real baseY: Math.random() * homePage.height * 0.8
                x: baseX
                y: baseY
                width: 3 + seed * 4
                height: width
                radius: width / 2
                color: Qt.alpha(homePage.accent, 0.08 + seed * 0.06)

                SequentialAnimation on y {
                    loops: Animation.Infinite
                    NumberAnimation { to: baseY - 20 - seed * 30; duration: 3000 + seed * 4000; easing.type: Easing.InOutSine }
                    NumberAnimation { to: baseY; duration: 3000 + seed * 4000; easing.type: Easing.InOutSine }
                }
                SequentialAnimation on opacity {
                    loops: Animation.Infinite
                    NumberAnimation { to: 0.3; duration: 2000 + seed * 3000; easing.type: Easing.InOutSine }
                    NumberAnimation { to: 1.0; duration: 2000 + seed * 3000; easing.type: Easing.InOutSine }
                }
            }
        }

        // Live2D model canvas — full page, clipped
        NNAAvatarCanvas {
            id: avatarCanvas
            anchors.fill: parent
            modelPath: appController.currentModelPath
            modelScale: scaleSlider.value
            modelOffsetX: xSlider.value
            modelOffsetY: ySlider.value
        }

        // Full-page touch area for model interaction (behind UI elements)
        MouseArea {
            anchors.fill: parent
            z: 1
            onClicked: function(mouse) {
                avatarCanvas.onTouchAt(mouse.x, mouse.y)
            }
        }

        // Fallback emoji when no Live2D model loaded
        Item {
            anchors.centerIn: parent
            width: 200
            height: 240
            z: 2
            visible: !avatarCanvas.modelLoaded && !appController.currentModelPath

            Text {
                id: catEmoji
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.verticalCenter: parent.verticalCenter
                text: "\uD83D\uDC31"
                font.pixelSize: 160
                opacity: 0.7

                SequentialAnimation on scale {
                    loops: Animation.Infinite
                    NumberAnimation { to: 1.02; duration: 2500; easing.type: Easing.InOutSine }
                    NumberAnimation { to: 0.98; duration: 2500; easing.type: Easing.InOutSine }
                }
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.bottom: parent.bottom
                text: "Live2D / VRM"
                font.pixelSize: 11
                font.family: "Nunito"
                color: "#D1D5DB"
                opacity: 0.6
            }
        }
    }

    // === Cat speech bubble (proactive line) ===
    Rectangle {
        id: speechBubble
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: parent.height * 0.48
        width: speechText.implicitWidth + 32
        height: speechText.implicitHeight + 20
        radius: 16
        color: Qt.alpha("#FFFFFF", 0.9)
        border.color: Qt.alpha(homePage.accent, 0.12)
        border.width: 1
        z: 6
        visible: chatModel.count === 0

        Text {
            id: speechText
            anchors.centerIn: parent
            text: catSpeech()
            font.pixelSize: 14
            font.family: "Nunito"
            color: "#4B5563"
        }

        Canvas {
            anchors.top: parent.bottom
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.topMargin: -1
            width: 16
            height: 10
            onPaint: {
                var ctx = getContext("2d")
                ctx.fillStyle = Qt.alpha("#FFFFFF", 0.9)
                ctx.strokeStyle = Qt.alpha(homePage.accent, 0.12)
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.lineTo(8, 10)
                ctx.lineTo(16, 0)
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
            }
        }

        SequentialAnimation on opacity {
            loops: Animation.Infinite
            NumberAnimation { to: 1.0; duration: 500 }
            PauseAnimation { duration: 6000 }
            NumberAnimation { to: 0.0; duration: 800; easing.type: Easing.InCubic }
            PauseAnimation { duration: 1000 }
            ScriptAction { script: speechText.text = catSpeech() }
            NumberAnimation { to: 1.0; duration: 800; easing.type: Easing.OutCubic }
        }
    }

    // === HUD: compact floating badges, right-top ===
    Column {
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.topMargin: 12
        anchors.rightMargin: 12
        spacing: 6
        z: 10

        HudBadge {
            icon: moodIcon()
            label: moodText()
            badgeColor: homePage.accent
        }

        HudBadge {
            icon: "\uD83C\uDF59"
            label: Math.round(appController.satiety) + ""
            badgeColor: "#60A5FA"
            progress: appController.satiety / 100
        }

        HudBadge {
            icon: "\uD83D\uDCA7"
            label: Math.round(appController.hydration) + ""
            badgeColor: "#22D3EE"
            progress: appController.hydration / 100
        }

        HudBadge {
            icon: "\u26A1"
            label: Math.round(appController.energy) + ""
            badgeColor: "#34D399"
            progress: appController.energy / 100
        }
    }

    // === Time + greeting, left-top ===
    Column {
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.topMargin: 16
        anchors.leftMargin: 20
        spacing: 2
        z: 10

        Text {
            text: greeting()
            font.pixelSize: 18
            font.family: "Nunito"
            font.weight: Font.Bold
            color: "#2D2D2D"
            opacity: 0.7
        }
        Text {
            text: Qt.formatDateTime(new Date(), "M\u6708d\u65E5 dddd")
            font.pixelSize: 12
            font.family: "Nunito"
            color: "#9CA3AF"
        }
    }

    // === Model adjustment toggle (gear icon, top-left below greeting) ===
    Rectangle {
        id: adjustToggle
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.leftMargin: 20
        anchors.topMargin: 60
        width: 28
        height: 28
        radius: 14
        color: adjustPanel.visible ? Qt.alpha(homePage.accent, 0.15) : Qt.alpha("#000000", 0.04)
        z: 20

        Text {
            anchors.centerIn: parent
            text: "\u2699"
            font.pixelSize: 14
            opacity: 0.5
        }

        MouseArea {
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: adjustPanel.visible = !adjustPanel.visible
        }
    }

    // === Model adjustment panel (appears below gear) ===
    Rectangle {
        id: adjustPanel
        anchors.left: parent.left
        anchors.top: adjustToggle.bottom
        anchors.leftMargin: 12
        anchors.topMargin: 4
        width: 200
        height: adjustCol.height + 16
        radius: 12
        color: Qt.alpha("#FFFFFF", 0.92)
        border.color: Qt.alpha(homePage.accent, 0.1)
        border.width: 1
        visible: false
        z: 20

        Column {
            id: adjustCol
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: 8
            spacing: 4

            Row {
                spacing: 4
                Text { text: "\u7F29\u653E"; font.pixelSize: 10; color: "#666"; width: 28; anchors.verticalCenter: parent.verticalCenter }
                Slider { id: scaleSlider; from: 0.5; to: 5.0; value: 1.0; implicitWidth: 120; stepSize: 0.1 }
                Text { text: scaleSlider.value.toFixed(1); font.pixelSize: 10; color: "#666"; width: 24; anchors.verticalCenter: parent.verticalCenter }
            }
            Row {
                spacing: 4
                Text { text: "X"; font.pixelSize: 10; color: "#666"; width: 28; anchors.verticalCenter: parent.verticalCenter }
                Slider { id: xSlider; from: -3.0; to: 3.0; value: 0.0; implicitWidth: 120; stepSize: 0.05 }
                Text { text: xSlider.value.toFixed(2); font.pixelSize: 10; color: "#666"; width: 24; anchors.verticalCenter: parent.verticalCenter }
            }
            Row {
                spacing: 4
                Text { text: "Y"; font.pixelSize: 10; color: "#666"; width: 28; anchors.verticalCenter: parent.verticalCenter }
                Slider { id: ySlider; from: -3.0; to: 3.0; value: 0.0; implicitWidth: 120; stepSize: 0.05 }
                Text { text: ySlider.value.toFixed(2); font.pixelSize: 10; color: "#666"; width: 24; anchors.verticalCenter: parent.verticalCenter }
            }
        }
    }

    // === Chat bubbles floating above input ===
    ListView {
        id: chatList
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 72
        height: Math.min(contentHeight, parent.height * 0.35)
        anchors.leftMargin: 20
        anchors.rightMargin: 20
        clip: true
        verticalLayoutDirection: ListView.BottomToTop
        spacing: 8
        z: 8

        model: chatModel

        delegate: Item {
            width: chatList.width
            height: bubbleRect.height
            property bool fromUser: model.isUser

            Rectangle {
                id: bubbleRect
                anchors.right: fromUser ? parent.right : undefined
                anchors.left: fromUser ? undefined : parent.left
                width: Math.min(bText.implicitWidth + 28, chatList.width * 0.65)
                height: bText.implicitHeight + 18
                radius: 18
                color: fromUser ? homePage.accent : Qt.alpha("#FFFFFF", 0.92)
                border.color: fromUser ? "transparent" : Qt.alpha(homePage.accent, 0.1)
                border.width: fromUser ? 0 : 1

                Text {
                    id: bText
                    anchors.centerIn: parent
                    width: parent.width - 28
                    text: model.text
                    wrapMode: Text.Wrap
                    font.pixelSize: 13
                    font.family: "Nunito"
                    color: fromUser ? "#FFFFFF" : "#2D2D2D"
                }

                scale: 0.8
                opacity: 0
                Component.onCompleted: {
                    scale = 1.0
                    opacity = 1.0
                }
                Behavior on scale { NumberAnimation { duration: 200; easing.type: Easing.OutBack } }
                Behavior on opacity { NumberAnimation { duration: 200 } }
            }
        }
    }

    // === Bottom chat input ===
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.leftMargin: 16
        anchors.rightMargin: 16
        anchors.bottomMargin: 14
        height: 48
        radius: 24
        color: Qt.alpha("#FFFFFF", 0.92)
        border.color: Qt.alpha(homePage.accent, 0.12)
        border.width: 1
        z: 10

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 18
            anchors.rightMargin: 6
            spacing: 6

            TextField {
                id: chatInput
                Layout.fillWidth: true
                placeholderText: "\u8DDF " + appController.characterName + " \u8BF4\u70B9\u4EC0\u4E48..."
                placeholderTextColor: "#C4B5A8"
                background: Item {}
                font.pixelSize: 14
                font.family: "Nunito"
                color: "#2D2D2D"

                Keys.onReturnPressed: sendMsg()
                Keys.onEnterPressed: sendMsg()
            }

            Rectangle {
                Layout.preferredWidth: 36
                Layout.preferredHeight: 36
                radius: 18
                color: sendMouse.containsMouse ? Qt.darker(homePage.accent, 1.08) : homePage.accent
                Behavior on color { ColorAnimation { duration: 120 } }

                Text {
                    anchors.centerIn: parent
                    text: "\uD83D\uDC3E"
                    font.pixelSize: 16
                }

                MouseArea {
                    id: sendMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: sendMsg()
                }
            }
        }
    }

    ListModel { id: chatModel }

    function sendMsg() {
        var text = chatInput.text.trim()
        if (text.length === 0) return
        chatModel.insert(0, { text: text, isUser: true })
        chatInput.text = ""
        replyTimer.start()
    }

    Timer {
        id: replyTimer
        interval: 600 + Math.random() * 600
        onTriggered: {
            var replies = [
                "\u55B5\uFF5E\u6211\u77E5\u9053\u4E86\uFF01",
                "\u563F\u563F\uFF0C\u4F60\u8BF4\u5F97\u5BF9\u5462\uFF5E",
                "\u8981\u4E0D\u8981\u4F11\u606F\u4E00\u4E0B\u5440\uFF1F",
                "\u6211\u5728\u542C\u5462\uFF0C\u7EE7\u7EED\u8BF4\u5427\uFF5E",
                "\u4ECA\u5929\u8FC7\u5F97\u600E\u4E48\u6837\u5440\uFF1F",
                "\u8FD9\u6837\u554A\u2026\u2026\u6211\u8BB0\u4F4F\u4E86\uFF01",
                "\u5462\u5462\uFF0C\u7136\u540E\u5462\uFF1F"
            ]
            var reply = replies[Math.floor(Math.random() * replies.length)]
            chatModel.insert(0, { text: reply, isUser: false })
        }
    }

    // === Helper functions ===
    function moodIcon(): string {
        var mood = appController.currentMood
        if (mood === "happy") return "\uD83D\uDE0A"
        if (mood === "calm") return "\uD83D\uDE0C"
        return "\uD83D\uDE22"
    }

    function moodText(): string {
        var mood = appController.currentMood
        if (mood === "happy") return "\u5F00\u5FC3"
        if (mood === "calm") return "\u5E73\u9759"
        return "\u4F4E\u843D"
    }

    function greeting(): string {
        var h = new Date().getHours()
        if (h < 6) return "\u591C\u6DF1\u4E86\u2026"
        if (h < 11) return "\u65E9\u4E0A\u597D\u2728"
        if (h < 14) return "\u4E2D\u5348\u597D\u2600"
        if (h < 18) return "\u4E0B\u5348\u597D\u2615"
        if (h < 22) return "\u665A\u4E0A\u597D\u{1F319}"
        return "\u591C\u6DF1\u4E86\u2026"
    }

    function catSpeech(): string {
        var lines = [
            "\u4ECA\u5929\u8FC7\u5F97\u600E\u4E48\u6837\uFF1F\u8981\u4E0D\u8981\u804A\u804A\uFF1F",
            "\u6211\u521A\u624D\u5728\u60F3\u4F60\u5462\uFF5E",
            "\u6709\u4EC0\u4E48\u70E6\u5FC3\u4E8B\u53EF\u4EE5\u544A\u8BC9\u6211\u54E6",
            "\u5462\u5462\u2026\u4ECA\u5929\u5929\u6C14\u771F\u597D\u5440",
            "\u8981\u4E0D\u8981\u4E00\u8D77\u505A\u70B9\u4EC0\u4E48\uFF1F",
            "\u6211\u6709\u70B9\u65E0\u804A\u2026\u964D\u4F60\u6765\u964D\u4F60\u6765\uFF01"
        ]
        return lines[Math.floor(Math.random() * lines.length)]
    }

    // === Compact HUD badge component ===
    component HudBadge: Rectangle {
        property string icon: ""
        property string label: ""
        property color badgeColor: "#FF7AA2"
        property real progress: -1

        width: 56
        height: progress >= 0 ? 56 : 40
        radius: 12
        color: Qt.alpha("#FFFFFF", 0.75)
        border.color: Qt.alpha(badgeColor, 0.15)
        border.width: 1
        opacity: hudHover.containsMouse ? 1.0 : 0.8
        Behavior on opacity { NumberAnimation { duration: 200 } }

        MouseArea {
            id: hudHover
            anchors.fill: parent
            hoverEnabled: true
        }

        Column {
            anchors.centerIn: parent
            spacing: 3

            Row {
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 2
                Text { text: icon; font.pixelSize: 12 }
                Text {
                    text: label
                    font.pixelSize: 11
                    font.family: "Nunito"
                    font.weight: Font.DemiBold
                    color: badgeColor
                }
            }

            Rectangle {
                visible: progress >= 0
                anchors.horizontalCenter: parent.horizontalCenter
                width: 36
                height: 3
                radius: 1.5
                color: Qt.alpha(badgeColor, 0.12)

                Rectangle {
                    width: parent.width * Math.max(0, Math.min(1, progress))
                    height: parent.height
                    radius: 1.5
                    color: badgeColor
                    Behavior on width { NumberAnimation { duration: 500; easing.type: Easing.OutCubic } }
                }
            }
        }
    }
}
