// 导入必要的包
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const port = 3000;
app.use(cors());

// 你的Google API密钥
const API_KEY = "AIzaSyAMgo4bFTbJjuezS2TIJ7N9VfruQN4bjXs";

// 代理服务器URL
const proxyUrl = 'http://127.0.0.1:7890';

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// 处理获取视频信息的路由
app.get("/video-info/:videoId", async (req, res) => {
  const videoId = req.params.videoId;
  console.log(`Received request for video ID: ${videoId}`); // 添加日志

  try {
    // 调用YouTube Data API
    const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
      params: {
        id: videoId, // 使用请求参数中的videoId
        key: API_KEY,
        part: 'snippet,contentDetails,statistics,status'
      },
      timeout: 10000, // 增加超时时间为10秒
      httpsAgent: new HttpsProxyAgent(proxyUrl) // 使用代理
    });

    console.log("获取成功:", response.data); // 添加成功日志
    res.json(response.data); // 返回API响应数据

  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      console.error("请求超时，请检查网络连接。"); // 超时错误处理
      res.status(504).json({ error: '请求超时，请检查网络连接。' });
    } else {
      console.error("获取失败:", error.message); // 添加错误日志
      res.status(500).json({ error: 'Failed to fetch video data' });
    }
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});