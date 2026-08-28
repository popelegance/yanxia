import { createFileRoute } from "@tanstack/react-router";
import { YanxiaApp } from "@/components/yanxia-app";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  return <YanxiaApp />;
}