# MiniMax CLI

MiniMax Coding Plan API 命令行工具，支持联网搜索和图像理解。

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd minimax-cli

# 链接为全局命令
npm run init
```

或者直接使用:

```bash
node cli.js <command>
```

## 配置

设置环境变量 `MINIMAX_TOKEN`:

```bash
export MINIMAX_TOKEN="your_minimax_token_here"
```

## 命令

### search - 联网搜索

```bash
minimax search "搜索关键词"
```

示例:
```bash
minimax search "Python 3.12 release highlights"
minimax search "2024年AI发展趋势"
```

### understand-image - 图像理解

```bash
minimax understand-image --prompt "提示词" --image <图片路径或URL>
```

参数:
- `-p, --prompt <text>` - 图像理解提示词
- `-i, --image <input>` - 图片路径、http(s) URL 或 data URL

示例:
```bash
# 本地文件
minimax understand-image --prompt "请描述这张图" --image ./demo.png

# 网络图片
minimax understand-image --prompt "分析这张图片" --image https://example.com/image.png

# 使用短选项
minimax understand-image -p "图片里有什么" -i ./screenshot.jpg
```

### help - 帮助

```bash
minimax help
```

---

## MiniMax 官方 CLI (mmx)

推荐使用 MiniMax 官方 CLI 工具 `mmx`，功能更全面：

### 安装

```bash
npm install -g mmx-cli
```

### 登录认证

```bash
mmx auth login --api-key sk-你的MiniMax密钥
mmx auth status  # 验证登录状态
```

### 查看配额

```bash
mmx quota
```

### 搜索

```bash
# 联网搜索
mmx search "Python 3.14 新特性"

# 搜索最新资讯
mmx search "MiniMax AI latest news"
```

### 文本对话

```bash
mmx text chat --message "什么是 MiniMax"
```

### 图像理解

```bash
# 分析网络图片
mmx vision https://example.com/image.jpg

# 分析本地图片
mmx vision ./photo.jpg
```

### 图像生成

```bash
# 根据文本生成图片
mmx image "一只穿宇航服的猫咪在太空中"

# 保存到指定文件
mmx image "未来城市风景" --out ~/Desktop/generated.png
```

### 语音合成

```bash
# 文本转语音
mmx speech synthesize --text "你好，欢迎使用 MiniMax" --out hello.mp3

# 使用特定语音
mmx speech synthesize --text "你好" --voice zh-CN-XiaoxiaoNeural --out hello.mp3

# 列出可用语音
mmx speech voices --filter zh-CN
```

### 视频生成

```bash
# 文生视频
mmx video generate --prompt "海浪在日落时分拍打沙滩"

# 生成 6 秒视频
mmx video generate --prompt "蓝天白云下的草原" --duration 6
```

### 音乐生成

```bash
# 生成音乐
mmx music generate --prompt "欢快的流行音乐" --lyrics "[verse] La da dee"

# 纯音乐
mmx music generate --prompt "放松的爵士乐"
```

### 配置

```bash
# 查看配置
mmx config show

# 设置区域（cn 或 global）
mmx config set --key region --value cn
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `MINIMAX_TOKEN` | 是 | MiniMax API Token |

## API 端点

- 搜索: `POST /v1/coding_plan/search`
- 图像理解: `POST /v1/coding_plan/vlm`

## License

MIT
