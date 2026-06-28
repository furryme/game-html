# BGM 构建指南

## 最终产物

`bgm-final-b64.txt` — base64 编码的 MP3 数据，内联到 `audio.js` 的 `data:audio/mp3;base64,...` data URI 中。

## 来源

原始 mp4 视频文件的音频轨。

## 参数

| 参数 | 值 |
|---|---|
| 截取段 | 3.69s - 8.69s |
| 时长 | 5.0s |
| 采样率 | 22050 Hz |
| 声道 | 单声道 |
| bit 深度 | 8 bit |
| crossfade | 0.3s（首尾交叉淡入淡出，实现无缝循环） |
| 输出格式 | MP3 |
| 压缩大小 | ~64KB（gzip）/ ~41KB（base64 文本） |

## 构建步骤

```bash
# 1. 从视频提取音频轨
ffmpeg -i source-video.mp4 -vn -acodec pcm_s16le -ar 22050 -ac 1 raw.wav

# 2. 截取 3.69s - 8.69s 段落（5秒）
ffmpeg -i raw.wav -ss 3.69 -to 8.69 -y segment.wav

# 3. 应用 0.3s 交叉淡入淡出（无缝循环）
ffmpeg -i segment.wav -filter_complex "[0:a]afade=t=out:st=4.7:d=0.3[outfade];[0:a]afade=t=in:st=0:d=0.3[infade];[infade][outfade]acrossfade=d=0.3:c1=tri:c2=tri" -y bgm-final.wav

# 4. 转单声道 8bit MP3
ffmpeg -i bgm-final.wav -ac 1 -ar 22050 -b:a 48k -y bgm-final.mp3

# 5. 转 base64
base64 -i bgm-final.mp3 > bgm-final-b64.txt

# 6. 内联到 audio.js
# 将 bgm-final-b64.txt 的内容替换 audio.js 中的 base64 数据
# 格式：data:audio/mp3;base64,{content_of_bgm-final-b64.txt}
```

## 清理中间文件

只保留 `bgm-final-b64.txt`（或直接把 base64 内联进代码后删除源文件）。
原始 wav、迭代版本（v2-v6）、中间 base64 文件均可删除。
