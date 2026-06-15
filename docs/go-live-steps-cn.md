# 真实上线操作步骤

这份文档只做一件事：

告诉你现在应该怎么一步一步把项目真正上线。

分成两部分：

1. 前端网页上线
2. 后端 webhook 上线

---

## 一、你现在的正确上线结构

不要把所有东西都塞进一个地方。

最适合你现在的结构是：

- 前端网页：`Cloudflare Pages`
- 后端 webhook：`Render` 或 `Railway`
- 收款：`Gumroad`

原因：

- 前端静态站最适合放 Pages
- Gumroad webhook 需要一个真正能收 `POST` 请求的后端
- Pages 本身不适合你现在这套最小 Node webhook 服务直接跑

---

## 二、第一步：先把前端网页上线到 Cloudflare Pages

### 1. 进入 Cloudflare Pages

打开：

- `Cloudflare Dashboard`
- `Workers & Pages`
- `Create application`
- `Pages`
- `Connect to Git`

### 2. 选择你的 GitHub 仓库

把当前项目推到 GitHub 后，选择这个仓库。

### 3. 构建设置填写

填下面这几个：

- `Framework preset`: `Vite`
- `Build command`: `npm run build`
- `Build output directory`: `dist`

### 4. 前端环境变量

在 Pages 项目里先填这些：

```text
VITE_PAYMENT_PROVIDER=gumroad
VITE_PAYMENT_LINK_MODE=live
VITE_GUMROAD_UNLOCK_ALL_URL=https://3031515762782.gumroad.com/l/exlzpj
VITE_GUMROAD_UNLOCK_MAZU_URL=https://3031515762782.gumroad.com/l/dxvtoa
VITE_GUMROAD_UNLOCK_WENCHANG_URL=https://3031515762782.gumroad.com/l/utmjtd
VITE_GUMROAD_UNLOCK_YUELAO_URL=https://3031515762782.gumroad.com/l/rikiky
VITE_GUMROAD_UNLOCK_CAISHEN_URL=https://3031515762782.gumroad.com/l/rvlpyw
VITE_GUMROAD_UNLOCK_GUANYIN_URL=https://3031515762782.gumroad.com/l/nudiz
```

现在先不要填：

```text
VITE_COMMERCE_BACKEND=remote
VITE_COMMERCE_API_BASE=...
```

因为后端还没部署。

### 5. 点击部署

部署成功后，你会得到一个：

```text
https://你的项目名.pages.dev
```

---

## 三、第二步：部署 webhook 后端

这里你可以选：

1. `Render`
2. `Railway`

我建议你先用：

`Render`

原因：

- 界面更直观
- 部署 Node 小服务简单
- 适合你现在这个 webhook 用途

---

## 四、第三步：用 Render 部署后端

### 1. 进入 Render

打开：

- `render.com`
- 登录
- `New +`
- `Web Service`

### 2. 连接 GitHub 仓库

选择和前端同一个仓库。

### 3. 创建服务时填写

- `Name`: 你随便起，比如 `eastern-guardians-commerce`
- `Runtime`: `Node`
- `Build Command`: 留空，或者 `npm install`
- `Start Command`: `npm start`

因为我已经帮你在 [package.json](/Users/apple/Documents/New%20project555/package.json) 里加了：

```text
start = node scripts/commerce-server.mjs
```

### 4. 后端环境变量

在 Render 里填：

```text
PAYMENT_PROVIDER=gumroad
COMMERCE_PORT=10000
GUMROAD_WEBHOOK_SECRET=你自己设置的一串随机字符串
```

说明：

- `COMMERCE_PORT` 实际上 Render 会提供自己的端口环境
- 这项不是核心
- 最重要的是 `GUMROAD_WEBHOOK_SECRET`

### 5. 部署成功后

你会拿到一个后端地址，比如：

```text
https://eastern-guardians-commerce.onrender.com
```

---

## 五、第四步：把 webhook 地址填进 Gumroad

在 Gumroad 后台找到 webhook 设置。

你要填的地址是：

```text
https://你的后端域名/gumroad/webhook
```

例如：

```text
https://eastern-guardians-commerce.onrender.com/gumroad/webhook
```

然后把你刚刚在 Render 填的：

`GUMROAD_WEBHOOK_SECRET`

同样填到 Gumroad 的 secret 位置。

---

## 六、第五步：把前端切到 remote 模式

等后端部署好了，再回到 Cloudflare Pages，把前端环境变量再加两项：

```text
VITE_COMMERCE_BACKEND=remote
VITE_COMMERCE_API_BASE=https://你的后端域名
```

例如：

```text
VITE_COMMERCE_BACKEND=remote
VITE_COMMERCE_API_BASE=https://eastern-guardians-commerce.onrender.com
```

然后重新部署前端。

---

## 七、第六步：做一次真实支付测试

一定要自己做一次真实小额测试。

测试顺序：

1. 打开你的正式网页
2. 选择一个单尊神像
3. 点击 `Pay on Gumroad`
4. 用测试邮箱支付
5. 回到网页
6. 看页面是否自动确认解锁
7. 如果 webhook 延迟，再点击 `Restore access`
8. 看是否真正解锁

如果不成功，就去看：

- Render 日志
- Gumroad webhook 有没有打到后端

---

## 八、你现在就先做哪一步

你现在最先做的是这两个：

1. `把前端项目推到 GitHub`
2. `去 Cloudflare Pages 部署前端`

等你拿到：

- Pages 地址

我再继续带你做：

- Render 后端部署
- Gumroad webhook 接入
- 前端切 remote

---

## 九、最简记忆版

你只要记住这条顺序：

1. `GitHub`
2. `Cloudflare Pages`
3. `Render`
4. `Gumroad webhook`
5. `前端切 remote`
6. `真支付测试`
