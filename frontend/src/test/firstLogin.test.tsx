import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import FirstLogin from "../scenes/login/FirstLogin";
import Login from "../scenes/login";
import UserForm from "../scenes/users/UserForm";
import ViewUser from "../scenes/users/ViewUser";
import { authService } from "../services/authService";
import { userService } from "../services/userService";
import { roleService } from "../services/roleService";
import { ApiError } from "../services/apiClient";
import {
  actor,
  invitation,
  staff,
  secondStaff,
  role,
  id,
  paginationInfo,
} from "./fixtures";

const login = vi.fn();
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: actor,
    hasPermission: (permission: string) =>
      [...actor.permissions, "users.password.reset"].includes(permission),
    login,
  }),
}));
const token = "A".repeat(43);
const temporaryPassword = "Admin-added-temp-123";
const permanentPassword = "Employee-chosen-password-456";
function Location() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.hash}
    </span>
  );
}
function page(element: ReactElement, path = `/first-login#token=${token}`) {
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
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Location />
        <Routes>
          <Route path="/users/:id" element={element} />
          <Route path="*" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  login.mockReset();
  vi.spyOn(roleService, "getAssignable").mockResolvedValue({ roles: [role] });
  vi.spyOn(userService, "getAll").mockResolvedValue({
    users: [
      {
        ...staff,
        _id: id,
        firstName: "Supervisor",
        lastName: "Test",
        scope: "tenant",
      },
    ],
    paginationInfo,
  });
});

it("requires a valid invitation and removes its secret from the address bar without submitting", async () => {
  const complete = vi
    .spyOn(authService, "completeFirstLogin")
    .mockResolvedValue({ success: true });
  const result = page(<FirstLogin />);
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/first-login$/),
  );
  expect(screen.getByLabelText("Temporary password")).toBeInTheDocument();
  expect(complete).not.toHaveBeenCalled();
  result.unmount();
  page(<FirstLogin />, "/first-login#token=invalid");
  expect(
    screen.getByText(/invitation link is missing or invalid/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Set password" }),
  ).not.toBeInTheDocument();
});

it("validates confirmation and a different password before completing setup", async () => {
  const complete = vi
    .spyOn(authService, "completeFirstLogin")
    .mockResolvedValue({ success: true });
  page(<FirstLogin />);
  await userEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(
    await screen.findByText("Temporary password is required"),
  ).toBeInTheDocument();
  expect(complete).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Temporary password"), {
    target: { value: temporaryPassword },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: temporaryPassword },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "mismatch-password" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByText("Passwords must match")).toBeInTheDocument();
  expect(
    await screen.findByText(
      "Choose a different password from the temporary password",
    ),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: permanentPassword },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: permanentPassword },
  });
  await userEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(
    await screen.findByRole("link", { name: "Go to sign in" }),
  ).toBeInTheDocument();
  expect(complete).toHaveBeenCalledWith(token, {
    temporaryPassword,
    newPassword: permanentPassword,
    confirmPassword: permanentPassword,
  });
  expect(screen.queryByLabelText("Temporary password")).not.toBeInTheDocument();
  expect(login).not.toHaveBeenCalled();
});

it("keeps expired-invitation errors on the setup page without authenticating", async () => {
  vi.spyOn(authService, "completeFirstLogin").mockRejectedValue(
    new ApiError(
      "Invitation is expired. Ask for replacement credentials.",
      400,
      null,
    ),
  );
  page(<FirstLogin />);
  for (const [label, value] of [
    ["Temporary password", temporaryPassword],
    ["New password", permanentPassword],
    ["Confirm new password", permanentPassword],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await userEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByText(/Invitation is expired/)).toBeInTheDocument();
  expect(login).not.toHaveBeenCalled();
});

it("shows Super Admin separate one-time copy controls for an admin-added password and invitation", async () => {
  const user = userEvent.setup();
  const clipboard = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  vi.spyOn(userService, "create").mockResolvedValue({
    user: { ...staff, mustChangePassword: true },
    invitation,
    success: true,
  });
  page(<UserForm />, "/users/new");
  await user.type(screen.getByLabelText("User name"), "New employee");
  await user.type(
    screen.getByLabelText("Email", { exact: true }),
    "employee@example.com",
  );
  fireEvent.mouseDown(await screen.findByLabelText("Tenant supervisor"));
  await user.click(
    await screen.findByRole("option", { name: /Supervisor Test/ }),
  );
  await user.type(screen.getByLabelText(/Initial password/), temporaryPassword);
  await user.click(screen.getByRole("button", { name: "Create user" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.queryByLabelText(/Initial password/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Copy login link" }));
  expect(clipboard).toHaveBeenLastCalledWith(invitation.url);
  await user.click(
    screen.getByRole("button", { name: "Copy temporary password" }),
  );
  expect(clipboard).toHaveBeenLastCalledWith(temporaryPassword);
  expect(invitation.url.includes(temporaryPassword)).toBe(false);
});

it("replaces lost credentials for pending users and offers the generated password only in the new dialog", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(userService, "getById").mockResolvedValue({
    user: { ...secondStaff, mustChangePassword: true },
  });
  const replace = vi
    .spyOn(userService, "replaceFirstLoginInvitation")
    .mockResolvedValue({ invitation });
  page(<ViewUser />, `/users/${secondStaff._id}`);
  await user.click(
    await screen.findByRole("button", {
      name: "Replace first-login credentials",
    }),
  );
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(replace.mock.calls[0]?.[0]).toBe(secondStaff._id);
  expect(replace.mock.calls[0]?.[1]).toMatch(/^[A-Za-z0-9_-]{16}$/);
  expect(screen.getByLabelText("Temporary password")).toHaveValue(
    replace.mock.calls[0]?.[1],
  );
});

it("normal login explains that pending accounts must use their invitation", async () => {
  login.mockRejectedValue(
    new ApiError(
      "Open your first-login invitation before signing in.",
      403,
      null,
    ),
  );
  page(<Login />, "/");
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "staff@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: temporaryPassword },
  });
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByText(
      "Open your first-login invitation before signing in.",
    ),
  ).toBeInTheDocument();
});
