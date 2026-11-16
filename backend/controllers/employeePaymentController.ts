import { employeePaymentService as service } from "../services/employeePaymentService.js";
import { validatedController as handle } from "../middleware/validatedController.js";
import {
  requestSchema as request,
  emptySchema as empty,
  paginationQuerySchema,
} from "../validation/common.js";
import {
  employeeParamsSchema,
  paymentParamsSchema,
  employeeListSchema,
  paymentListSchema,
  preparePaymentSchema,
  salaryPlanSchema,
  markPaidSchema,
} from "../validation/payments.js";
export const employees = handle(
  request(empty, empty, employeeListSchema),
  async (input, user, _req, res) =>
    res.json({
      success: true,
      ...(await service.employees(input.query, user)),
    }),
);
export const jobs = handle(
  request(empty, employeeParamsSchema, paginationQuerySchema),
  async (input, user, _req, res) =>
    res.json({
      success: true,
      ...(await service.jobs(input.params.employeeId, input.query, user)),
    }),
);
export const list = handle(
  request(empty, empty, paymentListSchema),
  async (input, user, _req, res) =>
    res.json({ success: true, ...(await service.list(input.query, user)) }),
);
export const salary = handle(
  request(salaryPlanSchema, employeeParamsSchema, empty),
  async (input, user, _req, res) =>
    res.json({
      success: true,
      ...(await service.salary(input.params.employeeId, input.body, user)),
    }),
);
export const preview = handle(
  request(preparePaymentSchema, empty, empty),
  async (input, user, _req, res) =>
    res.json({ success: true, ...(await service.preview(input.body, user)) }),
);
export const prepare = handle(
  request(preparePaymentSchema, empty, empty),
  async (input, user, _req, res) =>
    res
      .status(201)
      .json({ success: true, ...(await service.prepare(input.body, user)) }),
);
export const markPaid = handle(
  request(markPaidSchema, paymentParamsSchema, empty),
  async (input, user, _req, res) =>
    res.json({
      success: true,
      ...(await service.markPaid(input.params.id, input.body, user)),
    }),
);
export const synchronize = handle(
  request(empty, paymentParamsSchema, empty),
  async (input, user, _req, res) =>
    res.json({
      success: true,
      ...(await service.synchronize(input.params.id, user)),
    }),
);
export const cancel = handle(
  request(empty, paymentParamsSchema, empty),
  async (input, user, _req, res) => {
    await service.cancel(input.params.id, user);
    return res.json({ success: true });
  },
);
export const receipts = handle(
  request(empty, empty, paginationQuerySchema),
  async (input, user, _req, res) =>
    res.json({ success: true, ...(await service.receipts(user, input.query)) }),
);
