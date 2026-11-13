import express from "express"

const router = express.Router();

import {addInvoice,updatedInvoice ,getAllInvoices,getInvoiceById,deleteInvoiceById,updateStatus} from "../controllers/invoiceController.js"
import { authenticate, requirePermissions } from "../middleware/authentication.js";
import { requireInvoiceRecord } from "../middleware/authorization.js";
import { asyncHandler } from "../middleware/asyncHandler.js";


router.use(authenticate);
router.post("/addInvoice", requirePermissions("invoices.create"), asyncHandler(addInvoice));
router.put("/updatedInvoice/:id", requirePermissions("invoices.update"), requireInvoiceRecord("id"), asyncHandler(updatedInvoice));
router.delete("/deleteInvoiceById/:id", requirePermissions("invoices.delete"), requireInvoiceRecord("id"), asyncHandler(deleteInvoiceById));
router.get("/getInvoiceById/:id", requirePermissions("invoices.read"), requireInvoiceRecord("id"), asyncHandler(getInvoiceById));
router.get("/getAllInvoices", requirePermissions("invoices.read"), asyncHandler(getAllInvoices));
router.patch("/updateStatus/:id", requirePermissions("invoices.status.update"), requireInvoiceRecord("id"), asyncHandler(updateStatus));

export default router;
