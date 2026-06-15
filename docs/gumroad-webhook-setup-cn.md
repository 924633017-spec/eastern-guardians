# Gumroad Webhook 配置说明

这份文档只回答一件事：

如何把 Gumroad 的真实付款通知发到你的项目后端，让网站能够真正记录“谁买了哪一个神像解锁”。

---

## 1. 你现在已经有了什么

项目里已经加好了一个最小 Gumroad webhook 接口：

`POST /gumroad/webhook`

对应本地开发服务文件：

[scripts/commerce-server.mjs](/Users/apple/Documents/New%20project555/scripts/commerce-server.mjs)

---

## 2. 这个 webhook 做什么

当 Gumroad 有付款成功通知时，它会：

- 读取购买邮箱
- 读取商品 permalink
- 判断买的是哪一个神像商品
- 把这笔购买记录写进本地 commerce state

当前支持的商品 permalink：

- `exlzpj` -> `Unlock All Guardians`
- `dxvtoa` -> `Unlock Mazu`
- `utmjtd` -> `Unlock Wenchang`
- `rikiky` -> `Unlock Yuelao`
- `rvlpyw` -> `Unlock Caishen`
- `nudiz` -> `Unlock Guanyin`

---

## 3. 你后面部署后，要给 Gumroad 填什么地址

如果你把后端部署到：

`https://your-domain.com`

那么 Gumroad webhook 地址填：

```text
https://your-domain.com/gumroad/webhook
```

如果后端和前端分开部署，就填后端服务域名。

---

## 4. 建议设置一个 webhook secret

后端已经支持：

`GUMROAD_WEBHOOK_SECRET`

你应该：

1. 自己生成一个随机字符串
2. 放到后端环境变量里
3. 在 Gumroad webhook 配置里填同一个 secret

这样可以避免别人伪造付款通知。

---

## 5. 后端环境变量建议

部署后建议至少配置：

```text
PAYMENT_PROVIDER=gumroad
COMMERCE_PORT=8787
GUMROAD_WEBHOOK_SECRET=your-random-secret
```

---

## 6. 当前限制

这一步只是把“真实付款记录进入你自己的系统”打通。

它还不等于：

- 前端自动实时轮询
- 用户付款后秒级自动刷新
- 完整订单后台

但它已经是“真实上线收钱”必须有的最小闭环。

---

## 7. 你下一步还要做什么

如果你要真正上线：

1. 把 commerce server 部署成可公网访问
2. 把 Gumroad webhook 指向它
3. 把前端切到：

```text
VITE_COMMERCE_BACKEND=remote
VITE_COMMERCE_API_BASE=https://your-backend-domain
```

4. 做一次真实小额支付测试
5. 确认 webhook 到达后，站内恢复能找到购买记录

---

## 8. 现实判断

到这一步以后，你的产品才开始接近：

`能真实收钱 + 能真实履约`

在这之前，前端就算再漂亮，也还只是“支付入口接好了”。
