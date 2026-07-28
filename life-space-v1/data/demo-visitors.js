(function () {
  "use strict";

  window.LifeSpaceDemoVisitors = Object.freeze({
    "demo-lugu": Object.freeze({
      id: "demo-lugu",
      heartStarId: "LX-DEMO-000001",
      nickname: "泸沽湖畔的阿夏",
      quote: "愿每一次相遇，都像湖面的晨光。",
      bio: "生活在泸沽湖边，喜欢记录清晨、家人和四季。",
      avatar: "assets/demo/demo-avatar.png",
      theme: "quiet-green",
      textColor: "warm-white",
      cards: Object.freeze([
        {
          id: "demo-life-001",
          channelId: "life",
          title: "湖边的清晨",
          subtitle: "太阳从格姆女神山后慢慢升起",
          content: "天刚亮的时候，我沿着湖边走了一圈。水面很安静，远处传来划船的声音。这样的清晨，总让我觉得新的一天值得期待。",
          images: [{ src: "assets/demo/lugu-lake.webp", positionX: 50, positionY: 38 }],
          imageLayout: "hero",
          imageLayoutCount: 1,
          templateId: "a",
          visualTemplate: "a",
          textPaper: "cream-lines",
          createdAt: "2026-07-18T06:40:00+08:00",
          tags: ["清晨", "泸沽湖"],
          visibility: "public",
          status: "published"
        },
        {
          id: "demo-life-002",
          channelId: "life",
          title: "和家人一起吃晚饭",
          subtitle: "普通的一顿饭，也是值得留下的时刻",
          content: "今天大家难得都在家。火塘边很暖，我们聊了许多小时候的事情。没有特别的安排，却是我很想收藏的一晚。",
          images: [
            { src: "assets/demo/lugu-lake.webp", positionX: 24, positionY: 56 },
            { src: "assets/demo/lugu-lake.webp", positionX: 76, positionY: 44 }
          ],
          imageLayout: "grid",
          imageLayoutCount: 2,
          templateId: "b",
          visualTemplate: "b",
          textPaper: "kraft",
          createdAt: "2026-07-20T19:20:00+08:00",
          tags: ["家人", "晚餐"],
          visibility: "public",
          status: "published"
        },
        {
          id: "demo-life-003",
          channelId: "life",
          title: "雨后的村庄",
          subtitle: "屋檐滴水，空气里都是青草的味道",
          content: "午后的雨停了，云雾还留在山腰。孩子们跑到院子里踩水，我拿起相机记录了这一刻。",
          images: [
            { src: "assets/demo/lugu-lake.webp", positionX: 50, positionY: 50 },
            { src: "assets/demo/lugu-lake.webp", positionX: 18, positionY: 68 },
            { src: "assets/demo/lugu-lake.webp", positionX: 84, positionY: 34 }
          ],
          imageLayout: "hero-2",
          imageLayoutCount: 3,
          templateId: "c",
          visualTemplate: "c",
          textPaper: "leaf",
          createdAt: "2026-07-23T16:10:00+08:00",
          tags: ["雨天", "村庄"],
          visibility: "public",
          status: "published"
        }
      ])
    })
  });
})();
