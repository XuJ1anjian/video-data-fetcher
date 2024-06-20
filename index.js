const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config(); // 加载环境变量

const app = express();
const port = 3000;
app.use(cors());
app.use(express.json()); // 用于解析JSON请求体

// Google API密钥
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_PART = 'snippet,statistics'

// 代理服务器URL
const proxyHost = process.env.PROXY_HOST;
const proxyUrl = `http://127.0.0.1:${proxyHost}`;
const httpsAgent = new HttpsProxyAgent(proxyUrl);

// 提取Youtube视频ID的函数
const extractYoutubeVideoId = (url) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// 处理获取视频信息并生成Excel表格的路由
app.post("/video-info", async (req, res) => {
  const links = req.body.links;

  const videoIds = links.map(link => extractYoutubeVideoId(link)).filter(id => id !== null);
  if (videoIds.length === 0) {
    return res.status(400).json({ error: 'No valid video IDs found' });
  }

  try {
    const videoInfoPromises = videoIds.map(async (videoId) => {
      const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: {
          id: videoId,
          key: YOUTUBE_API_KEY, // Google Api Key
          part: YOUTUBE_PART // 请求的内容部分
        },
        timeout: 10000, // 增加超时时间为10秒
        httpsAgent: httpsAgent // 使用代理
      });
      const videoData = response.data.items[0];
      return {
        ID: videoId,
        标题: videoData.snippet.title,
        观看数: videoData.statistics.viewCount,
        点赞数: videoData.statistics.likeCount,
        评论数: videoData.statistics.commentCount
      };
    });

    const videoInfo = await Promise.all(videoInfoPromises);

    // 创建工作簿和工作表
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(videoInfo);

    // 将工作表添加到工作簿
    xlsx.utils.book_append_sheet(wb, ws, 'Video Info');

    // 保存Excel文件到临时目录
    const filePath = path.join(__dirname, 'video_info.xlsx');
    xlsx.writeFile(wb, filePath);

    // 将文件发送给前端
    res.download(filePath, 'video_info.xlsx', (err) => {
      if (err) {
        console.error("文件下载失败:", err);
      }
      // 删除临时文件
      fs.unlinkSync(filePath);
    });

  } catch (error) {
    console.error("获取失败:", error.message); // 添加错误日志
    res.status(500).json({ error: 'Failed to fetch video data' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
