import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { actor, id, job, paginationInfo } from "../test/fixtures";
import {
  invoicesSchema,
  jobsSchema,
  payrollSchema,
  sessionSchema,
} from "../types/api";
import {
  ApiError,
  apiRequest,
  clearAccessToken,
  setAccessToken,
} from "./apiClient";
import { authService } from "./authService";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  clearAccessToken();
});
afterEach(() => {
  vi.unstubAllGlobals();
  clearAccessToken();
});

describe("typed API client", () => {
  it("sends first-login secrets only in the POST body without an access token or refresh retry", async () => {
    fetchMock.mockResolvedValue(json({ success: true }));
    setAccessToken("an-existing-session-token");
    const token = "A".repeat(43);
    await authService.completeFirstLogin(token, {
      temporaryPassword: "temporary-password",
      newPassword: "permanent-password",
      confirmPassword: "permanent-password",
    });
    const [url, options] = fetchMock.mock.calls[0] || [];
    expect(String(url)).toBe("http://localhost:4000/api/auth/first-login");
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
    const submitted: unknown = JSON.parse(String(options?.body));
    expect(submitted).toEqual({
      token,
      temporaryPassword: "temporary-password",
      newPassword: "permanent-password",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("uses only the configured backend and centralizes bearer headers and cookies", async () => {
    setAccessToken("access-token");
    fetchMock.mockResolvedValue(json({ count: 3 }));
    const result = await apiRequest(
      "users/count",
      { params: { scope: "staff", page: 2 } },
      z.object({ count: z.number() }),
    );
    expect(result.count).toBe(3);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "http://localhost:4000/api/users/count?scope=staff&page=2",
    );
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer access-token",
    );
    expect(options?.credentials).toBe("include");
    await expect(
      apiRequest("https://other.example/profile", {}, z.unknown()),
    ).rejects.toThrow("configured VITE_API_URL");
    await expect(apiRequest("../outside", {}, z.unknown())).rejects.toThrow(
      "configured VITE_API_URL",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("deduplicates token refresh and retries concurrent protected requests", async () => {
    setAccessToken("old-token");
    let refreshCount = 0;
    fetchMock.mockImplementation(async (input, options) => {
      if (String(input).endsWith("/auth/refresh")) {
        refreshCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(new Headers(options?.headers).has("Authorization")).toBe(false);
        return json({ success: true, accessToken: "new-token", user: actor });
      }
      return new Headers(options?.headers).get("Authorization") ===
        "Bearer new-token"
        ? json({ count: 1 })
        : json({ message: "expired" }, 401);
    });
    const schema = z.object({ count: z.number() });
    const result = await Promise.all([
      apiRequest("users/count", {}, schema),
      apiRequest("job/getCount", {}, schema),
    ]);
    expect(result).toEqual([{ count: 1 }, { count: 1 }]);
    expect(refreshCount).toBe(1);
  });
  it("rejects malformed response contracts and returns useful API errors", async () => {
    fetchMock.mockResolvedValueOnce(json({ count: "bad" }));
    await expect(
      apiRequest("users/count", {}, z.object({ count: z.number() })),
    ).rejects.toBeInstanceOf(z.ZodError);
    fetchMock.mockResolvedValueOnce(
      json(
        {
          message: "Request validation failed",
          issues: [{ path: "body.email", message: "Invalid email" }],
        },
        400,
      ),
    );
    await expect(
      apiRequest("users", { method: "POST", body: {} }, z.unknown()),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Request validation failed",
    } satisfies Partial<ApiError>);
  });
  it("accepts backend populated, ID-only, deleted-client, and staff-restricted responses", () => {
    expect(
      sessionSchema.parse({ accessToken: "token", user: actor }).user.id,
    ).toBe(actor.id);
    expect(
      jobsSchema.parse({ jobs: [job], paginationInfo }).jobs[0].client
        .firstName,
    ).toBe("Acme");
    const staffJob = {
      ...job,
      client: id,
      assignedStaff: [actor.id],
      staffAssignments: undefined,
      orgTotal: undefined,
      receivedPayments: undefined,
      currentStaffAssignment: {
        staff: actor.id,
        hours: 1,
        hourRate: 20,
        payment: 20,
        paymentStatus: "Pending",
        isSignIn: true,
        isSignOff: false,
      },
    };
    expect(
      jobsSchema.parse({ jobs: [staffJob] }).jobs[0].currentStaffAssignment
        ?.staff._id,
    ).toBe(actor.id);
    expect(
      jobsSchema.parse({ jobs: [{ ...job, client: null }] }).jobs[0].client
        .firstName,
    ).toBe("");
    expect(
      invoicesSchema.parse({
        invoices: [
          {
            _id: id,
            invoiceTitle: "Invoice",
            invoiceDescription: "Cleaning",
            client: id,
            invoiceStatus: "Pending",
          },
        ],
        paginationInfo,
      }).invoices[0].client._id,
    ).toBe(id);
    expect(
      payrollSchema.parse({
        staff: { name: "Employee", payFrequency: "Weekly" },
        period: { periodStart: "2026-11-01", periodEnd: "2026-11-07" },
        entries: [],
        totalHours: 0,
        totalAmount: 0,
        payouts: [],
        payoutPaginationInfo: paginationInfo,
      }).entries,
    ).toEqual([]);
  });
});
