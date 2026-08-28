import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CloudRain,
  DoorOpen,
  Footprints,
  Info,
  MapPin,
  Navigation,
  Shield,
  Umbrella,
  Waves,
} from "lucide-react";
import { RainMap } from "@/components/rain-map";
import { Button } from "@/components/ui/button";
import { GEAR_LABEL, KIND_LABEL, PLACES, USER, type Place } from "@/data/places";
import { WEATHER } from "@/data/weather";
import type { Intent, Screen } from "@/lib/intent";
import { adviceLine, rankPlaces } from "@/lib/rank";
import { cn } from "@/lib/utils";

const REPORT_KEY = "yanxia-reports-v1";

type Report = { hasGear?: boolean; closed?: boolean };

function loadReports(): Record<string, Report> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(REPORT_KEY) || "{}") as Record<
      string,
      Report
    >;
  } catch {
    return {};
  }
}

export function YanxiaApp() {
  const [intent, setIntent] = useState<Intent>("shelter");
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [reports, setReports] = useState<Record<string, Report>>(loadReports);
  const [arrived, setArrived] = useState(false);

  const ranked = useMemo(() => rankPlaces(PLACES, intent), [intent]);
  const selected = PLACES.find((p) => p.id === selectedId) ?? null;
  const top = ranked[0];

  function openPlace(id: string) {
    setSelectedId(id);
    setScreen("detail");
    setArrived(false);
  }

  function saveReport(id: string, patch: Report) {
    const next = { ...reports, [id]: { ...reports[id], ...patch } };
    setReports(next);
    localStorage.setItem(REPORT_KEY, JSON.stringify(next));
  }

  return (
    <div className="flex min-h-dvh w-full justify-center bg-bg text-fg">
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg">
      <div className="relative min-h-dvh">
        <div className="absolute inset-0 z-0">
          <RainMap
            selectedId={selectedId}
            onSelect={openPlace}
            routeTo={selected}
          />
        </div>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
          <div className="pointer-events-auto flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-2xl leading-tight tracking-tight">檐下</p>
              <p className="text-xs text-muted">下雨，往最近的干处走</p>
            </div>
            <button
              type="button"
              onClick={() => setAbout(true)}
              className="flex size-11 items-center justify-center rounded-md border border-border bg-surface/90 text-fg"
              aria-label="产品说明"
            >
              <Info className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="pointer-events-auto mt-3 rounded-lg border border-border bg-surface/92 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <CloudRain className="size-4 text-rain" strokeWidth={1.75} />
              <span className="font-medium">{WEATHER.intensity}</span>
              <span className="text-muted">· {WEATHER.warning}</span>
              <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-2xs uppercase tracking-wide text-muted">
                模拟
              </span>
            </div>
            <p className="mt-1 text-xs leading-snug text-muted">{WEATHER.summary}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-warn">
              <Waves className="size-3.5" strokeWidth={1.75} />
              积水 {WEATHER.flood.name} {WEATHER.flood.depthCm} cm · {WEATHER.flood.note}
            </p>
          </div>
        </header>

        {screen === "walk" && selected ? (
          <WalkSheet
            place={selected}
            arrived={arrived}
            onBack={() => setScreen("detail")}
            onArrived={() => setArrived(true)}
            onReset={() => {
              setScreen("list");
              setSelectedId(null);
              setArrived(false);
            }}
          />
        ) : screen === "detail" && selected ? (
          <DetailSheet
            place={selected}
            intent={intent}
            report={reports[selected.id]}
            onBack={() => {
              setScreen("list");
            }}
            onGo={() => setScreen("walk")}
            onReport={saveReport}
          />
        ) : (
          <ListSheet
            intent={intent}
            onIntent={setIntent}
            ranked={ranked}
            advice={adviceLine(top, intent)}
            selectedId={selectedId}
            onOpen={openPlace}
          />
        )}
      </div>

      {about ? <AboutOverlay onClose={() => setAbout(false)} /> : null}
    </div>
    </div>
  );
}

function ListSheet({
  intent,
  onIntent,
  ranked,
  advice,
  selectedId,
  onOpen,
}: {
  intent: Intent;
  onIntent: (i: Intent) => void;
  ranked: Place[];
  advice: string;
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="absolute inset-x-0 bottom-0 z-20 rounded-t-xl border border-border bg-paper text-paper-ink shadow-lg">
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-paper-ink/15" />
      <div className="px-4 pb-5 pt-3">
        <p className="text-2xs font-medium tracking-wide text-paper-ink/50">
          三步 · 看附近 → 选地点 → 出发
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <IntentChip
            active={intent === "shelter"}
            icon={<Shield className="size-4" strokeWidth={1.75} />}
            label="躲一下"
            hint="进室内"
            onClick={() => onIntent("shelter")}
          />
          <IntentChip
            active={intent === "gear"}
            icon={<Umbrella className="size-4" strokeWidth={1.75} />}
            label="买雨具走"
            hint="买 / 借 / 领"
            onClick={() => onIntent("gear")}
          />
        </div>
        <p className="mt-3 text-sm leading-snug text-pretty text-paper-ink/80">{advice}</p>
        <p className="mt-1 text-2xs text-paper-ink/45">{USER.label} · 点位模拟 · 底图 Esri</p>

        <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
          {ranked.map((place, i) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onOpen(place.id)}
                className={cn(
                  "flex w-full items-stretch gap-3 rounded-lg border px-3 py-3 text-left transition-colors duration-150",
                  selectedId === place.id
                    ? "border-paper-ink/40 bg-paper-ink/5"
                    : "border-paper-ink/10 bg-paper-lift",
                )}
              >
                <div className="flex w-10 shrink-0 flex-col items-center justify-center">
                  <span className="font-display text-xl leading-none tabular-nums">
                    {place.walkMin}
                  </span>
                  <span className="text-micro text-paper-ink/50">分钟</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {i === 0 ? (
                      <span className="rounded-full bg-paper-ink px-1.5 py-0.5 text-micro font-medium text-paper">
                        推荐
                      </span>
                    ) : null}
                    <p className="truncate font-medium">{place.name}</p>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-paper-ink/55">
                    <span>{KIND_LABEL[place.kind]}</span>
                    <span>{place.cover === "indoor" ? "室内可进" : "仅有顶"}</span>
                    <span>{GEAR_LABEL[place.gear]}</span>
                    {place.floodOnRoute ? <span className="text-danger">途经积水</span> : null}
                  </p>
                </div>
                <ChevronRight className="mt-2 size-4 shrink-0 text-paper-ink/35" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function IntentChip({
  active,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center gap-2.5 rounded-lg border px-3 text-left",
        active
          ? "border-paper-ink bg-paper-ink text-paper"
          : "border-paper-ink/15 bg-paper-lift text-paper-ink",
      )}
    >
      {icon}
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className={cn("block text-xs", active ? "text-paper/70" : "text-paper-ink/50")}>
          {hint}
        </span>
      </span>
    </button>
  );
}

function DetailSheet({
  place,
  intent,
  report,
  onBack,
  onGo,
  onReport,
}: {
  place: Place;
  intent: Intent;
  report?: Report;
  onBack: () => void;
  onGo: () => void;
  onReport: (id: string, patch: Report) => void;
}) {
  return (
    <section className="absolute inset-x-0 bottom-0 z-20 rounded-t-xl border border-border bg-paper text-paper-ink">
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-paper-ink/15" />
      <div className="px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex h-11 items-center gap-1 text-sm text-paper-ink/70"
        >
          <ArrowLeft className="size-4" /> 附近列表
        </button>
        <h1 className="font-display text-2xl leading-tight text-balance">{place.name}</h1>
        <p className="mt-1 text-sm text-paper-ink/60">{place.why}</p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Fact
            icon={<Footprints className="size-3.5" />}
            label="步行"
            value={`${place.walkMin} 分钟 · ${place.meters} 米`}
          />
          <Fact
            icon={<Clock className="size-3.5" />}
            label="开放"
            value={place.openNow ? `营业中 ${place.hours}` : place.hours}
          />
          <Fact
            icon={<DoorOpen className="size-3.5" />}
            label="入口"
            value={place.entrance}
          />
          <Fact
            icon={<Umbrella className="size-3.5" />}
            label="雨具"
            value={GEAR_LABEL[place.gear]}
          />
        </dl>
        <p className="mt-2 text-xs leading-snug text-paper-ink/50">{place.gearNote}</p>
        {place.floodOnRoute ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-danger">
            <Waves className="mt-0.5 size-3.5 shrink-0" />
            路线靠近积水点，导引会提示绕行。
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="quiet"
            className="border-paper-ink/15 bg-paper-lift text-paper-ink"
            onClick={() => onReport(place.id, { hasGear: true })}
          >
            {report?.hasGear ? "已记：有伞" : "上报有伞"}
          </Button>
          <Button
            type="button"
            variant="quiet"
            className="border-paper-ink/15 bg-paper-lift text-paper-ink"
            onClick={() => onReport(place.id, { closed: true })}
          >
            {report?.closed ? "已记：关门" : "上报关门"}
          </Button>
        </div>
        <p className="mt-1 text-2xs text-paper-ink/40">上报仅保存在本机，不上传。</p>

        <Button type="button" variant="ink" size="xl" className="mt-4 w-full" onClick={onGo}>
          <Navigation className="size-4" />
          {intent === "gear" ? "去拿雨具" : "去这里躲雨"}
        </Button>
      </div>
    </section>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-paper-ink/10 bg-paper-lift px-3 py-2">
      <dt className="flex items-center gap-1 text-2xs text-paper-ink/45">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm leading-snug">{value}</dd>
    </div>
  );
}

function WalkSheet({
  place,
  arrived,
  onBack,
  onArrived,
  onReset,
}: {
  place: Place;
  arrived: boolean;
  onBack: () => void;
  onArrived: () => void;
  onReset: () => void;
}) {
  const next = place.steps[0];
  return (
    <section className="absolute inset-x-0 bottom-0 z-20 rounded-t-xl border border-border bg-paper text-paper-ink">
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-paper-ink/15" />
      <div className="px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex h-11 items-center gap-1 text-sm text-paper-ink/70"
        >
          <ArrowLeft className="size-4" /> 地点详情
        </button>

        {arrived ? (
          <div>
            <p className="font-display text-2xl">已到达檐下</p>
            <p className="mt-1 text-sm text-paper-ink/65">
              {place.name} · {place.entrance}
            </p>
            <Button type="button" variant="ink" size="xl" className="mt-5 w-full" onClick={onReset}>
              返回附近
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium tracking-wide text-paper-ink/45">下一步</p>
            <p className="mt-1 font-display text-2xl leading-snug text-balance">{next?.text}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-paper-ink/60">
              <MapPin className="size-4" />
              {place.walkMin} 分钟 · {place.meters} 米 · {place.name}
            </p>

            <ol className="mt-4 space-y-2">
              {place.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-md border border-paper-ink/10 bg-paper-lift px-3 py-2.5"
                >
                  <span className="font-display text-lg leading-none tabular-nums text-paper-ink/35">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-sm">{step.text}</span>
                    <span className="mt-0.5 block text-xs text-paper-ink/45">
                      {step.covered ? "有顶 / 室内" : "露天，尽快走"}
                      {step.meters ? ` · ${step.meters} 米` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            {place.floodOnRoute ? (
              <p className="mt-3 flex gap-1.5 text-xs text-danger">
                <Waves className="size-3.5 shrink-0" />
                南口下凹路段积水约 8 cm，走西侧入口，不要下桥坑。
              </p>
            ) : null}
            <Button type="button" variant="ink" size="xl" className="mt-5 w-full" onClick={onArrived}>
              我已到达
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function AboutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-bg/70">
      <div className="max-h-screen w-full overflow-y-auto rounded-t-xl border border-border bg-paper px-4 pb-8 pt-3 text-paper-ink">
        <div className="mx-auto h-1 w-10 rounded-full bg-paper-ink/15" />
        <div className="mt-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">第一版说明</h2>
          <button type="button" onClick={onClose} className="h-11 px-2 text-sm">
            关闭
          </button>
        </div>
        <AboutBody />
      </div>
    </div>
  );
}

function AboutBody() {
  return (
    <div className="mt-4 space-y-5 text-sm leading-relaxed text-pretty">
      <section>
        <h3 className="font-medium">产品</h3>
        <p className="mt-1 text-paper-ink/75">
          檐下：给不认路的北京路人用的避雨导引。打开就能看附近能进的干处，三步内出发。无登录、无支付。
        </p>
      </section>
      <section>
        <h3 className="font-medium">用户与场景</h3>
        <p className="mt-1 text-paper-ink/75">
          游客、出差行人、突然遇雨且没带伞的路人。地点固定为王府井大街中段（模拟）。需求只有两件：立刻躲进去，或立刻拿到雨具离开。
        </p>
      </section>
      <section>
        <h3 className="font-medium">核心功能（仅此三项）</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-4 text-paper-ink/75">
          <li>附近避雨点 + 雨具点合图，按步行时间与遮雨质量排序。</li>
          <li>地点详情：入口、是否室内、雨具、积水提示。</li>
          <li>湿路步行导引：分段标明露天 / 有顶，一键到达。</li>
        </ol>
      </section>
      <section>
        <h3 className="font-medium">数据来源（本版全部模拟）</h3>
        <p className="mt-1 text-paper-ink/75">
          正式版应对接：微信定位；高德 / 腾讯 POI 与步行路径；和风分钟降水；北京水务 × 高德积水；腾讯爱心驿站；汛期党群避险点。本原型用 7 个王府井点位、一条积水、12 分钟后雨弱的分钟降水，均标「模拟」。
        </p>
      </section>
      <section>
        <h3 className="font-medium">参考与借鉴</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-paper-ink/75">
          <li>腾讯地图爱心驿站：专题图层 + 设施标签 + 一键导航。</li>
          <li>高德积水地图：水深与绕行，改成行人视角。</li>
          <li>北京地铁雨衣、党群临时避险：雨天实物网络，单独成类。</li>
          <li>日本 aikasa：两分钟内拿到伞的密度，本版只仿「找到有伞的点」。</li>
        </ul>
      </section>
      <section>
        <h3 className="font-medium">设计原则</h3>
        <p className="mt-1 text-paper-ink/75">
          湿手可用：大按钮、高对比、少字。打开即决策，不搜关键词。地图用暗色底图，列表用浅纸色，模拟「街上湿、檐下干」。
        </p>
      </section>
    </div>
  );
}
