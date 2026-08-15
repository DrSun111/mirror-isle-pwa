# 镜屿 v0.16 心林漫游测评逻辑

## 定位

“心林漫游”用于社交匹配中的人格倾向建模，不用于疾病诊断、风险分级或替代专业心理评估。前台不展示病理标签，也不把某一选择解释成“成熟/不成熟”。

## 理论骨架

题目蓝本使用 International Personality Item Pool（IPIP）的 Big-Five Factor Markers：外向性、宜人性、尽责性、情绪稳定性、开放性。IPIP 官方资源明确允许其题目被复制、编辑、翻译和用于商业/非商业用途，也允许研究者根据使用场景调整作答锚点数量。

参考：
- International Personality Item Pool: https://ipip.ori.org/
- IPIP Big-Five Factor Markers: https://ipip.ori.org/newBigFive5broadKey.htm
- IPIP Copyright / Permissions: https://ipip.ori.org/newPermission.htm
- Goldberg, L. R. (1992). The development of markers for the Big-Five factor structure. Psychological Assessment, 4, 26–42.

## v0.16 产品化处理

为减少传统量表的“考试感”，v0.16 将人格项目改写成一个连续的森林故事，并为每个问题提供四个行为强度逐级变化的场景插画。每个维度使用两个方向互补的生活情境，共 10 题。

四个选项内部按 1–4 计分，同一维度的有效作答取平均后线性映射为 0–100。跳过的题目不进入该维度平均；若某维度两题均跳过，使用中性值 50。

由于题干与呈现形式经过场景化改写，v0.16 不宣称与标准 IPIP-50 常模等价。它继承 Big Five 的构念逻辑，作为匹配特征使用；正式扩大样本后应继续做内部一致性、重测信度、因子结构、测量不变性与匹配结果效度验证。

## 隐私

原始作答和 Big Five 得分存储于 `mirror_assessment_profiles`，仅本人可通过 RLS 访问。公开用户资料不保存原始心理作答；匹配兼容层只保留用于关系推荐的派生维度。
