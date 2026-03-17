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

        // 页面头部 / Header
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

            // 刷新按钮 / Refresh button
            Rectangle {
                Layout.preferredWidth: 36
                Layout.preferredHeight: 36
                radius: 18
                color: refreshMouse.containsMouse ? Qt.alpha(characterPage.accent, 0.15) : Qt.alpha("#000000", 0.04)

                Text { anchors.centerIn: parent; text: "\uD83D\uDD04"; font.pixelSize: 14 }

                MouseArea {
                    id: refreshMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: modelManager.refresh()
                }
            }

            // 导入按钮 / Import button
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

        // 模型网格 / Model grid
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

                        // 模型 Live2D 预览 / Live2D model preview
                        Rectangle {
                            anchors.horizontalCenter: parent.horizontalCenter
                            width: 120
                            height: 120
                            radius: 12
                            color: Qt.alpha(modelData.accentColor, 0.06)
                            clip: true

                            // 嵌入 Live2D 渲染画布 / Embedded Live2D render canvas
                            NNAAvatarCanvas {
                                id: cardAvatar
                                anchors.fill: parent
                                modelPath: modelData.path
                                modelScale: 1.0
                                modelOffsetX: 0.0
                                modelOffsetY: -0.4
                            }
                        }

                        // 模型名称 / Model name
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

                        // 状态徽章 / Status badge
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

                    // 预设标记 / Preset indicator
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
                                // 右键菜单仅对非预设模型生效 / Context menu only for non-preset models
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

        // 空状态提示 / Empty state
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

    // 拖拽导入覆盖层 / Drag-and-drop overlay
    DropArea {
        anchors.fill: parent
        keys: ["text/uri-list"]

        onEntered: function(drag) { dropOverlay.visible = true }
        onExited: { dropOverlay.visible = false }
        onDropped: function(drop) {
            dropOverlay.visible = false
            if (drop.hasUrls) {
                for (var i = 0; i < drop.urls.length; i++) {
                    doImport(drop.urls[i])
                }
            }
        }
    }

    Rectangle {
        id: dropOverlay
        anchors.fill: parent
        color: Qt.alpha(characterPage.accent, 0.08)
        border.color: characterPage.accent
        border.width: 2
        radius: 16
        visible: false
        z: 100

        Column {
            anchors.centerIn: parent
            spacing: 8
            Text { anchors.horizontalCenter: parent.horizontalCenter; text: "\uD83D\uDCE5"; font.pixelSize: 48 }
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "\u62D6\u653E Live2D \u6A21\u578B\u6587\u4EF6\u5939\u5230\u8FD9\u91CC"
                font.pixelSize: 16; font.family: "Nunito"; color: "#4B5563"
            }
        }
    }

    // 底部 Toast 通知 / Toast notification
    Rectangle {
        id: toast
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: 20
        width: toastText.implicitWidth + 32
        height: 40
        radius: 20
        color: "#2D2D2D"
        opacity: 0
        z: 200

        Text {
            id: toastText
            anchors.centerIn: parent
            font.pixelSize: 13
            font.family: "Nunito"
            color: "#FFFFFF"
        }

        SequentialAnimation {
            id: toastAnim
            NumberAnimation { target: toast; property: "opacity"; to: 1.0; duration: 200 }
            PauseAnimation { duration: 2000 }
            NumberAnimation { target: toast; property: "opacity"; to: 0.0; duration: 400 }
        }
    }

    function showToast(msg) {
        toastText.text = msg
        toastAnim.restart()
    }

    function doImport(url) {
        var ok = modelManager.importModel(url)
        if (ok) {
            showToast("\u2705 \u6A21\u578B\u5BFC\u5165\u6210\u529F")
            // 自动切换到新导入的模型（列表末尾） / Auto-switch to the newly imported model (last in user list)
            var list = modelManager.modelList
            for (var i = list.length - 1; i >= 0; i--) {
                if (!list[i].isPreset) {
                    modelManager.switchModel(list[i].id)
                    break
                }
            }
        } else {
            showToast("\u274C \u5BFC\u5165\u5931\u8D25\uFF0C\u8BF7\u786E\u8BA4\u6587\u4EF6\u5939\u5305\u542B .model3.json")
        }
    }

    // 右键删除菜单 / Context menu for delete
    Menu {
        id: contextMenu
        property string modelId: ""

        MenuItem {
            text: "\u5220\u9664\u6A21\u578B"
            onTriggered: {
                modelManager.removeModel(contextMenu.modelId)
                showToast("\u5DF2\u5220\u9664")
            }
        }
    }

    // 文件夹选择对话框 / Folder dialog for import
    FolderDialog {
        id: folderDialog
        title: "\u9009\u62E9 Live2D \u6A21\u578B\u6587\u4EF6\u5939"
        onAccepted: doImport(selectedFolder)
    }
}
