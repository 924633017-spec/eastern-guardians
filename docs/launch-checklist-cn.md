# 上线清单

这是当前项目最适合大陆个人开发者的首发执行顺序。

## 1. 发布形态

- 只发 `Web/PWA`
- 不先上 App Store / Google Play
- 用 `Cloudflare Pages`

## 2. 收费形态

- 先卖 `one-time ritual pack`
- 不把订阅作为首发主收费
- 没确认真实 payout 前，不开 live charging
- 优先用 `PayPal payment link` 做第一版真实收款

## 3. 发布前必须确认

- 首页和结果页没有明显误导性承诺
- 没有“保证发财 / 保证结果 / 医疗法律建议”表达
- `Trust / Privacy / Terms` 页面可访问
- 购买入口优先指向 ritual pack
- 恢复购买入口可见

## 4. Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Root directory: 项目根目录

## 5. 环境变量

首发建议：

```bash
VITE_COMMERCE_BACKEND=local
VITE_PAYMENT_PROVIDER=manual_waitlist
VITE_PAYMENT_LINK_MODE=demo
```

如果准备开第一版真实收款，建议改成：

```bash
VITE_PAYMENT_PROVIDER=paypal
VITE_PAYMENT_LINK_MODE=live
VITE_PAYPAL_CHECKOUT_URL=https://www.paypal.com/ncp/payment/your-payment-link
```

## 6. 真收钱前

只有在以下条件满足后，才打开真实 hosted checkout：

- 你确认自己能稳定收款
- 你确认 checkout link 可用
- 你确认退款和用户支持路径
- 你做过完整购买测试

## 7. 首发目标

首发不是做大而全，而是验证三件事：

- 海外用户愿不愿意点进来
- 海外用户愿不愿意买 ritual pack
- 你能不能稳定拿到钱
