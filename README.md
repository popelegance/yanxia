# 檐下

北京路人避雨导引第一版原型。下雨时打开，三步内走到最近的干处或雨具点。

无登录、无支付。地图、天气、积水、点位均为**模拟数据**（王府井大街）。

- 仓库：https://github.com/popelegance/yanxia
- 源码压缩包：https://github.com/popelegance/yanxia/archive/refs/heads/main.zip

## 怎么用

1. 看附近：默认「躲一下」，可切「买雨具走」
2. 点卡片或地图圆点看入口、室内、雨具、积水
3. 点「去这里躲雨 / 去拿雨具」按分段路走

## 源码位置

- `src/data/places.ts` 模拟点位
- `src/data/weather.ts` 模拟天气与积水
- `src/lib/rank.ts` 意图排序
- `src/components/yanxia-app.tsx` 主界面
- `src/components/rain-map.tsx` Leaflet 暗色地图
