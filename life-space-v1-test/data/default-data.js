window.LifeSpaceDefaults = Object.freeze({
  profile: {
    nickname: "我的生命空间",
    quote: "今天，也值得被记住",
    bio: "记录生活，也记录成为自己的过程。",
    avatar: "",
    theme: "quiet-green",
    textColor: "auto"
  },
  homeTheme: {
    backgroundType: "preset",
    backgroundValue: "default",
    title: "欢迎来到我的生命空间",
    description: "记录生活，也记录成为自己的过程。",
    textColor: "warm-white"
  },
  channels: [
    { id: "emotion", name: "我的情感", shortName: "情感", icon: "heart", description: "收藏心里的感受与关系。", prompt: "此刻，心里有什么想留下？", emptyTitle: "还没有留下情感记录", addLabel: "添加第一条情感", enabled: true },
    { id: "life", name: "我的生活", shortName: "生活", icon: "sun", description: "记录平凡却值得留下的时刻。", prompt: "今天，有什么值得留下？", emptyTitle: "还没有留下生活记录", addLabel: "添加第一条生活", enabled: true },
    { id: "growth", name: "我的成长", shortName: "成长", icon: "sprout", description: "看见每一次改变与抵达。", prompt: "最近，有什么新的成长？", emptyTitle: "还没有留下成长记录", addLabel: "添加第一段成长", enabled: true },
    { id: "travel", name: "我的旅行", shortName: "旅行", icon: "compass", description: "留住走过的地方与风景。", prompt: "想记录哪一段旅程？", emptyTitle: "还没有留下旅行记录", addLabel: "添加第一段旅行", enabled: true },
    { id: "creation", name: "我的创作", shortName: "创作", icon: "spark", description: "安放灵感、作品与表达。", prompt: "把今天的灵感保存下来吧。", emptyTitle: "还没有留下创作", addLabel: "添加第一份创作", enabled: true },
    { id: "collection", name: "我的收藏", shortName: "收藏", icon: "gem", description: "珍藏打动自己的事物。", prompt: "最近，什么打动了你？", emptyTitle: "还没有留下收藏", addLabel: "添加第一份收藏", enabled: true },
    { id: "life-tree", name: "我的生命树", shortName: "生命树", icon: "tree", description: "让生命经历慢慢长成一棵树。", prompt: "哪段经历正在成为生命的枝叶？", emptyTitle: "生命树还没有新的枝叶", addLabel: "添加第一段经历", enabled: true }
  ],
  cardShape: {
    id: "",
    userId: "local-user",
    moduleType: "life",
    channelId: "life",
    title: "",
    subtitle: "",
    content: "",
    images: [],
    imageLayout: "auto",
    visualTemplate: "",
    textPaper: "plain",
    createdAt: "",
    updatedAt: "",
    location: "",
    music: null,
    video: null,
    voice: null,
    tags: [],
    status: "published"
  }
});
