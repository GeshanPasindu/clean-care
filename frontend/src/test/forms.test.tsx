import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClientForm from "../scenes/clients/ClientForm";
import { clientService } from "../scenes/clients/clientService";
import JobForm from "../scenes/jobs/JobForm";
import { jobService } from "../scenes/jobs/jobService";
import PaymentReceiptDialog from "../scenes/jobs/paymentSummery/PaymentReceiptDialog";
import Login from "../scenes/login";
import UserForm from "../scenes/users/UserForm";
import { roleService } from "../services/roleService";
import { userService } from "../services/userService";
import {
  actor,
  client,
  job,
  paginationInfo,
  role,
  staff,
  secondStaff,
  invitation,
} from "./fixtures";

let currentActor = actor;
const login = vi.fn();
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: currentActor,
    hasPermission: (key: string) => currentActor.permissions.includes(key),
    login,
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));
function page(element: ReactElement, editJobId?: string) {
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
        initialEntries={editJobId ? [`/jobs/editjob/${editJobId}`] : undefined}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {editJobId ? (
          <Routes>
            <Route path="/jobs/editjob/:id" element={element} />
            <Route path="/jobs" element={<div>Job list</div>} />
          </Routes>
        ) : (
          element
        )}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  currentActor = actor;
  login.mockReset();
  vi.spyOn(clientService, "getAllActive").mockResolvedValue({
    clients: [client],
  });
  vi.spyOn(userService, "getAll").mockResolvedValue({
    users: [staff],
    paginationInfo,
  });
  vi.spyOn(roleService, "getAssignable").mockResolvedValue({ roles: [role] });
});

describe("React Hook Form submission boundaries", () => {
  it("blocks invalid login locally and preserves passwords on valid submission", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(actor);
    page(<Login />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Password is required")).toBeVisible();
    expect(login).not.toHaveBeenCalled();
    await user.type(
      screen.getByLabelText("Email address"),
      "ADMIN@example.com",
    );
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "  password  ",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "  password  ",
      }),
    );
  });
  it("shows client field errors and submits a validated DTO", async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(clientService, "create")
      .mockResolvedValue({ success: true });
    page(<ClientForm />);
    await user.click(screen.getByRole("button", { name: "Create client" }));
    expect(await screen.findByText("First name is required")).toBeVisible();
    expect(create).not.toHaveBeenCalled();
    for (const [label, value] of [
      ["First name", " Acme "],
      ["Email", "CLIENT@example.com"],
      ["Address", "Main street"],
      ["Phone number", "01234"],
    ]) {
      await user.type(screen.getByLabelText(label, { exact: true }), value);
    }
    await user.click(screen.getByRole("button", { name: "Create client" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      firstName: "Acme",
      lastName: "",
      email: "client@example.com",
      phoneNumber: "01234",
    });
  });
  it("requires job fields and staff selection before calling the service", async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(jobService, "create")
      .mockResolvedValue({ success: true, job });
    vi.mocked(userService.getAll).mockResolvedValue({
      users: [staff, secondStaff],
      paginationInfo,
    });
    page(<JobForm />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create job" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Create job" }));
    expect(
      await screen.findByText("Select at least one staff member"),
    ).toBeVisible();
    expect(create).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Job name"), "Cleaning");
    await user.type(screen.getByLabelText("Description"), "Weekly cleaning");
    for (const [label, value] of [
      ["Billable hours", "4"],
      ["Hourly rate charged to client", "30"],
      ["Estimated hours per cleaner", "3"],
    ]) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByLabelText("Client"));
    await user.click(
      await screen.findByRole("option", { name: "Acme Cleaning" }),
    );
    await user.click(screen.getByLabelText("Assigned Staff"));
    await user.click(await screen.findByRole("option", { name: "Test Staff" }));
    await user.click(
      await screen.findByRole("option", { name: "Senior Cleaner" }),
    );
    fireEvent.keyDown(document.activeElement || document.body, {
      key: "Escape",
    });
    await user.click(screen.getByRole("button", { name: "Create job" }));
    expect(await screen.findAllByText("Enter a number")).toHaveLength(2);
    expect(create).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("Default staff hourly rate"),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Hourly pay for Test Staff"), "20");
    await user.type(
      screen.getByLabelText("Hourly pay for Senior Cleaner"),
      "30",
    );
    await user.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      assignedStaff: [staff._id, secondStaff._id],
      orgHourRate: 30,
      staffRates: { [staff._id]: 20, [secondStaff._id]: 30 },
    });
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("staffHourRate");
  });
  it("generates initial passwords and reports account errors before creating users", async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(userService, "create")
      .mockResolvedValue({ user: staff, invitation, success: true });
    page(<UserForm />);
    await user.click(screen.getByRole("button", { name: "Generate" }));
    const initialPassword = screen.getByLabelText(/Initial password/);
    expect(screen.getByDisplayValue(/^[A-Za-z\d_-]{16}$/)).toBe(
      initialPassword,
    );
    await user.click(screen.getByRole("button", { name: "Create user" }));
    expect(await screen.findByText("User name is required")).toBeVisible();
    expect(create).not.toHaveBeenCalled();
  });
  it("preserves existing pay on edit and requires a rate for a newly added cleaner", async () => {
    const user = userEvent.setup();
    vi.spyOn(jobService, "getById").mockResolvedValue({ job });
    vi.mocked(userService.getAll).mockResolvedValue({
      users: [staff, secondStaff],
      paginationInfo,
    });
    const update = vi
      .spyOn(jobService, "update")
      .mockResolvedValue({ success: true, updatedJob: job });
    page(<JobForm editing />, job._id);
    expect(
      await screen.findByLabelText("Hourly pay for Test Staff"),
    ).toHaveValue(20);
    await user.click(screen.getByLabelText("Assigned Staff"));
    await user.click(
      await screen.findByRole("option", { name: "Senior Cleaner" }),
    );
    fireEvent.keyDown(document.activeElement || document.body, {
      key: "Escape",
    });
    expect(screen.getByLabelText("Hourly pay for Senior Cleaner")).toHaveValue(
      null,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter a number")).toBeVisible();
    expect(update).not.toHaveBeenCalled();
    await user.type(
      screen.getByLabelText("Hourly pay for Senior Cleaner"),
      "30",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]?.[1]).toMatchObject({
      staffRates: { [staff._id]: 20, [secondStaff._id]: 30 },
    });
    expect(update.mock.calls[0]?.[1]).not.toHaveProperty("staffHourRate");
  });
  it("creates staff through the supervisor flow without sending role or supervisor assignments", async () => {
    const user = userEvent.setup();
    currentActor = {
      ...actor,
      scope: "tenant",
      isPlatformAdmin: false,
      permissions: ["users.create", "users.bank.update"],
    };
    const create = vi
      .spyOn(userService, "create")
      .mockResolvedValue({ user: staff, invitation, success: true });
    page(<UserForm />);
    await user.type(screen.getByLabelText("User name"), "New employee");
    await user.type(
      screen.getByLabelText("Email", { exact: true }),
      "EMPLOYEE@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Generate" }));
    await user.click(screen.getByRole("button", { name: "Create user" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const payload = create.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      userName: "New employee",
      email: "employee@example.com",
      payFrequency: "Weekly",
    });
    expect(payload).not.toHaveProperty("roleId");
    expect(payload).not.toHaveProperty("tenantId");
  });
  it("rejects overpayments before recording a receipt", async () => {
    const user = userEvent.setup();
    const record = vi.spyOn(jobService, "recordClientPayment");
    page(<PaymentReceiptDialog open job={job} onClose={() => {}} />);
    const amount = await screen.findByLabelText(/Amount received/);
    await user.clear(amount);
    await user.type(amount, "9999");
    await user.click(screen.getByRole("button", { name: /Record payment/i }));
    expect(
      await screen.findByText("Amount exceeds the outstanding balance"),
    ).toBeVisible();
    expect(record).not.toHaveBeenCalled();
  });
});
