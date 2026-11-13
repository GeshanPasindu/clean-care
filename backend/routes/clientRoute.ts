import express from "express"

const router = express.Router();

import {addClient,updateClientById ,getAllClientCount,deleteClientById,getClientById,getAllClient,getAllActiveClient,getAllClientPagination,updateStatus} from "../controllers/clientController.js"
import { authenticate, requirePermissions } from "../middleware/authentication.js";
import { requireOwnedRecord } from "../middleware/authorization.js";
import Client from "../models/clientModel.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

router.use(authenticate);

router.post("/addClient", requirePermissions("clients.create"), asyncHandler(addClient));
router.put("/updateClientById/:id", requirePermissions("clients.update"), requireOwnedRecord(Client), asyncHandler(updateClientById));
router.delete("/deleteClientById/:id", requirePermissions("clients.delete"), requireOwnedRecord(Client), asyncHandler(deleteClientById));
router.get("/getClientById/:id", requirePermissions("clients.read"), requireOwnedRecord(Client), asyncHandler(getClientById));
router.get("/getAllClientPagination", requirePermissions("clients.read"), asyncHandler(getAllClientPagination));
router.get("/getAllActiveClient", requirePermissions("clients.read"), asyncHandler(getAllActiveClient));
router.get("/getAllClient", requirePermissions("clients.read"), asyncHandler(getAllClient));
router.patch("/updateStatus/:id", requirePermissions("clients.status.update"), requireOwnedRecord(Client), asyncHandler(updateStatus));
router.get("/getAllClientCount", requirePermissions("clients.read"), asyncHandler(getAllClientCount));

export default router;
