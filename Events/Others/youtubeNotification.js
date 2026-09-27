const { Events, EmbedBuilder, MessageFlags } = require('discord.js');
const YouTubeNotification = require('../../Schemas/youtubeSchema');
const fetch = require('node-fetch');

const videoStatusMap = new Map();

async function getLatestVideos(channelId, apiKey) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video&key=${apiKey}`
  );
  const data = await response.json();
  return data.items || [];
}

async function getChannelIdFromUrl(url, apiKey) {
  let channelId = '';
  if (url.includes('/channel/')) {
    channelId = url.split('/channel/')[1].split(/[\?\/]/)[0];
  } else if (url.includes('/@')) {
    const handle = url.split('/@')[1].split(/[\?\/]/)[0];
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`
    );
    const data = await response.json();
    channelId = data.items?.[0]?.id;
  }
  return channelId;
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    const apiKey = 'AIzaSyD5qwsrTR0HsexRjlNzibLdDZilGS2F0H8'; // Replace with your YouTube Data API key

    setInterval(async () => {
      const configs = await YouTubeNotification.find();

      for (const config of configs) {
        const channelId = await getChannelIdFromUrl(config.YouTubeChannel, apiKey);
        if (!channelId) continue;

        const videos = await getLatestVideos(channelId, apiKey);
        const lastNotified = config.LastNotified ? new Date(config.LastNotified) : null;
        const notifyThreshold = 5 * 60 * 1000; // 5 minutes

        for (const video of videos) {
          const videoId = video.id.videoId;
          const publishTime = new Date(video.snippet.publishedAt);
          const isLive = video.snippet.liveBroadcastContent === 'live';
          const lastStatus = videoStatusMap.get(videoId) || false;
          const now = new Date();

          if (
            publishTime > (lastNotified || new Date(0)) &&
            !lastStatus &&
            (!lastNotified || now - lastNotified > notifyThreshold)
          ) {
            const channel = await client.channels.fetch(config.Channel);
            if (channel) {
              const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(video.snippet.title)
                .setURL(`https://www.youtube.com/watch?v=${videoId}`)
                .setDescription(
                  `${config.Message}\n${isLive ? '🔴 LIVE NOW!' : '🎥 New Video!'}\n>>> **${video.snippet.title}**`
                )
                .setThumbnail(video.snippet.thumbnails.medium.url)
                .setTimestamp();

              await channel.send({ embeds: [embed] });

              config.LastNotified = now;
              await config.save();
              videoStatusMap.set(videoId, true);
            }
          }
        }
      }
    }, 60000); // Check every minute
  },
};