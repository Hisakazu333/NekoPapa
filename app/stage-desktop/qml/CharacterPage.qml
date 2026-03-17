import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import NNA.Core 1.0

Item {
    id: characterPage

    property string accent: appController.accentColor

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 16

        // Header
        RowLayout {
            Layout.fillWidth: true
            spacing: 12

            Text {
                text: "\uD83D\uDC3E \u89D2\u8272"
                font.pixelSize: 22
                font.family: "Nunito"
                font.weight: Font.Bold
                color: "#2D2D2D"
            }

            Item { Layout.fillWidth: true }

            // Import button
            Rectangle {
                Layout.preferredWidth: importRow.width + 24
                Layout.preferredHeight: 36
                radius: 18
                color: importMouse.containsMouse ? Qt.darker(characterPage.accent, 1.08) : characterPage.accent
                Behavior on color { ColorAnimation { duration: 120 } }

                Row {
                    id: importRow
                    anchors.centerIn: parent
                    spacing: 6
                    Text { text: "+"; font.pixelSize: 16; color: "#FFFFFF"; font.weight: Font.Bold }
                    Text { text: "\u5BFC\u5165\u6A21\u578B"; font.pixelSize: 13; font.family: "Nunito"; color: "#FFFFFF" }
                }

                MouseArea {
                    id: importMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: folderDialog.open()
                }
            }
        }

        // Model grid
        GridView {
            id: modelGrid
            Layout.fillWidth: true
            Layout.fillHeight: true
            cellWidth: 160
            cellHeight: 200
            clip: true

            model: modelManager.modelList

            delegate: Item {
                width: modelGrid.cellWidth
                height: modelGrid.cellHeight

                property bool isCurrent: modelData.isCurrent
                property bool isHovered: cardMouse.containsMouse

                Rectangle {
                    anchors.fill: parent
                    anchors.margins: 6
                    radius: 16
                    color: Qt.alpha("#FFFFFF", 0.92)
                    border.color: isCurrent ? modelData.accentColor
                               : isHovered ? Qt.alpha(modelData.accentColor, 0.3)
                               : Qt.alpha("#000000", 0.06)
                    border.width: isCurrent ? 2 : 1

                    Behavior on border.color { ColorAnimation { duration: 200 } }

                    Column {
                        anchors.centerIn: parent
                        spacing: 8

                        // Model preview (Live2D thumbnail)
                        Rectangle {
                            anchors.horizontalCenter: parent.horizontalCenter
                            width: 100
                            height: 100
                            radius: 12
                            color: Qt.alpha(modelData.accentColor, 0.08)
                            clip: true

                            NNAAvatarCanvas {
                                anchors.fill: parent
                                modelPath: modelData.path
                                visible: modelLoaded
                            }

                            Text {
                                anchors.centerIn: parent
                                text: "\uD83D\uDC31"
                                font.pixelSize: 48
                                opacity: 0.6
                                visible: !modelData.path || modelData.path === ""
                            }
                        }

                        // Model name
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: modelData.name
                            font.pixelSize: 13
                            font.family: "Nunito"
                            font.weight: Font.DemiBold
                            color: "#2D2D2D"
                            elide: Text.ElideRight
                            width: 120
                            horizontalAlignment: Text.AlignHCenter
                        }

                        // Status badge
                        Rectangle {
                            anchors.horizontalCenter: parent.horizontalCenter
                            width: badgeText.implicitWidth + 16
                            height: 24
                            radius: 12
                            color: isCurrent ? modelData.accentColor : Qt.alpha(modelData.accentColor, 0.1)

                            Text {
                                id: badgeText
                                anchors.centerIn: parent
                                text: isCurrent ? "\u4F7F\u7528\u4E2D" : "\u5207\u6362"
                                font.pixelSize: 11
                                font.family: "Nunito"
                                color: isCurrent ? "#FFFFFF" : modelData.accentColor
                            }
                        }
                    }

                    // Preset indicator
                    Text {
                        anchors.top: parent.top
                        anchors.right: parent.right
                        anchors.margins: 8
                        text: modelData.isPreset ? "\u2B50" : ""
                        font.pixelSize: 12
                        visible: modelData.isPreset
                    }

                    MouseArea {
                        id: cardMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        acceptedButtons: Qt.LeftButton | Qt.RightButton

                        onClicked: function(mouse) {
                            if (mouse.button === Qt.RightButton) {
                                if (!modelData.isPreset) {
                                    contextMenu.modelId = modelData.id
                                    contextMenu.popup()
                                }
                            } else {
                                modelManager.switchModel(modelData.id)
                            }
                        }
                    }
                }
            }
        }

        // Empty state
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: modelManager.modelList.length === 0

            Column {
                anchors.centerIn: parent
                spacing: 12

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "\uD83D\uDE3F"
                    font.pixelSize: 64
                    opacity: 0.4
                }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "\u8FD8\u6CA1\u6709\u6A21\u578B\u54E6\uFF0C\u5BFC\u5165\u4E00\u4E2A\u5427\uFF01"
                    font.pixelSize: 14
                    font.family: "Nunito"
                    color: "#9CA3AF"
                }
            }
        }
    }

    // Context menu for delete
    Menu {
        id: contextMenu
        property string modelId: ""

        MenuItem {
            text: "\u5220\u9664\u6A21\u578B"
            onTriggered: modelManager.removeModel(contextMenu.modelId)
        }
    }

    // Folder dialog for import
    FolderDialog {
        id: folderDialog
        title: "\u9009\u62E9 Live2D \u6A21\u578B\u6587\u4EF6\u5939"
        onAccepted: {
            modelManager.importModel(selectedFolder)
        }
    }
}
