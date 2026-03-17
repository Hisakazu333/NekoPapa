import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: root
    property string accent: appController.accentColor
    property int currentTab: 0

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Sub-tab bar
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 44
            color: "#FFFAF5"

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 20
                anchors.rightMargin: 20
                spacing: 4

                Repeater {
                    model: [
                        { label: "\u2B50 \u8BB0\u5FC6\u661F\u56FE" },
                        { label: "\uD83C\uDF19 \u68A6\u5883\u65E5\u5FD7" },
                        { label: "\uD83D\uDCCA \u72B6\u6001\u4EEA\u8868\u76D8" },
                        { label: "\uD83D\uDC3E \u89D2\u8272" }
                    ]

                    delegate: Rectangle {
                        Layout.preferredHeight: 32
                        Layout.preferredWidth: tabText.implicitWidth + 24
                        radius: 16
                        color: root.currentTab === index ? Qt.alpha(root.accent, 0.12) : (tabMouse.containsMouse ? Qt.alpha(root.accent, 0.05) : "transparent")
                        Behavior on color { ColorAnimation { duration: 150 } }

                        Text {
                            id: tabText
                            anchors.centerIn: parent
                            text: modelData.label
                            font.pixelSize: 12
                            font.family: "Nunito"
                            font.weight: root.currentTab === index ? Font.Bold : Font.Normal
                            color: root.currentTab === index ? root.accent : "#888888"
                        }

                        MouseArea {
                            id: tabMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.currentTab = index
                        }
                    }
                }

                Item { Layout.fillWidth: true }
            }

            // Bottom border
            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: "#E8E0D8"
            }
        }

        // Sub-page content
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.currentTab

            MemoryPage {}
            DreamPage {}
            StatusPage {}
            CharacterPage {}
        }
    }
}
