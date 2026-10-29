import express from "express"

const router = express.Router();

import {addInvoice,updatedInvoice ,getAllInvoices,getInvoiceById,deleteInvoiceById,updateStatus} from "../controllers/invoiceController.js"
import { authenticate, requireRoles } from "../middleware/authentication.js";
import { requireInvoiceRecord } from "../middleware/authorization.js";
import { asyncHandler } from "../middleware/asyncHandler.js";


router.use(authenticate, requireRoles("superAdmin", "admin"));
router.post("/addInvoice", asyncHandler(addInvoice));
router.put("/updatedInvoice/:id", requireInvoiceRecord("id"), asyncHandler(updatedInvoice));
router.delete("/deleteInvoiceById/:id", requireInvoiceRecord("id"), asyncHandler(deleteInvoiceById));
router.get("/getInvoiceById/:id", requireInvoiceRecord("id"), asyncHandler(getInvoiceById));
router.get("/getAllInvoices", asyncHandler(getAllInvoices));
router.patch("/updateStatus/:id", requireInvoiceRecord("id"), asyncHandler(updateStatus));

export default router;
