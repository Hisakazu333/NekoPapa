pragma Singleton
import QtQuick

QtObject {
    id: theme

    property int mode: 0 // 0=light, 1=dark
    readonly property bool isDark: mode === 1

    readonly property var palettes: ({
        0: {
            "bg.canvas":       "#F5F5F7",
            "bg.sidebar":      "#EFEFF4",
            "surface.sunken":  "#F2F2F7",
            "surface.base":    "#FFFFFF",
            "surface.raised":  "#FFFFFF",
            "surface.float":   "#FFFFFF",
            "line.soft":       "#E5E5EA",
            "line.strong":     "#C7C7CC",
            "text.primary":    "#1D1D1F",
            "text.secondary":  "#6E6E73",
            "text.tertiary":   "#8E8E93",
            "accent.base":     "#E85D75",
            "accent.strong":   "#D94863",
            "accent.soft":     "#FCE8ED",
            "text.onAccent":   "#FFFFFF",
            "state.success":   "#34C759",
            "state.warning":   "#FF9F0A",
            "state.danger":    "#FF3B30",
            "overlay.scrim":   "#000000"
        },
        1: {
            "bg.canvas":       "#1C1C1E",
            "bg.sidebar":      "#2C2C2E",
            "surface.sunken":  "#2C2C2E",
            "surface.base":    "#1C1C1E",
            "surface.raised":  "#2C2C2E",
            "surface.float":   "#3A3A3C",
            "line.soft":       "#38383A",
            "line.strong":     "#545458",
            "text.primary":    "#F5F5F7",
            "text.secondary":  "#C7C7CC",
            "text.tertiary":   "#8E8E93",
            "accent.base":     "#FF7A90",
            "accent.strong":   "#FF9BAA",
            "accent.soft":     "#4A252D",
            "text.onAccent":   "#1D1D1F",
            "state.success":   "#30D158",
            "state.warning":   "#FFD60A",
            "state.danger":    "#FF453A",
            "overlay.scrim":   "#000000"
        }
    })

    function color(role: string): color {
        var p = palettes[mode]
        return p[role] || "#FF00FF"
    }

    function alpha(role: string, opacity: real): color {
        var c = color(role)
        return Qt.rgba(c.r, c.g, c.b, opacity)
    }

    readonly property string cCanvas:      color("bg.canvas")
    readonly property string cSidebar:     color("bg.sidebar")
    readonly property string cSurface:     color("surface.base")
    readonly property string cSunken:      color("surface.sunken")
    readonly property string cRaised:      color("surface.raised")
    readonly property string cFloat:       color("surface.float")
    readonly property string cLineSoft:    color("line.soft")
    readonly property string cLineStrong:  color("line.strong")
    readonly property string cText:        color("text.primary")
    readonly property string cText2:       color("text.secondary")
    readonly property string cText3:       color("text.tertiary")
    readonly property string cAccent:      color("accent.base")
    readonly property string cAccentStrong:color("accent.strong")
    readonly property string cAccentSoft:  color("accent.soft")
    readonly property string cOnAccent:    color("text.onAccent")
    readonly property string cSuccess:     color("state.success")
    readonly property string cWarning:     color("state.warning")
    readonly property string cDanger:      color("state.danger")

    readonly property int radiusSm:  8
    readonly property int radiusMd:  14
    readonly property int radiusLg:  22
    readonly property int radiusXl:  30

    // Backward compat — avoid breaking unused components
    function glass(opacity: real): color {
        var base = color("surface.float")
        return Qt.rgba(base.r, base.g, base.b, opacity)
    }

    function shadow(colorRole: string, elevation: int): color {
        var c = color(colorRole)
        var a = elevation === 1 ? 0.05 : elevation === 2 ? 0.10 : elevation === 3 ? 0.15 : 0.20
        return Qt.rgba(c.r, c.g, c.b, a)
    }

    readonly property string fontUi:  "PingFang SC"
    readonly property string fontMono: "Menlo"
}
