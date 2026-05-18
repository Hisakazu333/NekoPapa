import QtQuick
import QtQuick.Controls
import NNA.Core 1.0

Item {
    id: root

    property alias modelScale: avatarCanvas.modelScale
    property alias modelOffsetX: avatarCanvas.modelOffsetX
    property alias modelOffsetY: avatarCanvas.modelOffsetY
    property alias projectionWidthHint: avatarCanvas.projectionWidthHint
    property alias projectionHeightHint: avatarCanvas.projectionHeightHint

    // Live2D model canvas
    NNAAvatarCanvas {
        id: avatarCanvas
        anchors.fill: parent
        modelPath: appController.currentModelPath
        modelScale: 1.0
        modelOffsetX: 0.0
        modelOffsetY: 0.0
        projectionWidthHint: 0.0
        projectionHeightHint: 0.0
        visible: avatarCanvas.modelLoaded || appController.currentModelPath !== ""
        z: 2
    }

    // Touch area for model interaction
    MouseArea {
        anchors.fill: parent
        z: 1
        enabled: avatarCanvas.modelLoaded
        onClicked: function(mouse) {
            avatarCanvas.onTouchAt(mouse.x, mouse.y)
        }
    }

    // Keep loading inside the stage, not as a separate technical state.
    Item {
        anchors.centerIn: parent
        width: 240
        height: 220
        z: 3
        visible: !avatarCanvas.modelLoaded && !appController.currentModelPath

        Rectangle {
            anchors.centerIn: parent
            width: 132
            height: 132
            radius: 66
            color: Theme.alpha("surface.float", Theme.isDark ? 0.28 : 0.34)
            border.color: Theme.alpha("line.soft", Theme.isDark ? 0.48 : 0.56)
            border.width: 1

            Text {
                anchors.centerIn: parent
                text: appController.characterName.length > 0 ? appController.characterName.charAt(0) : "N"
                font.pixelSize: 42
                font.family: Theme.fontUi
                font.weight: Font.DemiBold
                color: Theme.alpha("text.primary", 0.64)
            }
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.top: parent.verticalCenter
            anchors.topMargin: 70
            text: "\u6B63\u5728\u51C6\u5907 " + appController.characterName
            font.pixelSize: 12
            font.family: Theme.fontUi
            color: Theme.color("text.tertiary")
        }
    }
}
