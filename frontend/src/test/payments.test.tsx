import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { actor, employeeId, id, paginationInfo } from "./fixtures";
import { employeePaymentService as service } from "../services/employeePaymentService";
import {
  employeePaymentSchema,
  paymentEmployeeSchema,
  paymentPreviewSchema,
} from "../types/payments";
import {
  MarkPaidDialog,
  PreparePaymentDialog,
  SalaryPlanDialog,
} from "../scenes/payments/PaymentForms";
import PaymentReceiptDialog from "../scenes/payments/PaymentDetails";
import MyPayments from "../scenes/payments/MyPayments";
import EmployeePayments from "../scenes/payments/EmployeePayments";

let currentActor = actor;
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: currentActor,
    hasPermission: (key: string) => currentActor.permissions.includes(key),
  }),
}));
const employee = paymentEmployeeSchema.parse({
  _id: employeeId,
  name: "Test Cleaner",
  email: "cleaner@example.com",
  scope: "staff",
  status: "active",
  frequency: "Daily",
  salary: null,
});
const preview = paymentPreviewSchema.parse({
  payeeName: employee.name,
  kind: "Work",
  frequency: "Daily",
  periodStart: "2026-11-14",
  periodEnd: "2026-11-14",
  amount: 40,
  entries: [
    {
      jobName: "Office clean",
      signInTime: "2026-11-14T02:30:00Z",
      hours: 2,
      hourRate: 20,
      amount: 40,
    },
  ],
});
const pending = employeePaymentSchema.parse({
  ...preview,
  _id: id,
  employeeId,
  employeeScope: "staff",
  payeeEmail: employee.email,
  status: "Pending",
});
const paid = employeePaymentSchema.parse({
  ...pending,
  status: "Paid",
  receiptNumber: "CC-PAY-TEST",
  paymentDate: "2026-11-14",
  method: "Bank Transfer",
});
function page(element: ReactElement) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {element}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  currentActor = {
    ...actor,
    permissions: [
      "payroll.read",
      "payroll.record",
      "salaries.read",
      "salaries.manage",
      "salaries.record",
    ],
  };
  vi.spyOn(service, "employees").mockResolvedValue({
    employees: [employee],
    paginationInfo,
  });
  vi.spyOn(service, "list").mockResolvedValue({
    payments: [],
    paginationInfo: { ...paginationInfo, totalResult: 0 },
  });
  vi.spyOn(service, "jobs").mockResolvedValue({
    jobs: [{ _id: id, name: "Office clean" }],
    paginationInfo,
  });
});

it("requires a completed job for per-job payments and loads assigned jobs lazily", async () => {
  const calculate = vi.spyOn(service, "preview").mockResolvedValue({ preview });
  page(<PreparePaymentDialog employee={employee} onClose={vi.fn()} />);
  expect(service.jobs).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getByLabelText("Payment frequency"));
  for (const name of ["Daily", "Per job", "Weekly", "Monthly"])
    expect(screen.getByRole("option", { name })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "Per job" }));
  await waitFor(() =>
    expect(service.jobs).toHaveBeenCalledWith(employeeId, {
      page: 1,
      limit: 20,
    }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Calculate preview" }),
  );
  expect(await screen.findByText("Choose a completed job")).toBeInTheDocument();
  expect(calculate).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getByLabelText("Completed job"));
  await userEvent.click(screen.getByRole("option", { name: "Office clean" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Calculate preview" }),
  );
  await waitFor(() =>
    expect(calculate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ frequency: "PerJob", jobId: id }),
    ),
  );
});

it("invalidates the displayed preview after a selection changes before preparing", async () => {
  vi.spyOn(service, "preview").mockResolvedValue({ preview });
  const prepare = vi
    .spyOn(service, "prepare")
    .mockResolvedValue({ payment: pending });
  const close = vi.fn();
  page(<PreparePaymentDialog employee={employee} onClose={close} />);
  const button = screen.getByRole("button", {
    name: "Prepare pending payment",
  });
  expect(button).toBeDisabled();
  await userEvent.click(
    screen.getByRole("button", { name: "Calculate preview" }),
  );
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Work date"), {
    target: { value: "2026-11-13" },
  });
  expect(button).toBeDisabled();
  await userEvent.click(
    screen.getByRole("button", { name: "Calculate preview" }),
  );
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(prepare.mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({ date: "2026-11-13", frequency: "Daily" }),
  );
});

it("marks a pending payment paid with payment details then offers its PAID receipt", async () => {
  const mark = vi
    .spyOn(service, "markPaid")
    .mockResolvedValue({ payment: paid });
  const onPaid = vi.fn();
  const result = page(
    <MarkPaidDialog payment={pending} onClose={vi.fn()} onPaid={onPaid} />,
  );
  await userEvent.type(
    screen.getByLabelText("Reference number (optional)"),
    "BANK-1",
  );
  await userEvent.click(screen.getByRole("button", { name: "Confirm paid" }));
  await waitFor(() => expect(onPaid).toHaveBeenCalledWith(paid));
  expect(mark).toHaveBeenCalledWith(
    id,
    expect.objectContaining({
      method: "Bank Transfer",
      referenceNumber: "BANK-1",
    }),
  );
  result.unmount();
  page(<PaymentReceiptDialog payment={paid} onClose={vi.fn()} />);
  expect(screen.getByText("PAID")).toBeInTheDocument();
  expect(screen.getByText("CC-PAY-TEST")).toBeInTheDocument();
});

it("validates fixed salary amounts and restricts salaries to weekly or monthly", async () => {
  const salary = vi.spyOn(service, "salary").mockResolvedValue({
    salary: {
      amount: 1200,
      frequency: "Monthly",
      effectiveFrom: "2026-11-01",
    },
  });
  const supervisor = { ...employee, scope: "tenant" as const };
  page(<SalaryPlanDialog employee={supervisor} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Save salary" }));
  expect(await screen.findByText("Enter a number")).toBeInTheDocument();
  expect(salary).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getByLabelText("Salary frequency"));
  expect(screen.getByRole("option", { name: "Weekly" })).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Daily" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "Monthly" }));
  await userEvent.type(screen.getByLabelText("Salary per period"), "1200");
  fireEvent.change(screen.getByLabelText("Effective from"), {
    target: { value: "2026-11-01" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Save salary" }));
  await waitFor(() =>
    expect(salary).toHaveBeenCalledWith(employeeId, {
      amount: 1200,
      frequency: "Monthly",
      effectiveFrom: "2026-11-01",
    }),
  );
});

it("employees see paid receipts without manager controls", async () => {
  currentActor = {
    ...actor,
    scope: "staff",
    permissions: ["payroll.self.read"],
  };
  const receipts = vi
    .spyOn(service, "receipts")
    .mockResolvedValue({ payments: [paid], paginationInfo });
  page(<MyPayments />);
  expect(await screen.findByText("Test Cleaner")).toBeInTheDocument();
  expect(receipts).toHaveBeenCalledWith({ page: 1, limit: 20 });
  expect(screen.getByRole("button", { name: "Receipt" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Mark paid" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Prepare payment" }),
  ).not.toBeInTheDocument();
});

it("managers with read permission can review prepared work without payment or receipt controls", async () => {
  currentActor = { ...actor, permissions: ["payroll.read"] };
  vi.spyOn(service, "list").mockResolvedValue({
    payments: [pending],
    paginationInfo,
  });
  page(<EmployeePayments />);
  await userEvent.click(
    await screen.findByRole("button", { name: "View details" }),
  );
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Office clean")).toBeInTheDocument();
  expect(within(dialog).getByText("Total: LKR 40.00")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Mark paid" }),
  ).not.toBeInTheDocument();
  expect(
    within(dialog).queryByRole("button", { name: "Print receipt" }),
  ).not.toBeInTheDocument();
});

it("managers can retry job-total updates from paid history after closing the payment dialog", async () => {
  vi.spyOn(service, "list")
    .mockResolvedValueOnce({
      payments: [{ ...paid, jobTotalsPending: true }],
      paginationInfo,
    })
    .mockResolvedValue({ payments: [paid], paginationInfo });
  const synchronize = vi
    .spyOn(service, "synchronize")
    .mockResolvedValue({ payment: paid, syncPending: false });
  const mark = vi.spyOn(service, "markPaid");
  page(<EmployeePayments />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Update job totals" }),
  );
  await waitFor(() => expect(synchronize.mock.calls[0]?.[0]).toBe(id));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Update job totals" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Receipt" })).toBeInTheDocument();
  expect(mark).not.toHaveBeenCalled();
});

it("a failed job update retries synchronization without resubmitting payment details", async () => {
  const mark = vi
    .spyOn(service, "markPaid")
    .mockResolvedValue({
      payment: { ...paid, jobTotalsPending: true },
      syncPending: true,
    });
  const synchronize = vi
    .spyOn(service, "synchronize")
    .mockResolvedValue({ payment: paid, syncPending: false });
  const onPaid = vi.fn();
  page(<MarkPaidDialog payment={pending} onClose={vi.fn()} onPaid={onPaid} />);
  expect(screen.getByText("Office clean")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Confirm paid" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Retry synchronization" }),
  );
  await waitFor(() => expect(onPaid).toHaveBeenCalledWith(paid));
  expect(mark).toHaveBeenCalledTimes(1);
  expect(synchronize.mock.calls[0]?.[0]).toBe(id);
});

it("superadmins have no personal payment query and supervisors get no salary management by default", async () => {
  const receipts = vi.spyOn(service, "receipts");
  const result = page(
    <Routes>
      <Route path="/" element={<MyPayments />} />
      <Route
        path="/employee-payments"
        element={<div>Payment management</div>}
      />
    </Routes>,
  );
  expect(await screen.findByText("Payment management")).toBeInTheDocument();
  expect(receipts).not.toHaveBeenCalled();
  result.unmount();
  currentActor = {
    ...actor,
    scope: "tenant",
    permissions: ["payroll.read", "payroll.record", "payroll.self.read"],
  };
  page(<EmployeePayments />);
  expect(await screen.findByText("Test Cleaner")).toBeInTheDocument();
  expect(
    screen.getByRole("tab", { name: "Cleaner payments" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("tab", { name: "Supervisor salaries" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Salary settings" }),
  ).not.toBeInTheDocument();
});
