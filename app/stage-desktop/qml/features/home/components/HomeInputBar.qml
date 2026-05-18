import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Shapes

Item {
    id: root
    height: 56

    property var store: null
    readonly property real uiScale: Math.max(0.82, Math.min(1.35, height / 56))
    readonly property real panelRadius: height / 2

    NNAGlassPanel {
        anchors.fill: parent
        radius: root.panelRadius
        topLineMargin: 24 * root.uiScale
        shadowOffset: 7 * root.uiScale
    }

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 20 * root.uiScale
        anchors.rightMargin: 7 * root.uiScale
        spacing: 10 * root.uiScale

        TextField {
            id: inputField
            Layout.fillWidth: true
            placeholderText: root.store ? "\u8DDF " + root.store.state.characterName + " \u8BF4\u70B9\u4EC0\u4E48..." : "\u8BF4\u70B9\u4EC0\u4E48..."
            placeholderTextColor: Theme.color("text.tertiary")
            background: Item {}
            font.pixelSize: 16 * root.uiScale
            font.family: Theme.fontUi
            color: Theme.color("text.primary")
            verticalAlignment: TextInput.AlignVCenter
            selectByMouse: true

            Keys.onReturnPressed: root.send()
            Keys.onEnterPressed: root.send()
        }

        Item {
            Layout.preferredWidth: 38 * root.uiScale
            Layout.preferredHeight: 38 * root.uiScale

            NNAGlassPanel {
                anchors.fill: parent
                radius: height / 2
                hovered: micMouse.containsMouse
                shadowOffset: 2 * root.uiScale
                shadowDarkOpacity: 0.10
                shadowLightOpacity: 0.025
                fillColor: Theme.alpha("surface.float",
                    Theme.isDark
                        ? (micMouse.containsMouse ? 0.82 : 0.72)
                        : (micMouse.containsMouse ? 0.90 : 0.82))
                borderColor: Theme.alpha("line.soft", micMouse.containsMouse ? 0.58 : 0.42)
            }

            ShapeIcon {
                anchors.centerIn: parent
                pathData: Icons.mic
                size: 18 * root.uiScale
                iconColor: Theme.color("text.secondary")
            }

            MouseArea {
                id: micMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
            }
        }

        Rectangle {
            Layout.preferredWidth: 44 * root.uiScale
            Layout.preferredHeight: 44 * root.uiScale
            radius: height / 2
            color: sendMouse.containsMouse ? Theme.color("accent.strong") : Theme.color("accent.base")
            Behavior on color { ColorAnimation { duration: 120 } }

            Rectangle {
                anchors.fill: parent
                anchors.topMargin: 3
                radius: parent.radius
                color: Theme.alpha("overlay.scrim", Theme.isDark ? 0.20 : 0.10)
                z: -1
            }

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.leftMargin: 11
                anchors.rightMargin: 11
                anchors.topMargin: 1
                height: 1
                color: Theme.alpha("text.onAccent", 0.44)
            }

            ShapeIcon {
                anchors.centerIn: parent
                pathData: Icons.send
                size: 18 * root.uiScale
                iconColor: Theme.color("text.onAccent")
            }

            MouseArea {
                id: sendMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.send()
            }
        }
    }

    function send() {
        if (!store) return
        store.sendMessage(inputField.text)
        inputField.text = ""
    }
}
