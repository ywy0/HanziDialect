# 汉字多方言读音查询

输入汉字，查看在普通话、粤语、客家话、日语（音读/训读）、韩语、越南语中的读音。

## 在线使用

直接打开 `index.html`（需要通过 HTTP 服务访问，因为需要 fetch JSON 数据库）。

## 数据说明

- **普通话/粤语/日语/韩语/越南语**: 来自 Unicode Unihan 数据库
- **客家话**: 来自 syndict/hakka RIME 词典（梅县腔）

## 部署到 GitHub Pages

1. 把这个仓库 push 到 GitHub
2. 在仓库 Settings → Pages 里启用 GitHub Pages（选择 main 分支）
3. 等几分钟就可以访问了

## 本地构建数据库

```bash
cd data
python build.py
```

需要网络连接（下载 Unihan 数据库和 RIME 词典）。
