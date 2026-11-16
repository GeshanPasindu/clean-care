import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { databaseUri, serverPort } from "./config/environment.js";
import StaffPayroll from "./models/staffPayrollModel.js";
import EmployeePayment from "./models/employeePaymentModel.js";
import SalaryPlan from "./models/salaryPlanModel.js";

const port = serverPort();
mongoose
  .connect(databaseUri())
  .then(async () => {
    await Promise.all([StaffPayroll.init(), EmployeePayment.init(), SalaryPlan.init()]);
    app.listen(port, () => {
      console.log("Connected to the database and listening on port", port);
    });
  })
  .catch(async (error: unknown) => {
    console.error("MongoDB connection error:", error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
