import { describe, expect, it } from "vitest";
import { isDevelopmentHost, mayReportToProductionSentry } from "./dev-origin";

describe("isDevelopmentHost", () => {
  const DEV = [
    "localhost",
    "LOCALHOST",
    "app.localhost",
    "noutbuk-vasilii.local",
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "192.168.1.69",
    "10.0.2.2",
    "172.16.0.1",
    "172.31.255.254",
    "169.254.10.1",
    "::1",
    "[::1]",
  ];
  const LIVE = [
    "rusofacilapp.com",
    "www.rusofacilapp.com",
    "rusofacilapp.vercel.app",
    "172.32.0.1",
    "11.0.0.1",
    "8.8.8.8",
    "notlocalhost.com",
    "localhost.attacker.com",
  ];

  it.each(DEV)("%s — адрес разработки", (host) => {
    expect(isDevelopmentHost(host)).toBe(true);
  });

  it.each(LIVE)("%s — не адрес разработки", (host) => {
    expect(isDevelopmentHost(host)).toBe(false);
  });

  it("пустое и отсутствующее значение не считается адресом разработки", () => {
    expect(isDevelopmentHost(null)).toBe(false);
    expect(isDevelopmentHost(undefined)).toBe(false);
    expect(isDevelopmentHost("")).toBe(false);
  });
});

describe("mayReportToProductionSentry — обе стены", () => {
  it("боевая сборка на боевом домене — отчитывается", () => {
    expect(mayReportToProductionSentry("production", "rusofacilapp.com")).toBe(true);
  });

  it("сборка не с Vercel — не отчитывается, где бы ни шла", () => {
    expect(mayReportToProductionSentry("", "rusofacilapp.com")).toBe(false);
    expect(mayReportToProductionSentry(undefined, "rusofacilapp.com")).toBe(false);
  });

  it("ТО САМОЕ СОБЫТИЕ JAVASCRIPT-NEXTJS-8: боевая метка, страница с localhost:3100", () => {
    // Ворота по переменной открыты (метка `vercel-production` зашита
    // сборкой), а страница отдана стендом e2e. Прежний код отчитался бы.
    expect(mayReportToProductionSentry("production", "localhost")).toBe(false);
  });

  it("позитивный контроль: без второй стены тот же случай проходит", () => {
    const onlyFirstWall = (deployEnv: string | undefined) => Boolean(deployEnv);
    expect(onlyFirstWall("production")).toBe(true);
    expect(mayReportToProductionSentry("production", "localhost")).toBe(false);
  });

  it("телефон в локальной сети тоже не отчитывается", () => {
    expect(mayReportToProductionSentry("production", "192.168.1.69")).toBe(false);
  });
});
