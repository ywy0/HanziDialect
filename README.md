# 汉字多方言读音查询

输入汉字，查看在普通话、粤语、客家话、吴语（上海话/苏州话）、闽南语（泉漳）、闽东语（福州话）、潮州话、中古汉语（广韵）、上古汉语、日语（音读/训读）、韩语、越南语中的读音。

在线使用：<https://ywy0.github.io/HanziDialect/>

## 数据来源

### Unicode Unihan 数据库
- **普通话 (cmn)**: `kMandarin` — 44,348 字
- **粤语 (yue)**: `kCantonese` — 29,936 字
- **日语音读 (jpn_on)**: `kJapaneseOn` — 13,177 字
- **日语训读 (jpn_kun)**: `kJapaneseKun`
- **韩语 (kor)**: `kKorean` — 9,050 字
- **越南语 (vie)**: `kVietnamese` — 8,306 字

来源: <https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip>

### RIME 词典

| 语言 | 子类 | 来源 | 字数 |
|------|------|------|------|
| **客家话 (hak)** | 梅县腔 | [syndict/hakka](https://github.com/syndict/hakka) | 16,570 |
| | 客拼 | [worksking/Chinese_dialect_Rime_dict](https://github.com/worksking/Chinese_dialect_Rime_dict) | 17,129 |
| **粤语 (yue)** | 粤拼 | worksking | 20,087 |
| **上海话 (wuu_sh)** | 上海中派 | worksking | 7,610 |
| **苏州话 (wuu_sz)** | 苏州 | worksking | 6,074 |
| **闽南语泉漳 (nan)** | 泉漳 | worksking | 4,909 |
| **福州话 (cdo)** | 福州 | worksking | 9,821 |
| **潮州话 (teo)** | 揭阳/汕头/潮州/潮阳/澄海/饶平 | worksking | 7,485 |
| **中古汉语 (ltc)** | 广韵罗马字/中古全拼/尔切 | worksking | 21,550 |
| **上古汉语 (och)** | 上古全拼 | worksking | 13,134 |

worksking 仓库: <https://github.com/worksking/Chinese_dialect_Rime_dict>

## 技术说明

- 纯前端静态页面，零后端依赖
- 所有数据在构建时生成，运行时无网络请求
- GitHub Pages 友好：`readings.js` 通过 `<script>` 标签加载
- 繁简字形适配：输入简体自动显示繁体读音（带 * 标记），反之亦然



## 本地构建

```bash
cd data
python build.py
```

需要网络连接（下载 Unihan 数据库和 RIME 词典）。

### 额外生成的数据文件

| 文件 | 说明 |
|------|------|
| `hakka_tones.json` | 梅县客家话声调数据（从广韵推导，16,485 字） |
| `st_mapping.json` | 繁简字形映射（Unihan Variants，12,972 对） |
| `yue_ltc_supplement.json` | 粤语缺调字 LTC 补全 |
