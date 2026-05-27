# Daily

<p align="center">
  <img src="./build/icon.svg" alt="Daily app icon" width="128" height="128" />
</p>

Daily 是一款为日常生活工作准备的 macOS 本地桌面小应用。

它从一个简单的待办清单开始，但慢慢长出了更多和“每天”有关的东西：今天要做什么、哪件事已经完成、某一天发生了什么、那天的心情有没有被记下来。

它不追求复杂，也不想变成另一个让人有压力的效率工具。Daily 更像一个安静的小角落，帮你把每天轻轻放好。

## 功能

- 按日期管理待办事项
- 支持日历视图，查看不同日期的安排
- 支持日记记录，把每天的想法留下来
- 支持重复任务 / 批量安排
- 支持开机自启动
- 数据保存在本地，不依赖云端服务

## 数据存储

Daily 是 local-first 的应用。你的数据会保存在本机：

```text
~/Library/Application Support/daily/tasks.json
~/Library/Application Support/daily/diaries.json