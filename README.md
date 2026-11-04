# FundLab · 基金考试刷题站

一个不依赖后端的个人备考网站，面向 2026 年 11 月 28 日基金从业资格考试科目一、科目二。选项提交后会立即显示正确答案、解析，并把错题保存在当前浏览器的 `localStorage` 中。

## 题库说明

- 题目数据来自公开 GitHub 仓库 [mrchzh/fund-qualification-examination](https://github.com/mrchzh/fund-qualification-examination) 中的“真题”目录。
- 去重后包含科目一 1,559 道、科目二 1,419 道，历史来源主要覆盖 2015–2021 年。
- 这些资料不是中基协提前发布的 2026 年官方真题；仓库里的章节编号也属于旧题库体系。网站保留题目年份、来源和章节，方便复核。
- 2026 年考试时间、科目名称与新大纲请以[中基协公告](https://www.amac.org.cn/xwfb/tzgg/202611/t20261103_28194.html)和[2026 年度考试大纲通知](https://www.amac.org.cn/xwfb/tzgg/202606/t20260630_27896.html)为准。

## 本地预览

静态页面需要通过 HTTP 服务打开，不能直接双击 `index.html`，否则浏览器会拦截题库 JSON 的读取。

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

## GitHub Pages

仓库内的 `.github/workflows/pages.yml` 会在推送到 `main` 后自动部署。第一次使用时，在 GitHub 仓库的 **Settings → Pages** 中将发布方式设为 **GitHub Actions**。

## 重新导入公开题库

`tools/import_public_bank.py` 会读取上游仓库的 JSON，去掉 HTML 标签、保留来源信息并按题干和选项去重：

```bash
python3 tools/import_public_bank.py \
  --source /path/to/fund-qualification-examination \
  --output data
```

使用题库数据时请同时阅读仓库根目录的 `LICENSE` 和 `CREDITS.md`，不要把题目年份或仓库字段 `isOfficial` 误解成中基协官方授权。
