# Daily

<p align="center">
  <img src="./build/icon.svg" alt="Daily app icon" width="128" height="128" />
</p>

Daily 是一款为日常生活工作准备的本地优先小应用。

它从一个简单的待办清单开始，但慢慢长出了更多和“每天”有关的东西：今天要做什么、哪件事已经完成、某一天发生了什么、那天的心情有没有被记下来。

它不追求复杂，也不想变成另一个让人有压力的效率工具。Daily 更像一个安静的小角落，帮你把每天轻轻放好。

## 功能

- 按日期管理待办事项
- 普通未完成任务会在跨日后自动顺延，完成后才可删除
- 支持日历视图，查看不同日期的安排
- 支持日记记录，把每天的想法留下来
- 支持重复任务 / 批量安排
- 支持批量任务提醒时间
- 支持开机自启动和后台提醒
- 支持 GitHub 私有仓库同步
- 支持 GitHub Pages / PWA 的简易手机端使用方式
- 本地优先保存，断网或未开 VPN 时也可以继续记录

## 数据存储

Daily 是 local-first 的应用。macOS 桌面端数据会保存在本机：

```text
~/Library/Application Support/daily/tasks.json
~/Library/Application Support/daily/diaries.json
```

桌面端也可以在“设置 → 数据备份”中导出单个 JSON 备份文件，或通过“导入备份”恢复任务、重复规则、功能设置和日记。备份文件不包含 GitHub Token。

浏览器 / 手机 PWA 端会先保存在当前设备的浏览器本地存储中。开启 GitHub 同步后，应用会把任务和日记同步到你指定的私有仓库路径，例如：

```text
daily-data/tasks.json
daily-data/diaries.json
```

重复任务会以规则形式保存。已经过期的批量生成任务不会长期堆在 `tasks.json` 里，避免文件越来越大。

## GitHub 同步

GitHub 同步适合个人使用，需要你准备一个私有数据仓库和一个 fine-grained token。

推荐设置：

```text
Owner: 你的 GitHub 用户名
Repo: daily-data
Branch: main
Path: daily-data
Token: fine-grained token
```

Token 权限建议只给数据仓库：

```text
Repository access: Only selected repositories
Repository permissions:
  Contents: Read and write
```

同步策略：

- 没有网络或没开 VPN 时，内容会先写入本机
- 打开 VPN 后可以在设置页点击“立即同步”
- 手机端和桌面端会按每条任务、每篇日记的更新时间合并
- 不同日期的日记会互相保留
- 同一天日记如果两端都修改，最后修改的一端生效
- 删除也会记录删除时间，避免旧数据在另一端复活

设置页里还有“自动同步”开关。手机端建议关闭自动同步，等需要时打开 VPN 后手动同步；桌面端如果网络稳定，可以开启自动同步。

## 手机端简易方案

当前手机端采用 GitHub Pages + PWA 的轻量方案：

1. 发布项目到 GitHub Pages
2. 用 iPhone Safari 打开：

```text
https://erin-mm.github.io/daily/
```

3. 分享按钮 -> 添加到主屏幕
4. 以后从主屏幕打开 Daily

注意：GitHub Pages 和 GitHub API 在部分网络环境下可能需要 VPN。PWA 已缓存后可以离线打开和记录，但同步到 GitHub 仍然需要能访问 `api.github.com`。

## 开发

```bash
source /Users/erin/.nvm/nvm.sh
nvm use 23
npm run dev
```

## 构建

普通构建：

```bash
npm run build
```

macOS 安装包：

```bash
npm run dist:mac
```

GitHub Pages 构建：

```bash
GITHUB_PAGES=true npm run build
```

## 发布

当前版本：

```text
0.1.4
```

`v0.1.4` 主要更新：

- 修复 GitHub 同步 SHA 冲突，串行写入并自动重试
- 新增本地 JSON 备份导入与导出
- 普通未完成任务跨日后自动顺延到当天
- 任务完成后才显示删除操作
