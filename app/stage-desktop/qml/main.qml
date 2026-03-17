import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root
    width: 1100
    height: 720
    minimumWidth: 900
    minimumHeight: 600
    visible: true
    title: "OpenNeko Engine"
    color: "#FFF8F0"

    property int currentPage: 0
    property string accent: appController.accentColor

    RowLayout {
        anchors.fill: parent
        spacing: 0

        NNASidebar {
            Layout.fillHeight: true
            Layout.preferredWidth: 56
            currentIndex: root.currentPage
            accentColor: root.accent
            characterName: appController.characterName
            onNavigated: function(index) { root.currentPage = index }
        }

        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: 1
            color: "#E8E0D8"
        }

        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.currentPage

            HomePage {}       // 0 首页
            SoulPage {}       // 1 灵魂 (记忆/梦境/状态/角色)
            AbilityPage {}    // 2 能力 (ToolCall/代理/进化)
            WorldPage {}      // 3 世界 (感知/IoT)
            SettingsPage {}   // 4 设置
        }
    }

    footer: Rectangle {
        height: 32
        color: "#FFF0F0"
        border.color: "#E8E0D8"
        border.width: 1

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 70
            anchors.rightMargin: 16
            spacing: 20

            Text {
                text: "\u2665 P:" + appController.pleasure.toFixed(2)
                font.pixelSize: 12
                font.family: "Nunito"
                color: root.accent
            }
            Text {
                text: "\u26A1 A:" + appController.arousal.toFixed(2)
                font.pixelSize: 12
                font.family: "Nunito"
                color: "#F59E0B"
            }
            Text {
                text: "\uD83C\uDF59 \u9971:" + Math.round(appController.satiety) + "%"
                font.pixelSize: 12
                color: "#6B7280"
            }
            Text {
                text: "\uD83D\uDCA7 \u6C34:" + Math.round(appController.hydration) + "%"
                font.pixelSize: 12
                color: "#6B7280"
            }
            Item { Layout.fillWidth: true }
            Text {
                text: appController.characterName + " \u00B7 " + moodEmoji(appController.currentMood)
                font.pixelSize: 12
                color: "#9CA3AF"
            }
        }
    }

    function moodEmoji(mood: string): string {
        if (mood === "happy") return "\uD83D\uDE0A \u5F00\u5FC3"
        if (mood === "calm") return "\uD83D\uDE0C \u5E73\u9759"
        return "\uD83D\uDE22 \u4F4E\u843D"
    }
}
