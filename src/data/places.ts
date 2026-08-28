import { haversineMeters, walkMinutes, type LatLng } from "@/lib/geo";

export type Cover = "indoor" | "canopy";
export type Gear = "sell" | "lend" | "free" | "none" | "unknown";
export type PlaceKind =
  | "convenience"
  | "subway"
  | "mall"
  | "shelter"
  | "station"
  | "canopy";

export type WalkStep = {
  text: string;
  meters: number;
  covered: boolean;
};

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  cover: Cover;
  gear: Gear;
  gearNote: string;
  walkMin: number;
  meters: number;
  openNow: boolean;
  hours: string;
  canSit: boolean;
  entrance: string;
  lat: number;
  lng: number;
  floodOnRoute: boolean;
  simulated: boolean;
  why: string;
  steps: WalkStep[];
};

export type UserLoc = LatLng & {
  label: string;
  source: "live" | "demo";
};

/** 模拟定位：王府井大街步行街中段 */
export const DEMO_USER: UserLoc = {
  lat: 39.9142,
  lng: 116.4105,
  label: "王府井大街（模拟定位）",
  source: "demo",
};

/** @deprecated 用 DEMO_USER */
export const USER = DEMO_USER;

const SHIFT_AFTER_M = 1500;

/** 把模拟点放到用户身边：离王府井超过 1.5 km 时整体平移，并按真实距离重算步行。 */
export function placesAround(user: LatLng): Place[] {
  const far = haversineMeters(user, DEMO_USER) > SHIFT_AFTER_M;
  return PLACES.map((place) => {
    const lat = far ? user.lat + (place.lat - DEMO_USER.lat) : place.lat;
    const lng = far ? user.lng + (place.lng - DEMO_USER.lng) : place.lng;
    const meters = Math.round(haversineMeters(user, { lat, lng }));
    const walkMin = walkMinutes(meters);
    const stepTotal = place.steps.reduce((sum, step) => sum + step.meters, 0) || meters || 1;
    return {
      ...place,
      lat,
      lng,
      meters,
      walkMin,
      steps: place.steps.map((step) => ({
        ...step,
        meters: Math.round((step.meters / stepTotal) * meters),
      })),
    };
  });
}

export function isNearDemo(user: LatLng): boolean {
  return haversineMeters(user, DEMO_USER) <= SHIFT_AFTER_M;
}

export const PLACES: Place[] = [
  {
    id: "bus-canopy",
    name: "公交站亭 · 王府井",
    kind: "canopy",
    cover: "canopy",
    gear: "none",
    gearNote: "仅有顶，不能买伞，不宜久留",
    walkMin: 1,
    meters: 80,
    openNow: true,
    hours: "全天",
    canSit: false,
    entrance: "北侧人行道站亭",
    lat: 39.91455,
    lng: 116.41035,
    floodOnRoute: false,
    simulated: true,
    why: "最近有顶，适合挡一两分钟",
    steps: [
      { text: "沿人行道向北 80 米", meters: 80, covered: false },
      { text: "进入站亭檐下", meters: 0, covered: true },
    ],
  },
  {
    id: "bianlifeng",
    name: "便利蜂（王府井大街店）",
    kind: "convenience",
    cover: "indoor",
    gear: "sell",
    gearNote: "连锁便利店雨季通常有伞，库存未核实",
    walkMin: 2,
    meters: 140,
    openNow: true,
    hours: "07:00–23:00",
    canSit: false,
    entrance: "沿大街北走，路东第一家底商",
    lat: 39.91515,
    lng: 116.41085,
    floodOnRoute: false,
    simulated: true,
    why: "步行 2 分钟，可进室内，可能买到伞",
    steps: [
      { text: "沿王府井大街向北", meters: 120, covered: false },
      { text: "路东底商推门进入", meters: 20, covered: true },
    ],
  },
  {
    id: "subway-a",
    name: "王府井地铁站 A 口",
    kind: "subway",
    cover: "indoor",
    gear: "free",
    gearNote: "降雨时大型车站常发放一次性雨衣，不保证此刻有",
    walkMin: 3,
    meters: 220,
    openNow: true,
    hours: "05:00–23:30",
    canSit: true,
    entrance: "A 口，大街西侧下沉",
    lat: 39.91285,
    lng: 116.4109,
    floodOnRoute: false,
    simulated: true,
    why: "室内站厅可坐，雨衣发放概率高",
    steps: [
      { text: "沿大街向南至 A 口标识", meters: 180, covered: false },
      { text: "下台阶进入站厅", meters: 40, covered: true },
    ],
  },
  {
    id: "apm",
    name: "北京 apm",
    kind: "mall",
    cover: "indoor",
    gear: "lend",
    gearNote: "总服务台偶有租借雨伞，以现场为准",
    walkMin: 4,
    meters: 280,
    openNow: true,
    hours: "10:00–22:00",
    canSit: true,
    entrance: "西南门，王府井大街侧",
    lat: 39.91355,
    lng: 116.41255,
    floodOnRoute: false,
    simulated: true,
    why: "大型室内，可坐、可逛，可能借到伞",
    steps: [
      { text: "向东转入金鱼胡同方向", meters: 160, covered: false },
      { text: "西南门进入商场", meters: 120, covered: true },
    ],
  },
  {
    id: "oriental",
    name: "东方新天地",
    kind: "mall",
    cover: "indoor",
    gear: "unknown",
    gearNote: "地下连廊可避雨，雨具情况未知",
    walkMin: 5,
    meters: 360,
    openNow: true,
    hours: "10:00–22:00",
    canSit: true,
    entrance: "王府井大街南口地下入口",
    lat: 39.9119,
    lng: 116.41015,
    floodOnRoute: true,
    simulated: true,
    why: "室内连廊适合久待，南口附近有积水风险",
    steps: [
      { text: "向南走王府井大街", meters: 280, covered: false },
      { text: "避开下凹路口，从西侧入口下楼", meters: 80, covered: true },
    ],
  },
  {
    id: "dangqun",
    name: "东华门街道党群服务中心",
    kind: "shelter",
    cover: "indoor",
    gear: "lend",
    gearNote: "汛期预警时常备雨伞雨衣，面向路人开放",
    walkMin: 6,
    meters: 450,
    openNow: true,
    hours: "汛期 24 小时（模拟）",
    canSit: true,
    entrance: "正门，向东华门大街一侧",
    lat: 39.91585,
    lng: 116.40795,
    floodOnRoute: false,
    simulated: true,
    why: "可坐、有热水，预警期间欢迎避雨",
    steps: [
      { text: "向西至东华门大街", meters: 300, covered: false },
      { text: "北转进入正门大厅", meters: 150, covered: true },
    ],
  },
  {
    id: "yizhan",
    name: "金檔子众享驿站",
    kind: "station",
    cover: "indoor",
    gear: "free",
    gearNote: "模拟点：驿站常备雨衣雨伞，面向路人",
    walkMin: 7,
    meters: 520,
    openNow: true,
    hours: "08:00–21:00",
    canSit: true,
    entrance: "朝阳门方向辅路西站",
    lat: 39.9164,
    lng: 116.4132,
    floodOnRoute: false,
    simulated: true,
    why: "明确欢迎路人，可能免费领雨具",
    steps: [
      { text: "向东北沿人行道", meters: 400, covered: false },
      { text: "辅路西站推门进入", meters: 120, covered: true },
    ],
  },
];

export const KIND_LABEL: Record<PlaceKind, string> = {
  convenience: "便利店",
  subway: "地铁",
  mall: "商场",
  shelter: "避险点",
  station: "驿站",
  canopy: "有顶",
};

export const GEAR_LABEL: Record<Gear, string> = {
  sell: "可买伞",
  lend: "可借伞",
  free: "可能免费领",
  none: "无雨具",
  unknown: "雨具未知",
};
