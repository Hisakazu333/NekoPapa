#!/bin/bash
# NekoPapa 桌面端原型预览（Live2D 需要 HTTP，file:// 直开会被浏览器拦截模型加载）
cd "$(dirname "$0")/../.." || exit 1
echo "原型地址: http://127.0.0.1:8123/prototype/desktop-app/"
python3 -m http.server 8123
