# 镜屿 PWA

镜屿是一款“心理成长 × 深度关系”产品原型。当前版本已经把设计稿里的 P0 闭环落成可运行 Web/PWA 与 Android 内测包：真实邮箱码登录、个人信息设定、初见心谱、每日 3 位推荐、关系图谱、树洞、成长内容、真实用户消息和个人心谱。

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

可作为静态 PWA 分发的相对路径构建：

```bash
npm run build:pwa
```

构建产物在 `dist/`。Android 调试包由 GitHub Actions 生成。

## 0 元公网后端方案

内测优先使用 Supabase 免费版作为公网后端。它提供邮箱验证码、数据库、权限规则和多人消息数据，不需要先购买域名或云服务器。

1. 注册 / 登录 Supabase：https://supabase.com
2. 新建 Project，Region 选择离你用户较近的区域。
3. 打开 Supabase 项目的 SQL Editor。
4. 粘贴并执行 `supabase/mirror_isle_schema.sql`。
5. 打开 Project Settings / API，复制：
   - `Project URL`
   - `anon public key`
6. 在本地 `.env` 或 GitHub Repository Variables 中设置：

```bash
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-public-key
```

Supabase 邮箱 OTP 默认模板可能只显示魔法链接。为了让 App 输入“邮箱验证码”，需要在 Authentication / Email Templates 里把模板改成包含 `{{ .Token }}` 的验证码文案。

## FastAPI 备选后端

前端默认连接：

```bash
http://127.0.0.1:8008/api
```

部署到线上时设置：

```bash
VITE_API_BASE_URL=https://你的后端域名/api
```

如果不用 Supabase，而是部署 Python FastAPI 后端，则后端必须配置 SMTP 邮件服务，用户才能收到真实邮箱码。前端不再提供手机验证码或离线假登录。

## 主要模块

- 注册 / 欢迎：极简首屏、邮箱、邮箱码。
- 个人信息：昵称、城市、关系目的、隐私范围、18+ 与协议确认。
- 心谱测试：生活场景式选择题，完成后生成五层心谱摘要和置信度。
- 遇见：每日 3 位有限推荐，展示推荐理由与兼容指数。
- 关系图谱：六维关系解释卡，相似点、互补差异、潜在摩擦和首次相遇问题。
- 树洞：私密 / 好友 / 广场三层可见性，共鸣、抱抱、经历过和想聊聊回应。
- 成长：每周主题、推荐阅读、认知练习、同题讨论和同路人。
- 消息：首次相遇问题引导，真实内测用户之间通过后端会话收发消息。
- 我的：个人心谱、关系报告入口、隐私安全、重新测评和重新登录入口。

## 说明

当前版本已经支持 Supabase 免费后端或 FastAPI 自建后端。真实上线前仍需完成正式实名认证通道、更完整的审核后台和安全风控；内测阶段可以先用 Supabase 邮箱 OTP 和数据库跑通真实多人使用闭环。
