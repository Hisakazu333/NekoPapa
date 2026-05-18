import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: root

    property real dockClearance: 0
    readonly property bool loggedIn: appController.accountLoggedIn
    readonly property bool compact: width < 640
    readonly property string displayName: appController.accountUserName !== "" ? appController.accountUserName : (loggedIn ? "Neko Buddy" : "未登录")
    readonly property color sidebarMaterial: Theme.isDark ? "#252227" : "#F3EEF2"
    readonly property color sidebarHover: Theme.isDark ? Theme.alpha("surface.float", 0.45) : Qt.rgba(1, 1, 1, 0.48)
    readonly property color sidebarSearch: Theme.isDark ? Theme.alpha("surface.float", 0.58) : Qt.rgba(1, 1, 1, 0.68)
    readonly property color selectionAccent: Theme.color("accent.strong")
    readonly property color selectionAccentPressed: Theme.color("accent.base")

    function openLoginDialog() {
        loginDialog.open()
    }

    function refreshProfile() {
        appController.refreshAccountProfile()
    }

    function scrollToSettings() {
        if (mainContentLoader.item && mainContentLoader.item.scrollToBottom)
            mainContentLoader.item.scrollToBottom()
    }

    Rectangle {
        anchors.fill: parent
        color: Theme.color("bg.canvas")
    }

    Loader {
        id: mainContentLoader
        anchors.fill: parent
        sourceComponent: root.compact ? compactLayoutComponent : desktopLayoutComponent
    }

    component DesktopLayout: Item {
        function scrollToBottom() {
            accountContent.scrollToBottom()
        }

        RowLayout {
            anchors.fill: parent
            spacing: 0

            AccountSidebar {
                Layout.preferredWidth: Math.min(292, Math.max(238, root.width * 0.32))
                Layout.fillHeight: true
            }

            Rectangle {
                Layout.preferredWidth: 1
                Layout.fillHeight: true
                color: Theme.alpha("line.soft", Theme.isDark ? 0.64 : 0.88)
            }

            AccountContent {
                id: accountContent
                Layout.fillWidth: true
                Layout.fillHeight: true
            }
        }
    }

    component CompactLayout: ScrollView {
        id: compactScroll

        function scrollToBottom() {
            contentItem.contentY = Math.max(0, contentItem.contentHeight - height)
        }

        anchors.fill: parent
        anchors.leftMargin: 16
        anchors.rightMargin: 16
        anchors.topMargin: 16
        anchors.bottomMargin: root.dockClearance + 18
        clip: true
        contentWidth: availableWidth
        contentHeight: compactStack.implicitHeight
        ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

        ColumnLayout {
            id: compactStack
            width: compactScroll.availableWidth
            spacing: 0

            AccountSidebar {
                Layout.fillWidth: true
                Layout.preferredHeight: 318
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 1
                color: Theme.color("line.soft")
            }

            AccountContent {
                Layout.fillWidth: true
                Layout.preferredHeight: 980
            }
        }
    }

    Component {
        id: desktopLayoutComponent
        DesktopLayout {}
    }

    Component {
        id: compactLayoutComponent
        CompactLayout {}
    }

    component AccountSidebar: Rectangle {
        id: sidebar

        color: root.sidebarMaterial
        radius: 0
        clip: true

        ScrollView {
            id: sidebarScroll
            anchors.fill: parent
            anchors.leftMargin: 16
            anchors.rightMargin: 16
            anchors.topMargin: root.compact ? 16 : 28
            anchors.bottomMargin: root.compact ? 16 : 0
            clip: true
            contentWidth: availableWidth
            contentHeight: Math.max(sidebarColumn.implicitHeight, availableHeight) + root.dockClearance + 18
            ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
            ScrollBar.vertical.policy: ScrollBar.AsNeeded

            ColumnLayout {
                id: sidebarColumn
                width: sidebarScroll.availableWidth
                height: Math.max(implicitHeight, sidebarScroll.availableHeight)
                spacing: 8

                SearchField {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 32
                }

                SidebarAccountRow {
                    Layout.fillWidth: true
                    active: true
                    title: root.loggedIn ? root.displayName : "登录 Neko 账户"
                    subtitle: root.loggedIn ? "账号、资产与同步" : "同步资产、同伴与跨端状态"
                    onTriggered: root.loggedIn ? root.refreshProfile() : root.openLoginDialog()
                }

                SidebarSectionLabel { Layout.topMargin: 6; text: "账户" }

                SidebarNavRow { label: "个人信息"; iconPath: Icons.character; tone: Theme.color("accent.strong") }
                SidebarNavRow { label: "登录与安全性"; iconPath: Icons.check; tone: "#34C759" }
                SidebarNavRow { label: "资产与钱包"; iconPath: Icons.sparkle; tone: "#FF9F0A" }
                SidebarNavRow { label: "云同步"; iconPath: Icons.iot; tone: "#5E5CE6" }

                SidebarSectionLabel { Layout.topMargin: 8; text: "Neko Buddy" }

                SidebarNavRow { label: "我的同伴"; iconPath: Icons.heart; tone: Theme.color("accent.strong") }
                SidebarNavRow { label: "形象与声音"; iconPath: Icons.volume; tone: "#AF52DE" }
                SidebarNavRow { label: "桌面常驻"; iconPath: Icons.home; tone: "#0A84FF" }
                SidebarNavRow { label: "推送到手机"; iconPath: Icons.send; tone: "#FF9500" }

                SidebarSectionLabel { Layout.topMargin: 8; text: "偏好" }

                SidebarNavRow { label: "通知"; iconPath: Icons.bell; tone: "#FF3B30" }
                SidebarNavRow { label: "外观与主题"; iconPath: Icons.moon; tone: "#5856D6" }
                SidebarNavRow { label: "快捷操作"; iconPath: Icons.zap; tone: "#FFD60A" }
                SidebarNavRow { label: "记忆与内容"; iconPath: Icons.memory; tone: "#AF52DE" }

                SidebarSectionLabel { Layout.topMargin: 8; text: "系统" }

                SidebarNavRow { label: "隐私与数据"; iconPath: Icons.check; tone: "#34C759" }
                SidebarNavRow { label: "设置中心"; iconPath: Icons.settings; tone: "#8E8E93" }
                SidebarNavRow { label: "实验功能"; iconPath: Icons.ability; tone: "#FF2D55" }
                SidebarNavRow { label: "帮助与反馈"; iconPath: Icons.chat; tone: "#0A84FF" }
                SidebarNavRow { label: "关于 OpenNeko"; iconPath: Icons.more; tone: "#FF9F0A" }

                Item { Layout.fillHeight: true }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 50
                    radius: 12
                    color: Theme.isDark ? Theme.alpha("surface.float", 0.34) : Qt.rgba(1, 1, 1, 0.38)

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 12
                        anchors.rightMargin: 12
                        spacing: 9

                        StatusDot {
                            active: root.loggedIn
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 1

                            Text {
                                Layout.fillWidth: true
                                text: root.loggedIn ? "OpenNeko Cloud" : "本地模式"
                                elide: Text.ElideRight
                                font.pixelSize: 12
                                font.family: Theme.fontUi
                                font.weight: Font.DemiBold
                                color: Theme.color("text.primary")
                            }

                            Text {
                                Layout.fillWidth: true
                                text: root.loggedIn ? "同步正常" : "登录后启用同步"
                                elide: Text.ElideRight
                                font.pixelSize: 11
                                font.family: Theme.fontUi
                                color: Theme.color("text.secondary")
                            }
                        }
                    }
                }
            }
        }
    }

    component AccountContent: Item {
        id: content

        function scrollToBottom() {
            accountScroll.contentItem.contentY = Math.max(0, accountScroll.contentItem.contentHeight - accountScroll.height)
        }

        Rectangle {
            anchors.fill: parent
            color: Theme.color("surface.base")
        }

        ColumnLayout {
            anchors.fill: parent
            spacing: 0

            MainToolbar {
                Layout.fillWidth: true
                Layout.preferredHeight: 54
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 1
                color: Theme.alpha("line.soft", Theme.isDark ? 0.68 : 0.92)
            }

            ScrollView {
                id: accountScroll
                Layout.fillWidth: true
                Layout.fillHeight: true
                clip: true
                contentWidth: availableWidth
                contentHeight: scrollHost.height
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

                Item {
                    id: scrollHost
                    width: accountScroll.availableWidth
                    height: accountColumn.implicitHeight + root.dockClearance + 52

                    ColumnLayout {
                        id: accountColumn
                        width: Math.min(parent.width - (root.compact ? 24 : 72), 640)
                        anchors.horizontalCenter: parent.horizontalCenter
                        anchors.top: parent.top
                        anchors.topMargin: root.compact ? 24 : 34
                        spacing: 18

                        Text {
                            Layout.fillWidth: true
                            text: "Neko 账户"
                            font.pixelSize: 30
                            font.family: Theme.fontUi
                            font.weight: Font.DemiBold
                            color: Theme.color("text.primary")
                        }

                        AccountHero {
                            Layout.fillWidth: true
                            Layout.topMargin: root.compact ? 8 : 10
                        }

                        GroupedSection {
                            Layout.fillWidth: true
                            Layout.topMargin: 10
                            title: "账户"

                            SettingsCell {
                                iconPath: Icons.character
                                title: root.loggedIn ? "个人信息" : "登录账号"
                                subtitle: root.loggedIn ? ("UID " + appController.accountUserId) : "登录后同步资产、同伴和跨端状态"
                                valueText: root.loggedIn ? root.displayName : "未登录"
                                tone: root.selectionAccent
                                onTriggered: if (!root.loggedIn) root.openLoginDialog()
                            }
                            SettingsDivider {}
                            SettingsCell {
                                iconPath: Icons.check
                                title: "登录与安全性"
                                subtitle: root.loggedIn ? "Token 已保存到本机运行态" : "等待登录凭据"
                                valueText: root.loggedIn ? "已配置" : "未配置"
                                stateColor: root.loggedIn ? Theme.color("state.success") : Theme.color("text.tertiary")
                                tone: "#34C759"
                                onTriggered: root.openLoginDialog()
                            }
                            SettingsDivider {}
                            SettingsCell {
                                iconPath: Icons.sparkle
                                title: "资产余额"
                                subtitle: "猫币 " + appController.accountCoinBalance + " · 猫粮 " + appController.accountFoodBalance + " · 猫条 " + appController.accountTreatBalance
                                valueText: "云点 " + Number(appController.accountCloudPointBalance).toFixed(1)
                                tone: Theme.color("accent.strong")
                            }
                        }

                        GroupedSection {
                            Layout.fillWidth: true
                            title: "同伴"

                            SettingsCell {
                                iconPath: Icons.heart
                                title: "当前同伴"
                                subtitle: appController.characterName
                                valueText: "管理"
                                tone: Theme.color("accent.strong")
                            }
                            SettingsDivider {}
                            SettingsCell {
                                iconPath: Icons.send
                                title: "推送到手机"
                                subtitle: root.loggedIn ? "同步当前同伴到移动端" : "登录后可用"
                                valueText: root.loggedIn ? "可用" : "未登录"
                                stateColor: root.loggedIn ? Theme.color("text.secondary") : Theme.color("text.tertiary")
                                tone: "#FF9F0A"
                                enabled: root.loggedIn && !appController.syncBusy
                                onTriggered: if (root.loggedIn) appController.pushCurrentCompanionToMobile()
                            }
                        }

                        GroupedSection {
                            Layout.fillWidth: true
                            title: "桌面与跨端"

                            SettingsCell {
                                iconPath: Icons.home
                                title: "OpenNeko Engine"
                                subtitle: "本机桌面端"
                                valueText: "已连接"
                                stateColor: Theme.color("state.success")
                                tone: Theme.color("accent.strong")
                            }
                            SettingsDivider {}
                            SettingsCell {
                                iconPath: Icons.character
                                title: "手机控制端"
                                subtitle: root.loggedIn ? "账号已同步" : "等待登录"
                                valueText: root.loggedIn ? "在线" : "未登录"
                                stateColor: root.loggedIn ? Theme.color("state.success") : Theme.color("text.tertiary")
                                tone: "#5E5CE6"
                            }
                            SettingsDivider {}
                            SettingsSwitchCell {
                                iconPath: Icons.home
                                title: "桌面常驻"
                                subtitle: "让同伴留在桌面上"
                                checked: appController.desktopCompanionEnabled
                                tone: "#5856D6"
                                onSwitchChanged: function(checked) { appController.desktopCompanionEnabled = checked }
                            }
                        }

                        GroupedSection {
                            Layout.fillWidth: true
                            title: "隐私与数据"

                            SettingsCell {
                                iconPath: Icons.check
                                title: "本地优先"
                                subtitle: "主要数据保留在本机"
                                valueText: "已启用"
                                stateColor: Theme.color("state.success")
                                tone: "#34C759"
                            }
                            SettingsDivider {}
                            SettingsCell {
                                iconPath: Icons.memory
                                title: "加密记忆库"
                                subtitle: "冷数据加密存储"
                                valueText: "已启用"
                                stateColor: Theme.color("state.success")
                                tone: "#AF52DE"
                            }
                            SettingsDivider {}
                            SettingsCell {
                                iconPath: Icons.more
                                title: "关于 OpenNeko"
                                subtitle: "版本、许可与运行信息"
                                valueText: ""
                                tone: "#8E8E93"
                            }
                        }
                    }
                }
            }
        }
    }

    component MainToolbar: Rectangle {
        color: Theme.color("surface.base")

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: root.compact ? 14 : 18
            anchors.rightMargin: root.compact ? 14 : 18
            spacing: 12

            NavigationStepper {
                Layout.preferredWidth: 74
                Layout.preferredHeight: 30
            }

            Text {
                Layout.fillWidth: true
                text: "我的"
                elide: Text.ElideRight
                font.pixelSize: 14
                font.family: Theme.fontUi
                font.weight: Font.DemiBold
                color: Theme.color("text.primary")
            }

            NNABaseButton {
                Layout.preferredWidth: root.loggedIn ? 92 : 88
                Layout.preferredHeight: 32
                text: root.loggedIn ? "刷新" : "登录"
                iconPath: root.loggedIn ? Icons.search : Icons.character
                enabled: !appController.syncBusy
                buttonType: NNABaseButton.ButtonType.Secondary
                onClicked: root.loggedIn ? root.refreshProfile() : root.openLoginDialog()
            }
        }
    }

    component NavigationStepper: Rectangle {
        radius: 8
        color: Theme.isDark ? Theme.alpha("surface.float", 0.42) : Theme.color("surface.sunken")
        border.color: Theme.alpha("line.soft", Theme.isDark ? 0.74 : 0.95)
        border.width: 1

        RowLayout {
            anchors.fill: parent
            spacing: 0

            ToolbarIconButton {
                Layout.fillWidth: true
                Layout.fillHeight: true
                iconPath: Icons.chevronLeft
                enabledButton: false
            }

            Rectangle {
                Layout.preferredWidth: 1
                Layout.fillHeight: true
                color: Theme.color("line.soft")
            }

            ToolbarIconButton {
                Layout.fillWidth: true
                Layout.fillHeight: true
                iconPath: Icons.chevronRight
                enabledButton: false
            }
        }
    }

    component ToolbarIconButton: Rectangle {
        id: tool
        property string iconPath: ""
        property bool enabledButton: true

        color: iconMouse.containsMouse && enabledButton ? Theme.alpha("surface.raised", 0.78) : "transparent"
        opacity: enabledButton ? 1 : 0.42

        ShapeIcon {
            anchors.centerIn: parent
            pathData: tool.iconPath
            size: 13
            iconColor: Theme.color("text.secondary")
        }

        MouseArea {
            id: iconMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: tool.enabledButton ? Qt.PointingHandCursor : Qt.ArrowCursor
        }
    }

    component SearchField: Rectangle {
        radius: 8
        color: root.sidebarSearch
        border.color: Theme.alpha("line.soft", Theme.isDark ? 0.52 : 0.62)
        border.width: 1

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 9
            anchors.rightMargin: 9
            spacing: 7

            ShapeIcon {
                pathData: Icons.search
                size: 14
                iconColor: Theme.color("text.tertiary")
            }

            Text {
                Layout.fillWidth: true
                text: "搜索"
                font.pixelSize: 13
                font.family: Theme.fontUi
                color: Theme.color("text.tertiary")
            }
        }
    }

    component SidebarAccountRow: Rectangle {
        id: row
        property bool active: false
        property string title: ""
        property string subtitle: ""
        signal triggered()

        Layout.preferredHeight: 56
        radius: 10
        color: row.active
            ? (rowMouse.pressed ? root.selectionAccentPressed : root.selectionAccent)
            : (rowMouse.containsMouse ? root.sidebarHover : "transparent")

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 9
            anchors.rightMargin: 9
            spacing: 9

            AvatarBubble {
                Layout.preferredWidth: 34
                Layout.preferredHeight: 34
                selected: row.active
                compactAvatar: true
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 1

                Text {
                    Layout.fillWidth: true
                    text: row.title
                    elide: Text.ElideRight
                    font.pixelSize: 13
                    font.family: Theme.fontUi
                    font.weight: Font.DemiBold
                    color: row.active ? "#FFFFFF" : Theme.color("text.primary")
                }

                Text {
                    Layout.fillWidth: true
                    text: row.subtitle
                    elide: Text.ElideRight
                    font.pixelSize: 11
                    font.family: Theme.fontUi
                    color: row.active ? Qt.rgba(1, 1, 1, 0.74) : Theme.color("text.secondary")
                }
            }

            ShapeIcon {
                pathData: Icons.chevronRight
                size: 12
                iconColor: row.active ? Qt.rgba(1, 1, 1, 0.72) : Theme.color("text.tertiary")
            }
        }

        MouseArea {
            id: rowMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: row.triggered()
        }
    }

    component SidebarSectionLabel: Text {
        Layout.fillWidth: true
        Layout.leftMargin: 4
        font.pixelSize: 11
        font.family: Theme.fontUi
        font.weight: Font.DemiBold
        color: Theme.color("text.tertiary")
    }

    component SidebarNavRow: Rectangle {
        id: row
        property string label: ""
        property string iconPath: ""
        property bool active: false
        property color tone: Theme.color("accent.strong")

        Layout.fillWidth: true
        Layout.preferredHeight: 34
        radius: 8
        color: active
            ? root.selectionAccent
            : (navMouse.containsMouse ? root.sidebarHover : "transparent")

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 8
            anchors.rightMargin: 8
            spacing: 9

            Rectangle {
                Layout.preferredWidth: 22
                Layout.preferredHeight: 22
                radius: 6
                color: row.active ? Qt.rgba(1, 1, 1, 0.18) : row.tone

                ShapeIcon {
                    anchors.centerIn: parent
                    pathData: row.iconPath
                    size: 13
                    iconColor: "#FFFFFF"
                }
            }

            Text {
                Layout.fillWidth: true
                text: row.label
                elide: Text.ElideRight
                font.pixelSize: 13
                font.family: Theme.fontUi
                font.weight: row.active ? Font.DemiBold : Font.Medium
                color: row.active ? "#FFFFFF" : Theme.color("text.primary")
            }
        }

        MouseArea {
            id: navMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
        }
    }

    component AccountHero: ColumnLayout {
        spacing: 8

        AvatarBubble {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 102
            Layout.preferredHeight: 102
            selected: false
            compactAvatar: false
        }

        Text {
            Layout.fillWidth: true
            text: root.displayName
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
            font.pixelSize: 24
            font.family: Theme.fontUi
            font.weight: Font.DemiBold
            color: Theme.color("text.primary")
        }

        Text {
            Layout.fillWidth: true
            text: appController.accountUserId > 0 ? ("UID " + appController.accountUserId) : "未登录账号"
            horizontalAlignment: Text.AlignHCenter
            font.pixelSize: 13
            font.family: Theme.fontUi
            color: Theme.color("text.secondary")
        }

        StatusCapsule {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 2
            text: root.loggedIn ? "同步正常" : "等待登录"
            active: root.loggedIn
        }
    }

    component AvatarBubble: Rectangle {
        id: avatar
        property bool selected: false
        property bool compactAvatar: false

        radius: width / 2
        color: selected ? Qt.rgba(1, 1, 1, 0.95) : (root.loggedIn ? Theme.color("accent.soft") : Theme.color("surface.sunken"))
        border.color: selected ? Qt.rgba(1, 1, 1, 0.72) : Theme.alpha(root.loggedIn ? "accent.base" : "line.soft", 0.70)
        border.width: 1
        clip: true

        Image {
            id: avatarImage
            anchors.fill: parent
            source: appController.accountAvatarUrl
            fillMode: Image.PreserveAspectCrop
            visible: appController.accountAvatarUrl !== "" && status === Image.Ready
        }

        Text {
            anchors.centerIn: parent
            visible: appController.accountAvatarUrl === "" || avatarImage.status === Image.Error
            text: root.loggedIn ? root.displayName.charAt(0).toUpperCase() : "我"
            font.pixelSize: avatar.compactAvatar ? 15 : 38
            font.family: Theme.fontUi
            font.weight: Font.DemiBold
            color: Theme.color("accent.strong")
        }
    }

    component GroupedSection: ColumnLayout {
        id: section
        property string title: ""
        default property alias rows: groupBody.data

        spacing: 7

        Text {
            Layout.fillWidth: true
            Layout.leftMargin: 14
            text: section.title
            font.pixelSize: 12
            font.family: Theme.fontUi
            font.weight: Font.Medium
            color: Theme.color("text.secondary")
        }

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: groupBody.implicitHeight
            radius: 12
            color: Theme.color("surface.raised")
            border.color: Theme.alpha("line.soft", Theme.isDark ? 0.70 : 0.92)
            border.width: 1
            clip: true

            ColumnLayout {
                id: groupBody
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.top: parent.top
                spacing: 0
            }
        }
    }

    component SettingsCell: Rectangle {
        id: cell
        property string iconPath: ""
        property string title: ""
        property string subtitle: ""
        property string valueText: ""
        property color stateColor: Theme.color("text.secondary")
        property color tone: Theme.color("accent.strong")
        property bool showChevron: true
        signal triggered()

        Layout.fillWidth: true
        Layout.preferredHeight: 62
        color: cellMouse.containsMouse && cell.enabled ? Theme.alpha("surface.sunken", Theme.isDark ? 0.38 : 0.58) : "transparent"
        opacity: enabled ? 1 : 0.48

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 12
            spacing: 12

            SettingsIconTile {
                iconPath: cell.iconPath
                tone: cell.tone
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2

                Text {
                    Layout.fillWidth: true
                    text: cell.title
                    elide: Text.ElideRight
                    font.pixelSize: 14
                    font.family: Theme.fontUi
                    font.weight: Font.Medium
                    color: Theme.color("text.primary")
                }

                Text {
                    Layout.fillWidth: true
                    text: cell.subtitle
                    visible: cell.subtitle !== ""
                    elide: Text.ElideRight
                    font.pixelSize: 12
                    font.family: Theme.fontUi
                    color: Theme.color("text.secondary")
                }
            }

            Text {
                visible: cell.valueText !== ""
                text: cell.valueText
                elide: Text.ElideRight
                font.pixelSize: 13
                font.family: Theme.fontUi
                font.weight: Font.Medium
                color: cell.stateColor
            }

            ShapeIcon {
                visible: cell.showChevron
                pathData: Icons.chevronRight
                size: 12
                iconColor: Theme.color("text.tertiary")
            }
        }

        MouseArea {
            id: cellMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: cell.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: if (cell.enabled) cell.triggered()
        }
    }

    component SettingsSwitchCell: Rectangle {
        id: cell
        property string iconPath: ""
        property string title: ""
        property string subtitle: ""
        property bool checked: false
        property color tone: Theme.color("accent.strong")
        signal switchChanged(bool checked)

        Layout.fillWidth: true
        Layout.preferredHeight: 62
        color: switchMouse.containsMouse ? Theme.alpha("surface.sunken", Theme.isDark ? 0.38 : 0.58) : "transparent"

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 14
            anchors.rightMargin: 14
            spacing: 12

            SettingsIconTile {
                iconPath: cell.iconPath
                tone: cell.tone
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2

                Text {
                    Layout.fillWidth: true
                    text: cell.title
                    elide: Text.ElideRight
                    font.pixelSize: 14
                    font.family: Theme.fontUi
                    font.weight: Font.Medium
                    color: Theme.color("text.primary")
                }

                Text {
                    Layout.fillWidth: true
                    text: cell.subtitle
                    elide: Text.ElideRight
                    font.pixelSize: 12
                    font.family: Theme.fontUi
                    color: Theme.color("text.secondary")
                }
            }

            AppleSwitch {
                checked: cell.checked
                onToggled: function(checked) { cell.switchChanged(checked) }
            }
        }

        MouseArea {
            id: switchMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: cell.switchChanged(!cell.checked)
        }
    }

    component SettingsDivider: Rectangle {
        Layout.fillWidth: true
        Layout.leftMargin: 60
        Layout.preferredHeight: 1
        color: Theme.alpha("line.soft", Theme.isDark ? 0.68 : 0.92)
    }

    component SettingsIconTile: Rectangle {
        property string iconPath: ""
        property color tone: Theme.color("accent.strong")

        Layout.preferredWidth: 30
        Layout.preferredHeight: 30
        radius: 7
        color: tone

        ShapeIcon {
            anchors.centerIn: parent
            pathData: parent.iconPath
            size: 16
            iconColor: "#FFFFFF"
        }
    }

    component AppleSwitch: Rectangle {
        id: switchControl
        property bool checked: false
        signal toggled(bool checked)

        implicitWidth: 48
        implicitHeight: 28
        Layout.preferredWidth: implicitWidth
        Layout.preferredHeight: implicitHeight
        radius: height / 2
        color: checked ? "#34C759" : (Theme.isDark ? "#5A5A60" : "#D1D1D6")

        Behavior on color { ColorAnimation { duration: 140 } }

        Rectangle {
            width: 24
            height: 24
            radius: 12
            x: switchControl.checked ? switchControl.width - width - 2 : 2
            y: 2
            color: "#FFFFFF"

            Behavior on x { NumberAnimation { duration: 140; easing.type: Easing.OutCubic } }
        }

        MouseArea {
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: {
                switchControl.checked = !switchControl.checked
                switchControl.toggled(switchControl.checked)
            }
        }
    }

    component StatusCapsule: Rectangle {
        id: pill
        property string text: ""
        property bool active: false

        implicitWidth: pillLabel.implicitWidth + 22
        implicitHeight: 25
        Layout.preferredWidth: implicitWidth
        Layout.preferredHeight: implicitHeight
        radius: height / 2
        color: active ? Theme.alpha("state.success", 0.12) : Theme.color("surface.sunken")
        border.color: active ? Theme.alpha("state.success", 0.45) : Theme.color("line.soft")
        border.width: 1

        Text {
            id: pillLabel
            anchors.centerIn: parent
            text: pill.text
            font.pixelSize: 12
            font.family: Theme.fontUi
            font.weight: Font.Medium
            color: active ? Theme.color("state.success") : Theme.color("text.secondary")
        }
    }

    component StatusDot: Rectangle {
        property bool active: false

        Layout.preferredWidth: 10
        Layout.preferredHeight: 10
        radius: 5
        color: active ? Theme.color("state.success") : Theme.color("text.tertiary")
        border.color: Theme.alpha("surface.base", 0.82)
        border.width: 1
    }

    Dialog {
        id: loginDialog
        modal: true
        width: Math.min(root.width - 80, 460)
        title: "登录账号"
        standardButtons: Dialog.NoButton
        anchors.centerIn: parent

        contentItem: ColumnLayout {
            spacing: 12

            NNABaseInput {
                id: baseUrlInput
                Layout.fillWidth: true
                Layout.preferredHeight: 46
                placeholderText: "后端地址"
                text: appController.syncBackendBaseUrl
            }

            NNABaseInput {
                id: tokenInput
                Layout.fillWidth: true
                Layout.preferredHeight: 46
                placeholderText: "Bearer Token"
                echoMode: TextInput.Password
                text: appController.syncAuthToken
            }

            Text {
                Layout.fillWidth: true
                visible: appController.syncStatusText !== "" || appController.syncLastError !== ""
                text: appController.syncLastError !== "" ? appController.syncLastError : appController.syncStatusText
                wrapMode: Text.Wrap
                font.pixelSize: 12
                font.family: Theme.fontUi
                color: appController.syncLastError !== "" ? Theme.color("state.danger") : Theme.color("text.secondary")
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 10

                NNABaseButton {
                    text: "取消"
                    buttonType: NNABaseButton.ButtonType.Secondary
                    onClicked: loginDialog.close()
                }

                Item { Layout.fillWidth: true }

                NNABaseButton {
                    text: "退出登录"
                    enabled: root.loggedIn
                    buttonType: NNABaseButton.ButtonType.Ghost
                    onClicked: {
                        appController.logoutAccount()
                        tokenInput.text = ""
                    }
                }

                NNABaseButton {
                    text: "登录"
                    iconPath: Icons.check
                    enabled: !appController.syncBusy
                    buttonType: NNABaseButton.ButtonType.Primary
                    onClicked: appController.loginWithToken(baseUrlInput.text, tokenInput.text)
                }
            }
        }
    }
}
