import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { CheckoutOutcomeNotice, checkoutDeliveredWhatWasPaidFor } from "./CheckoutOutcomeNotice";
import es from "@/dictionaries/es.json";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const strings = {
  success: es.account.checkoutSuccess,
  verifying: es.account.checkoutVerifying,
  notApplied: es.account.checkoutNotApplied,
  supportEmail: "support@rusofacilapp.com",
  supportEmailLabel: es.account.checkoutSupportEmailLabel,
};

/** Long enough to run out every retry the component schedules. */
async function waitOutTheRetries() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
  }
}

describe("checkoutDeliveredWhatWasPaidFor", () => {
  // The exact production shape (PROGRESS.md 7.55): Premium paid for,
  // "standard" delivered. That is a failure, and it used to be greeted
  // with "payment confirmed, your subscription is active".
  it("calls a Premium purchase that produced only standard a failure", () => {
    expect(checkoutDeliveredWhatWasPaidFor("lifetime", "standard")).toBe(false);
    expect(checkoutDeliveredWhatWasPaidFor("lifetime", "free")).toBe(false);
    expect(checkoutDeliveredWhatWasPaidFor("lifetime", "premium")).toBe(true);
  });

  it("asks a monthly or annual purchase only for live access", () => {
    for (const plan of ["monthly", "annual", null]) {
      expect(checkoutDeliveredWhatWasPaidFor(plan, "standard"), `${plan}`).toBe(true);
      expect(checkoutDeliveredWhatWasPaidFor(plan, "premium"), `${plan}`).toBe(true);
      expect(checkoutDeliveredWhatWasPaidFor(plan, "free"), `${plan}`).toBe(false);
    }
  });
});

describe("CheckoutOutcomeNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // NEGATIVE CONTROL, and the one that matters most: a warning that shows
  // up after healthy payments is worse than none, because the next person
  // to see it will not believe it.
  it("says nothing but 'confirmed' when the access did arrive", async () => {
    render(<CheckoutOutcomeNotice granted strings={strings} />);
    expect(screen.getByText(strings.success)).toBeInTheDocument();
    await waitOutTheRetries();
    expect(screen.queryByTestId("checkout-not-applied")).not.toBeInTheDocument();
    expect(screen.queryByText(strings.verifying)).not.toBeInTheDocument();
    // And it does not sit there re-asking the server about a purchase that
    // already worked.
    expect(refresh).not.toHaveBeenCalled();
  });

  // Stripe redirects the browser back before the webhook has necessarily
  // landed, so the first "not granted" reading is normal and must not
  // accuse anyone of anything.
  it("waits, and re-asks the server, before saying anything is wrong", async () => {
    render(<CheckoutOutcomeNotice granted={false} strings={strings} />);
    expect(screen.getByText(strings.verifying)).toBeInTheDocument();
    expect(screen.queryByTestId("checkout-not-applied")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(strings.verifying)).toBeInTheDocument();
  });

  // POSITIVE CONTROL: money in, access not granted — the case that until
  // now showed the buyer a green "your subscription is active".
  it("tells the buyer what happened, and where to write, once it is sure", async () => {
    render(<CheckoutOutcomeNotice granted={false} strings={strings} />);
    await waitOutTheRetries();

    const notice = screen.getByTestId("checkout-not-applied");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(strings.notApplied);
    // In Spanish, and telling them not to pay twice — the first thing
    // somebody does when a payment seems to have vanished.
    expect(strings.notApplied).toContain("No vuelvas a pagar");
    // A working address, reachable in one tap, not a sentence about
    // contacting support.
    const link = screen.getByRole("link", { name: strings.supportEmailLabel });
    expect(link).toHaveAttribute("href", "mailto:support@rusofacilapp.com");
    expect(screen.queryByText(strings.success)).not.toBeInTheDocument();
  });

  it("stops re-asking once it has given up, instead of refreshing forever", async () => {
    render(<CheckoutOutcomeNotice granted={false} strings={strings} />);
    await waitOutTheRetries();
    const settled = refresh.mock.calls.length;
    await waitOutTheRetries();
    expect(refresh.mock.calls.length).toBe(settled);
  });
});
