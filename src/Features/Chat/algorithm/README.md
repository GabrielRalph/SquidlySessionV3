# Chat Algorithm Module

算法模块，用于键盘面板的单词建议功能。

## 文件结构

```
algorithm/
├── index.js              # 统一导出入口
├── word-completion.js   # 单词补全算法（当前使用）
├── word-prediction.js   # 下一个单词预测（预留）
├── words.js             # 单词频率数据
└── README.md            # 本文件
```

## 使用方法

### 单词补全 (Word Completion)

补全用户正在输入的单词。例如：输入 "hello wor" → 建议 "world", "work", "word" 等。

```javascript
import { completeWord } from "./algorithm/index.js";

const suggestions = await completeWord("hello wor", 6);
// 返回: ["world", "work", "word", ...]
```

**参数：**
- `partialWord` (string): 部分输入的单词
- `maxSuggestions` (number, 可选): 最大建议数量，默认 6

**返回：**
- `Promise<string[]>`: 建议单词数组，按频率排序

## 数据文件

- **`words.js`**: 包含单词频率数据，用于排序建议

## 注意事项

- 当前只使用 `word-completion.js`（单词补全）
- `word-prediction.js` 为预留功能，暂未实现
- 所有算法通过 `index.js` 统一导出
