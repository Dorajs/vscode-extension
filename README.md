# dora-vscode

Dora 的 VSCode 开发插件，可以将 VSCode 作为 Dora 的代码编辑器，支持修改文件后自动 Push 到 Dora！
<p align="center">
  <img src="https://raw.githubusercontent.com/linroid/dora-vscode/master/docs/explorer.png" alt="Addon explorer" />
</p>
<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=linroid.dora">
    <img src="https://img.shields.io/visual-studio-marketplace/d/linroid.dora.svg?style=flat-square" alt="">
  </a>
  <a href="https://github.com/linroid/dora-vscode/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/linroid/dora-vscode.svg?style=flat-square" alt="">
  </a>
</p>

# 如何使用?
 0. 确保你的手机和电脑处于同一 WiFi 网络下
 1. Dora 中长按扩展图标进入编辑模式
 2. 右上角菜单中选择 “连接 VSCode”
 3. 在 VSCode 中点击左侧 Dora 的图标
 4. 点击 “Connect Dora” 并输入第 2 步中的 IP 地址
 5. 选择一个扩展并且选择代码保存的目录
 6. 编辑扩展代码，点击右上角纸飞机图标将代码推送到 Dora 中
 7. Dora 中如出现 “xxx 已更新” 表示代码推送成功

# 配置项
 - `dora.host`: 你的手机 IP，可在 Dora App 代码编辑器中查看
 - `dora.autoPush`: 是否在文件发生变更时自动推送代码（建议设置为 workspace，只在 Dora 扩展工程中生效），默认为 false

# Contribute
 如果你有任何能优化这个插件的想法，欢迎提交 PR 或在 Issues 中留言。

# Contact
 - GitHub: [linroid](https://github.com/linroid)
 - Twitter: [@linroid](https://twitter.com/linroid)
 - Weibo: [@你是个好人啦](https://weibo.com/ekstone)
 - Docs: [dorajs.com](https://dorajs.com/)
 - Email: [linroid@gmail.com](linroid@gmail.com)