export type ApplicationLanguage = "zh-CN" | "en-US";

const copyPairs = [
  ["工作台", "Workspace"], ["联系人", "Contacts"], ["设置", "Settings"],
  ["快速搜索", "Quick Search"], ["搜索结果", "Search results"], ["页面", "Pages"],
  ["搜索聊天、联系人和设置", "Search chats, contacts, and settings"],
  ["搜索会话内容、联系人名称和设置", "Search conversations, contacts, and settings"],
  ["未找到匹配内容", "No matching results"], ["最近对话", "Recent conversations"],
  ["聊天后会显示在这里", "Your recent conversations will appear here"], ["查看全部对话", "View all conversations"],
  ["现在", "now"], ["项目文件夹", "Project folder"], ["选择项目文件夹", "Choose project folder"], ["不使用项目文件夹", "No project folder"],
  ["添加文件夹", "Add folder"], ["添加", "Add"], ["浏览文件夹", "Browse folders"], ["请输入文件夹路径。", "Enter a folder path."],
  ["请输入有效的文件夹路径。", "Enter a valid folder path."], ["项目", "Projects"], ["添加项目文件夹", "Add project folder"],
  ["聊天后会显示在这里。用 + 添加项目文件夹，对话会按项目分组。", "Chats appear here. Use + to add a project folder and group chats by project."], ["对话", "Chats"], ["还没有对话", "No chats yet"],
  ["在此项目中新建对话", "New chat in this project"],
  ["只用于给对话分组；浏览只能读取文件夹名称，需要完整路径时请直接输入。", "Only used to group chats. Browsing can read the folder name only; type the full path when you need it."],
  ["打开页面", "Open page"], ["聊天记录", "Chats"], ["联系人对话", "Contact conversations"],
  ["官方同伴", "Official companion"], ["自建联系人", "Custom contact"],
  ["Filter workspace navigation", "搜索工作区导航"], ["快速搜索", "Quick Search"],
  ["Clear navigation search", "清除导航搜索"], ["Close sidebar", "关闭侧栏"],
  ["Expand sidebar", "展开侧栏"], ["Collapse sidebar", "收起侧栏"],
  ["调整主侧栏宽度", "Resize main sidebar"], ["账号菜单", "Account menu"],
  ["账号", "Account"], ["偏好", "Preferences"], ["工作区", "Workspace"],
  ["支持", "Support"], ["登录 NekoPapa", "Sign in to NekoPapa"],
  ["本机资料", "Local profile"], ["未登录", "Signed out"], ["登录暂未开放", "Sign-in unavailable"],
  ["模型与 API", "Models & API"], ["工具与技能", "Tools & skills"], ["数据与备份", "Data & backups"],
  ["外观", "Appearance"], ["主题", "Theme"], ["跟随系统", "Follow system"],
  ["浅色", "Light"], ["深色", "Dark"], ["强调色", "Accent color"],
  ["鼠尾草绿", "Sage green"], ["蓝色", "Blue"], ["紫色", "Purple"], ["暖橙色", "Warm orange"],
  ["当前窗口中的外观已保存。", "Appearance saved for this window."],
  ["本机保存已恢复，当前草稿仍保留。保存外观后应用你的选择。", "Local storage is available again. Your draft is preserved; save it to apply your choices."],
  ["帮助文档", "Documentation"],
  ["反馈问题", "Send feedback"], ["设置分类", "Settings sections"], ["关闭设置", "Close settings"],
  ["NekoPapa 设置", "NekoPapa settings"], ["常规", "General"], ["个人资料", "Profile"],
  ["切换界面语言", "Change interface language"], ["界面语言", "Interface language"],
  ["无法读取设置，界面语言尚未更改。", "Settings could not be read. The interface language was not changed."],
  ["界面语言未能保存。", "The interface language could not be saved."],
  ["Agent 默认值", "Agent defaults"], ["个性化与记忆", "Personalization & memory"],
  ["语音偏好", "Voice preferences"], ["Live2D 陪伴窗口", "Live2D companion window"],
  ["电脑操作", "Computer use"], ["活动记录", "Activity history"], ["应用快照", "App snapshots"],
  ["浏览器", "Browser"], ["设备与 SSH", "Devices & SSH"], ["Coding 默认值", "Coding defaults"],
  ["生命周期钩子", "Lifecycle hooks"], ["代码审查", "Code review"], ["Git", "Git"],
  ["工作树", "Worktrees"], ["快捷键", "Keyboard shortcuts"], ["关于", "About"],
  ["MCP 与连接器", "MCP & connectors"], ["技能", "Skills"], ["隐私", "Privacy"], ["权限规则", "Permission rules"],
  ["上下文与指令", "Context & instructions"], ["编辑器与终端", "Editor & terminal"],
  ["智能与工具", "Agents & tools"], ["桌面与设备", "Desktop & devices"],
  ["开发", "Development"], ["应用", "Application"],
  ["更改应用界面文案；聊天内容与联系人名称保留原文。", "Change app interface labels. Chat content and contact names remain unchanged."],
  ["切换侧栏、快速搜索与设置导航文案；聊天内容和联系人名称保持原文。", "Switch the sidebar, quick search, and settings navigation language. Chat content and contact names stay unchanged."],
  ["简体中文", "Chinese (Simplified)"], ["English", "English"],
  ["语言", "Language"],
  ["界面语言", "Interface language"], ["选择界面语言", "Choose interface language"],
  ["无法保存界面语言；当前语言未更改。", "Could not save the interface language. The current language was not changed."],
  ["查看本机工作区，并管理常用设置。", "Review your local workspace and manage common preferences."],
  ["你的身份、NekoPapa 账号和本机使用记录。", "Your identity, NekoPapa account, and usage on this device."],
  ["编辑资料", "Edit profile"], ["添加一段介绍…", "Add an introduction…"], ["未登录 · 名称和介绍只保存在此设备", "Signed out · Name and bio stay on this device"],
  ["NekoPapa 账号", "NekoPapa account"], ["官方账号服务暂未开放", "The official account service is not open yet"], ["查看登录页", "View sign-in page"],
  ["本机资料、聊天记录和自定义 API 配置始终保存在此设备。", "Local profile, chats, and custom API profiles always stay on this device."],
  ["本机使用", "Usage on this device"], ["来自此设备的聊天记录，不会上传", "From chats on this device; never uploaded"],
  ["发送的消息", "Messages sent"], ["活跃天数", "Active days"], ["最长连续", "Longest streak"], ["近一年", "Past year"], ["天", "days"],
  ["常用项目", "Frequent projects"], ["少", "Less"], ["多", "More"], ["正在读取本机聊天记录…", "Reading chats on this device…"],
  ["发送第一条消息后，这里会记录你的活跃日。", "Send your first message to start recording active days."],
  ["周一", "Mon"], ["周三", "Wed"], ["周五", "Fri"], ["1月", "Jan"], ["2月", "Feb"], ["3月", "Mar"], ["4月", "Apr"], ["5月", "May"], ["6月", "Jun"],
  ["7月", "Jul"], ["8月", "Aug"], ["9月", "Sep"], ["10月", "Oct"], ["11月", "Nov"], ["12月", "Dec"],
  ["名称、介绍和网站只保存在此设备。登录 NekoPapa 账号后，账号名称和头像会优先显示。", "Name, bio, and website stay on this device. After you sign in, your account name and avatar take priority."],
  ["可选，显示在个人资料中。", "Optional. Shown on your profile."],
  ["资料、默认配置和设置备份保存在当前设备。", "Profile details, defaults, and settings backups are stored on this device."],
  ["外观偏好", "Appearance preferences"], ["选择当前工作区的主题模式。", "Choose a theme for the current workspace."],
  ["模型与自定义 API", "Models & custom APIs"], ["管理本机模型连接配置。", "Manage model connection profiles stored on this device."],
  ["保存新运行的模型、回复和权限偏好。", "Set model, response, and permission defaults for new runs."],
  ["保存自定义指令与未来的记忆策略。", "Save custom instructions and future memory preferences."],
  ["保存语音输入与聊天的默认配置。", "Set defaults for voice input and conversation."],
  ["管理 MCP、技能目录和连接器配置。", "Manage MCP, skill catalog, and connector settings."],
  ["导出、校验和恢复 NekoPapa 本机设置。", "Export, validate, and restore NekoPapa settings on this device."],
  ["保存未来桌面角色的显示和窗口偏好。", "Set display and window preferences for a future desktop companion."],
  ["保存未来电脑操作工具的默认范围。", "Set default scope for future computer-use tools."],
  ["设置未来活动记录服务的采集与保留策略。", "Set collection and retention preferences for future activity history."],
  ["保存未来快照服务的输出偏好。", "Set output preferences for a future snapshot service."],
  ["保存未来浏览器服务的链接和批注偏好。", "Set link and annotation preferences for a future browser service."],
  ["管理远程设备连接信息。", "Manage remote device connection details."],
  ["保存 Pi 项目与代码编辑的默认配置。", "Set defaults for Pi projects and code editing."],
  ["管理未来运行服务的事件与命令配置。", "Manage event and command settings for a future runtime service."],
  ["保存代码审查与安全审查的默认配置。", "Set defaults for code and security reviews."],
  ["保存分支、提交和 Pull Request 偏好。", "Set branch, commit, and pull request preferences."],
  ["保存未来 Git 工作树管理的目录和清理偏好。", "Set directory and cleanup preferences for future Git worktrees."],
  ["当前聊天页面已经支持的键盘操作。", "Keyboard actions currently supported in chat."],
  ["搜索会话内容、联系人名称和设置分类。", "Search conversation content, contact names, and settings categories."],
  ["应用版本与项目支持。", "App version and project support."],
  ["本机资料", "Local profile"], ["编辑账号菜单显示的名称、介绍和个人网站。", "Edit the name, bio, and website shown in the account menu."],
  ["已保存的模型配置", "Saved model profiles"], ["已保存的工具配置", "Saved tool profiles"],
  ["已保存的设备配置", "Saved device profiles"], ["已保存的钩子配置", "Saved hook profiles"],
  ["导出当前设置，或检查备份后再恢复。", "Export current settings or inspect a backup before restoring it."],
  ["查看当前聊天页支持的键盘操作。", "Review keyboard actions supported on the current chat page."],
  ["编辑", "Edit"], ["管理", "Manage"], ["打开", "Open"], ["查看", "View"],
  ["恢复默认", "Reset to default"], ["保存设置", "Save settings"], ["取消", "Cancel"], ["关闭", "Close"],
  ["对话模式", "Conversation mode"], ["权限控制", "Permission control"], ["选择聊天模型", "Choose chat model"],
  ["发送消息", "Send message"], ["插入换行", "Insert line break"], ["关闭弹窗", "Close dialog"],
  ["打开或关闭设置", "Open or close settings"],
  ["在聊天输入框中发送；需要可用的模型连接。", "Send from the chat composer when a model is connected."],
  ["在聊天输入框中继续编写多行消息。", "Continue a multiline message in the chat composer."],
  ["关闭当前可取消的对话框。", "Close the current dismissible dialog."],
  ["macOS 使用 ⌘，Windows 和 Linux 使用 Ctrl。", "Use ⌘ on macOS and Ctrl on Windows or Linux."],
  ["今天有什么想聊的？", "What would you like to talk about?"], ["早上好。", "Good morning."],
  ["下午好。", "Good afternoon."], ["晚上好。", "Good evening."],
  ["发送消息", "Send message"], ["今天", "Today"], ["聊聊今天", "Talk about today"],
  ["一起放松", "Relax together"], ["给你一点灵感", "A little inspiration"], ["换一个灵感", "Another idea"],
  ["连接模型后即可发送", "Connect a model to send"], ["配置模型", "Configure model"],
  ["选择一位联系人，开始聊天", "Choose a contact to start chatting"],
  ["官方人物使用固定设定，仅用于单人陪伴聊天和学习。学习模式尚未接入。", "Official companions use fixed profiles for one-to-one conversation and study. Study execution is not connected yet."],
  ["New chat", "新对话"], ["Recent", "最近"], ["Chats you start show up here.", "聊天后会显示在这里。"],
  ["Local chats", "本机聊天"], ["No chats to export", "没有可导出的聊天"], ["This page", "此页面"],
  ["No results", "没有匹配结果"], ["关闭导航", "Close navigation"], ["切换侧栏", "Toggle sidebar"],
  ["Copied", "已复制"], ["Copy message", "复制消息"], ["Stop reading aloud", "停止朗读"], ["Read aloud", "朗读"],
  ["just now", "刚刚"], ["版本 0.1.0", "Version 0.1.0"],
  ["一个正在开发的 AI 桌面伙伴，陪你聊天，也为未来的代码项目与桌面协作准备工作区。", "An AI desktop companion in development, built for conversation and future coding and desktop workflows."],
  ["打开文档", "Open documentation"], ["前往反馈", "Send feedback"], ["开源许可证", "Open-source license"],
  ["聊天界面基于 BoardUI。账号、Live2D、语音与工具执行等能力以各设置页说明的实际接入状态为准。", "The chat interface is based on BoardUI. Account, Live2D, voice, and tool execution are available only as described in their settings pages."],
] as const;

const englishToChinese = new Map<string, string>();
const chineseToEnglish = new Map<string, string>();
for (const [chinese, english] of copyPairs) {
  if (!chineseToEnglish.has(chinese)) chineseToEnglish.set(chinese, english);
  if (!englishToChinese.has(english)) englishToChinese.set(english, chinese);
}

export function applicationLanguage(value: unknown): ApplicationLanguage {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function translateApplicationCopy(text: string, language: ApplicationLanguage) {
  if (language === "en-US") {
    const dynamic = text.match(/^已保存 (\d+) 份(自定义 API 配置|工具、技能或连接器配置|设备配置|钩子配置)。$/);
    if (dynamic) {
      const plural = dynamic[1] === "1" ? "" : "s";
      const noun = dynamic[2] === "自定义 API 配置" ? `custom API profile${plural}`
        : dynamic[2] === "工具、技能或连接器配置" ? `tool, skill, or connector profile${plural}`
          : dynamic[2] === "设备配置" ? `device profile${plural}` : `hook profile${plural}`;
      return `${dynamic[1]} ${noun} saved.`;
    }
    return chineseToEnglish.get(text) ?? text;
  }
  return englishToChinese.get(text) ?? text;
}
