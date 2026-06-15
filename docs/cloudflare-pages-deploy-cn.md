# Cloudflare Pages 发布步骤

这是当前项目最省钱、最适合首发的发布方式。

## 一、准备

你需要：

- 一个 GitHub 仓库
- 一个 Cloudflare 账号

## 二、推代码到 GitHub

把当前项目推到 GitHub 仓库。

## 三、在 Cloudflare Pages 创建项目

进入 Cloudflare Pages：

1. 点击 `Create a project`
2. 选择 `Connect to Git`
3. 连接你的 GitHub 仓库
4. 选择这个项目仓库

## 四、构建设置

填写：

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

如果 Cloudflare 没自动识别，也手动填这三个值。

## 五、环境变量

首发建议先不接真实收款，先用：

- `VITE_COMMERCE_BACKEND=local`
- `VITE_PAYMENT_PROVIDER=manual_waitlist`
- `VITE_PAYMENT_LINK_MODE=demo`

## 六、部署

点击部署，等 Cloudflare 完成构建。

部署完成后，先检查：

- 首页能打开
- 填写流程能走通
- 结果页能打开
- ritual pack 弹窗能打开
- `Trust / Privacy / Terms` 页面能打开

## 七、自定义域名

如果后面你要更正式：

1. 在 Pages 项目里打开 `Custom domains`
2. 绑定你的域名
3. Cloudflare 会引导你完成 DNS

## 八、首发阶段不要做的事

- 不先接复杂订阅
- 不先上应用商店
- 不先承诺 live charging
- 不先做复杂账户系统

## 九、首发目标

你首发只验证三件事：

- 海外用户会不会点进来
- 海外用户会不会买 one-time ritual pack
- 你后面有没有能力稳定开真实收款
