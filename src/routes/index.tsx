import { createFileRoute } from "@tanstack/react-router";
import { YanxiaApp } from "@/components/yanxia-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <YanxiaApp />;
}
