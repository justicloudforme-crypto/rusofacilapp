import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "@testing-library/react";
import OfflineBanner from "./OfflineBanner";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("OfflineBanner", () => {
  afterEach(() => {
    setOnline(true);
  });

  it("renders nothing when the browser starts online", () => {
    setOnline(true);
    render(<OfflineBanner message="Estás sin conexión" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the message when the browser starts offline", () => {
    setOnline(false);
    render(<OfflineBanner message="Estás sin conexión" />);
    expect(screen.getByRole("status")).toHaveTextContent("Estás sin conexión");
  });

  it("shows the banner when an 'offline' event fires", () => {
    setOnline(true);
    render(<OfflineBanner message="Estás sin conexión" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("hides the banner when an 'online' event fires", () => {
    setOnline(false);
    render(<OfflineBanner message="Estás sin conexión" />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
