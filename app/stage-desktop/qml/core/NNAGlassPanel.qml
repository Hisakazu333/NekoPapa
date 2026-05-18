import QtQuick
import QtQuick.Effects

Item {
    id: root

    property real radius: Math.min(width, height) / 2
    property bool hovered: false
    property bool pressed: false
    property bool active: false
    property color fillColor: Theme.alpha("surface.float",
        Theme.isDark
            ? (pressed ? 0.93 : hovered ? 0.92 : 0.90)
            : (pressed ? 0.96 : hovered ? 0.94 : 0.92))
    property color borderColor: Theme.alpha("line.soft",
        Theme.isDark
            ? (active ? 0.84 : hovered ? 0.80 : 0.76)
            : (active ? 0.78 : hovered ? 0.74 : 0.70))
    property real borderWidth: 1
    property real shadowOffset: 7
    property real shadowBlur: 18
    property real shadowDarkOpacity: 0.30
    property real shadowLightOpacity: 0.070
    property real topLineMargin: Math.min(24, Math.max(2, radius - 1))
    property real topLineDarkOpacity: 0.22
    property real topLineLightOpacity: 0.88
    property real sheenDarkOpacity: 0.10
    property real sheenLightOpacity: 0.42
    property real bottomLineDarkOpacity: 0.12
    property real bottomLineLightOpacity: 0.20

    clip: false

    RectangularShadow {
        id: castShadow
        x: -root.shadowBlur
        y: root.shadowOffset - root.shadowBlur
        width: parent.width + root.shadowBlur * 2
        height: parent.height + root.shadowBlur * 2
        radius: root.radius + root.shadowBlur
        blur: root.shadowBlur
        spread: 0
        cached: true
        color: Theme.alpha("overlay.scrim", Theme.isDark ? root.shadowDarkOpacity : root.shadowLightOpacity)
        visible: (Theme.isDark ? root.shadowDarkOpacity : root.shadowLightOpacity) > 0
    }

    Rectangle {
        id: body
        anchors.fill: parent
        radius: root.radius
        color: root.fillColor
        border.color: root.borderColor
        border.width: root.borderWidth
        antialiasing: true

        Behavior on color { ColorAnimation { duration: 140 } }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.leftMargin: root.topLineMargin
            anchors.rightMargin: root.topLineMargin
            anchors.topMargin: 1
            height: 1
            radius: 1
            color: Theme.alpha("surface.float", Theme.isDark ? root.topLineDarkOpacity : root.topLineLightOpacity)
            visible: width > 0
        }

        Rectangle {
            anchors.fill: parent
            anchors.margins: 1
            radius: Math.max(0, parent.radius - 1)
            gradient: Gradient {
                orientation: Gradient.Vertical
                GradientStop { position: 0.0; color: Theme.alpha("surface.float", Theme.isDark ? root.sheenDarkOpacity : root.sheenLightOpacity) }
                GradientStop { position: 1.0; color: "transparent" }
            }
        }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.leftMargin: root.topLineMargin
            anchors.rightMargin: root.topLineMargin
            anchors.bottomMargin: 1
            height: 1
            radius: 1
            color: Theme.alpha("line.soft", Theme.isDark ? root.bottomLineDarkOpacity : root.bottomLineLightOpacity)
            visible: width > 0
        }
    }
}
