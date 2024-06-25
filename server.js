const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { HttpsProxyAgent } = require("https-proxy-agent");
const fs = require("fs");
const xlsx = require("xlsx");
const path = require("path");
require("dotenv").config(); // 加载环境变量

const app = express();
const port = 3000;
app.use(cors());
app.use(express.json()); // 用于解析JSON请求体

// Google API密钥
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_PART = "snippet,statistics";

// Meta API密钥
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_FIELDS =
  "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,video_title,video_view_count";

// 代理服务器URL
const proxyHost = process.env.PROXY_HOST;
const proxyUrl = `http://127.0.0.1:${proxyHost}`;
const httpsAgent = new HttpsProxyAgent(proxyUrl);

// 提取Youtube视频ID的函数
const extractYoutubeVideoId = (url) => {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// 提取Instagram视频ID的函数
const extractInstagramVideoId = (url) => {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/(?:p|tv|reel|reels|stories)\/([a-zA-Z0-9_-]+))/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// 获取Youtube视频数据
const getYoutubeVideoData = async (videoId) => {
  const response = await axios.get(
    "https://www.googleapis.com/youtube/v3/videos",
    {
      params: {
        id: videoId,
        key: YOUTUBE_API_KEY,
        part: YOUTUBE_PART, // 请求的内容部分
      },
      timeout: 10000, // 增加超时时间为10秒
      httpsAgent: httpsAgent, // 使用代理
    }
  );
  const videoData = response.data.items[0];
  let title = "视频消失了~",
    viewCount,
    likeCount,
    commentCount;
  if (videoData) {
    title = videoData.snippet.title;
    viewCount = videoData.statistics.viewCount || 0;
    likeCount = videoData.statistics.likeCount || 0;
    commentCount = videoData.statistics.commentCount || 0;
  }
  return {
    ID: videoId,
    标题: title,
    观看数: viewCount,
    点赞数: likeCount,
    评论数: commentCount,
  };
};

// 获取Instagram视频数据
const getInstagramMediaData = async (mediaId) => {
  const response = await axios.get(
    `https://graph.facebook.com/v13.0/${mediaId}`,
    {
      params: {
        fields: INSTAGRAM_FIELDS,
        access_token: INSTAGRAM_ACCESS_TOKEN,
      },
      timeout: 10000,
      httpsAgent: httpsAgent,
    }
  );
  const videoData = response.data;
  return {
    ID: mediaId,
    标题: videoData.video_title || videoData.caption || "",
    观看数: videoData.video_view_count || 0,
    链接: videoData.permalink,
  };
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// 处理获取视频信息并生成Excel表格的路由
app.post("/video-info", async (req, res) => {
  const links = req.body.links;

  const youtubeVideoIds = links
    .map((link) => extractYoutubeVideoId(link))
    .filter((id) => id !== null);

  const instagramMediaIds = links
    .map((link) => extractInstagramVideoId(link))
    .filter((id) => id !== null);

  if (youtubeVideoIds.length === 0 && instagramMediaIds.length === 0) {
    return res.status(400).json({ error: "没有可用的视频/媒体ID" });
  }

  try {
    // 获取Youtube视频数据
    const youtubeVideoInfoPromises = youtubeVideoIds.map(getYoutubeVideoData);
    const youtubeVideoInfo = await Promise.all(youtubeVideoInfoPromises);

    // 获取Instagram媒体数据
    const instagramMediaInfoPromises = instagramMediaIds.map(
      getInstagramMediaData
    );
    const instagramMediaInfo = await Promise.all(instagramMediaInfoPromises);

    const totalInfo = [...youtubeVideoInfo, ...instagramMediaInfo];

    // 创建工作簿和工作表
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(totalInfo);

    // 将工作表添加到工作簿
    xlsx.utils.book_append_sheet(wb, ws, "Video Info");

    // 保存Excel文件到临时目录
    const filePath = path.join(__dirname, "video_info.xlsx");
    xlsx.writeFile(wb, filePath);

    // 将文件发送给前端
    res.download(filePath, "video_info.xlsx", (err) => {
      if (err) {
        console.error("文件下载失败:", err);
      }
      // 删除临时文件
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error("获取失败:", error.message); // 添加错误日志
    res.status(500).json({ error: "获取视频数据失败" });
  }
});

app.get("/instagram-test", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      {
        client_id: 1191054872255410,
        client_secret: "b71bbae711f0a4161bea67acb73acfac",
        grant_type: "authorization_code",
        redirect_uri: "https://github.com/XuJ1anjian",
        code: "AQAC4SykugLOPxshW39t8kIZNW9ZIiEaitHoz8Nyk9r1puTYHY30eApN03dsTJLWUN84cn9vClTY4s0Mhy6_7OCp_WhB9RKNjTI02-RXd8-3oYHLvatEgks0h7fq4mXcoR8SLLuh4H44Wlxl3DaT460pogNmjFkztIOpxAxehmguNs3ZBCpucQO0KIIxOd9g-hyFvTRM5HLRXHNKeeTzB3tv-nsBmf2WLRRhfgH9LM8-og",
      },
      {
        httpsAgent: httpsAgent
      }
    );
    res.json(response);
  } catch (error) {
    console.error("请求失败:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch data" });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
